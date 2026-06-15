extends RefCounted
class_name NarrativeCanvasRuntime

var document := {}
var state := {}
var nodes_by_id := {}
var current_node_id := ""
var _entered_current_node := false

static func from_file(file_path: String) -> NarrativeCanvasRuntime:
    var text := FileAccess.get_file_as_string(file_path)
    if text == "":
        push_error("Runtime JSON file is empty or missing: %s" % file_path)
        return null
    var parsed = JSON.parse_string(text)
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Runtime JSON file is not a JSON object: %s" % file_path)
        return null
    var runtime := NarrativeCanvasRuntime.new()
    if not runtime.load_document(parsed):
        return null
    return runtime

func load_document(data: Dictionary) -> bool:
    if data.get("format", "") != "narrative-canvas-runtime":
        push_error("Unsupported Narrative Canvas runtime document.")
        return false
    if int(data.get("version", 0)) != 1:
        push_error("Unsupported Narrative Canvas runtime version: %s" % str(data.get("version", "")))
        return false
    document = _clone(data)
    state = _clone(data.get("variables", {}))
    nodes_by_id.clear()
    for node in data.get("nodes", []):
        if typeof(node) != TYPE_DICTIONARY:
            continue
        var node_id := str(node.get("id", ""))
        if node_id != "":
            nodes_by_id[node_id] = node
    current_node_id = str(data.get("startNodeId", ""))
    if current_node_id == "" and data.get("nodes", []).size() > 0:
        current_node_id = str(data.get("nodes", [])[0].get("id", ""))
    _entered_current_node = false
    return current_node_id != ""

func current_page() -> Dictionary:
    if not _enter_current_node():
        return {}
    var node := _get_current_node()
    return {
        "node": node,
        "state": _clone(state),
        "body": _render_text(str(node.get("body", ""))),
        "custom_fields": _render_fields(node.get("customFields", {})),
        "choices": _available_choices(node)
    }

func advance() -> bool:
    if not _enter_current_node():
        return false
    var node := _get_current_node()
    if str(node.get("routing", {}).get("mode", "")) == "end":
        return false
    var target_id := ""
    for branch in node.get("conditionBranches", []):
        if typeof(branch) == TYPE_DICTIONARY and _condition_passes(str(branch.get("condition", ""))):
            target_id = str(branch.get("targetId", ""))
            break
    if target_id == "":
        for transition in node.get("next", []):
            if typeof(transition) == TYPE_DICTIONARY and _condition_passes(str(transition.get("condition", ""))):
                target_id = str(transition.get("targetId", ""))
                break
    if target_id == "":
        target_id = str(node.get("routing", {}).get("targetId", ""))
    if target_id == "" or not nodes_by_id.has(target_id):
        return false
    current_node_id = target_id
    _entered_current_node = false
    return true

func choose(choice_id_or_label: String) -> bool:
    if not _enter_current_node():
        return false
    var node := _get_current_node()
    for choice in node.get("choices", []):
        if typeof(choice) != TYPE_DICTIONARY:
            continue
        if str(choice.get("id", "")) != choice_id_or_label and str(choice.get("label", "")) != choice_id_or_label:
            continue
        if not _condition_passes(str(choice.get("condition", ""))):
            return false
        _apply_effects(choice.get("effects", []))
        var target_id := str(choice.get("targetId", ""))
        if target_id != "" and nodes_by_id.has(target_id):
            current_node_id = target_id
            _entered_current_node = false
        return true
    return false

func get_state() -> Dictionary:
    return _clone(state)

func _enter_current_node() -> bool:
    if _entered_current_node:
        return true
    var node := _get_current_node()
    if node.is_empty():
        push_error("Missing current node: %s" % current_node_id)
        return false
    if not _condition_passes(str(node.get("condition", ""))):
        push_warning("Current node condition is false: %s" % str(node.get("title", node.get("id", ""))))
        return false
    _apply_effects(node.get("effects", []))
    _entered_current_node = true
    return true

func _get_current_node() -> Dictionary:
    if nodes_by_id.has(current_node_id):
        return nodes_by_id[current_node_id]
    return {}

func _available_choices(node: Dictionary) -> Array:
    var result := []
    for choice in node.get("choices", []):
        if typeof(choice) == TYPE_DICTIONARY and _condition_passes(str(choice.get("condition", ""))):
            result.append(choice)
    return result

func _render_fields(fields) -> Dictionary:
    var result := {}
    if typeof(fields) != TYPE_DICTIONARY:
        return result
    for key in fields.keys():
        result[key] = _render_text(str(fields[key]))
    return result

func _render_text(text: String) -> String:
    var regex := RegEx.new()
    regex.compile("\\{([^{}]+)\\}")
    var result := ""
    var offset := 0
    for match_result in regex.search_all(text):
        result += text.substr(offset, match_result.get_start() - offset)
        var key := match_result.get_string(1).strip_edges()
        var resolved := _resolve_state_value(key)
        result += str(resolved.get("value")) if resolved.get("found", false) else match_result.get_string(0)
        offset = match_result.get_end()
    result += text.substr(offset)
    return result

func _apply_effects(effects) -> void:
    if typeof(effects) != TYPE_ARRAY:
        return
    for effect in effects:
        if typeof(effect) != TYPE_DICTIONARY:
            continue
        var key := str(effect.get("key", ""))
        if key == "":
            continue
        var op := str(effect.get("op", ""))
        var value = _resolve_effect_value(effect)
        match op:
            "set":
                state[key] = value
            "add":
                state[key] = float(state.get(key, 0)) + float(value)
            "subtract":
                state[key] = float(state.get(key, 0)) - float(value)
            "toggle":
                state[key] = not bool(state.get(key, false))
            "append":
                var current := _array_value(state.get(key, []))
                current.append(value)
                state[key] = current
            "remove":
                var filtered := []
                for item in _array_value(state.get(key, [])):
                    if not _values_match(item, value):
                        filtered.append(item)
                state[key] = filtered
            "clear":
                state[key] = [] if typeof(state.get(key)) == TYPE_ARRAY else ""

func _resolve_effect_value(effect: Dictionary):
    var value_source := str(effect.get("valueSource", ""))
    if value_source == "state" or value_source == "variable":
        var resolved := _resolve_state_value(str(effect.get("value", "")))
        return resolved.get("value") if resolved.get("found", false) else effect.get("value")
    return effect.get("value")

func _condition_passes(source: String) -> bool:
    var text := source.strip_edges()
    if text == "":
        return true
    var lower := text.to_lower()
    if lower == "true":
        return true
    if lower == "false" or lower == "null":
        return false
    var or_parts := _split_condition(text, "||")
    if or_parts.size() > 1:
        for part in or_parts:
            if _condition_passes(part):
                return true
        return false
    var and_parts := _split_condition(text, "&&")
    if and_parts.size() > 1:
        for part in and_parts:
            if not _condition_passes(part):
                return false
        return true
    var grouped = _unwrap_condition_group(text)
    if grouped != null:
        return _condition_passes(grouped)
    if text.begins_with("!(") and text.ends_with(")"):
        return not _condition_passes(text.substr(2, text.length() - 3))
    if text.begins_with("!") and not text.begins_with("!="):
        return not _condition_passes(text.substr(1))
    if lower.begins_with("not "):
        return not _condition_passes(text.substr(4))
    var predicate := _parse_predicate(text)
    if not predicate.is_empty():
        return _evaluate_predicate(predicate)
    var comparison := _match_regex("^([a-zA-Z_][\\w.]*)\\s*(==|!=|>=|<=|>|<)\\s*(.+)$", text)
    if comparison != null:
        var left = _resolve_state_value(comparison.get_string(1)).get("value")
        var right = _parse_condition_value(comparison.get_string(3))
        var operator := comparison.get_string(2)
        match operator:
            "==":
                return _values_match(left, right)
            "!=":
                return not _values_match(left, right)
            ">=":
                return float(left) >= float(right)
            "<=":
                return float(left) <= float(right)
            ">":
                return float(left) > float(right)
            "<":
                return float(left) < float(right)
    if _match_regex("^[a-zA-Z_][\\w.]*$", text) != null:
        return bool(_resolve_state_value(text).get("value"))
    push_warning("Unsupported condition in NarrativeCanvasRuntime: %s" % text)
    return false

func _split_condition(text: String, operator: String) -> Array:
    var parts := []
    var quote := ""
    var escaped := false
    var depth := 0
    var start := 0
    var index := 0
    while index < text.length():
        var character := text.substr(index, 1)
        if quote != "":
            if escaped:
                escaped = false
            elif character == "\\":
                escaped = true
            elif character == quote:
                quote = ""
            index += 1
            continue
        if character == "\"" or character == "'":
            quote = character
            index += 1
            continue
        if character == "(":
            depth += 1
        elif character == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and text.substr(index, operator.length()) == operator:
            parts.append(text.substr(start, index - start).strip_edges())
            index += operator.length()
            start = index
            continue
        index += 1
    parts.append(text.substr(start).strip_edges())
    return parts.filter(func(part): return str(part) != "")

func _unwrap_condition_group(text: String):
    if not text.begins_with("(") or not text.ends_with(")"):
        return null
    var quote := ""
    var escaped := false
    var depth := 0
    for index in range(text.length()):
        var character := text.substr(index, 1)
        if quote != "":
            if escaped:
                escaped = false
            elif character == "\\":
                escaped = true
            elif character == quote:
                quote = ""
            continue
        if character == "\"" or character == "'":
            quote = character
            continue
        if character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
        if depth == 0 and index < text.length() - 1:
            return null
    return text.substr(1, text.length() - 2).strip_edges() if depth == 0 else null

func _parse_predicate(text: String) -> Dictionary:
    var predicate_match := _match_regex("^(has|contains)\\s*\\(([\\s\\S]*)\\)$", text)
    if predicate_match == null:
        return {}
    var args := _split_expression_arguments(predicate_match.get_string(2))
    if args.size() != 2:
        return {}
    var key := _normalize_variable_term(args[0])
    if key == "":
        return {}
    return {
        "name": predicate_match.get_string(1).to_lower(),
        "key": key,
        "value": args[1]
    }

func _split_expression_arguments(text: String) -> Array:
    var args := []
    var quote := ""
    var escaped := false
    var depth := 0
    var start := 0
    for index in range(text.length()):
        var character := text.substr(index, 1)
        if quote != "":
            if escaped:
                escaped = false
            elif character == "\\":
                escaped = true
            elif character == quote:
                quote = ""
            continue
        if character == "\"" or character == "'":
            quote = character
            continue
        if character == "(":
            depth += 1
        elif character == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and character == ",":
            args.append(text.substr(start, index - start).strip_edges())
            start = index + 1
    args.append(text.substr(start).strip_edges())
    return args.filter(func(arg): return str(arg) != "")

func _evaluate_predicate(predicate: Dictionary) -> bool:
    var container = _normalize_membership_container(_resolve_state_value(str(predicate.get("key", ""))).get("value"))
    var value = _parse_condition_value(str(predicate.get("value", "")))
    if typeof(container) == TYPE_ARRAY:
        for item in container:
            if _values_match(item, value):
                return true
        return false
    if typeof(container) == TYPE_DICTIONARY:
        return container.has(str(value))
    if typeof(container) == TYPE_STRING:
        return str(value) != "" and str(container).contains(str(value))
    return _values_match(container, value)

func _normalize_membership_container(value):
    if typeof(value) != TYPE_STRING:
        return value
    var text := str(value).strip_edges()
    if not text.begins_with("[") or not text.ends_with("]"):
        return value
    var parsed = JSON.parse_string(text)
    return parsed if typeof(parsed) == TYPE_ARRAY else value

func _parse_condition_value(source: String):
    var key := _normalize_variable_term(source)
    if key != "":
        var resolved := _resolve_state_value(key)
        if resolved.get("found", false):
            return resolved.get("value")
    return _parse_literal(source)

func _parse_literal(source: String):
    var text := source.strip_edges()
    var lower := text.to_lower()
    if text.begins_with("\"") and text.ends_with("\""):
        var parsed = JSON.parse_string(text)
        return parsed if parsed != null else text.substr(1, text.length() - 2)
    if text.begins_with("'") and text.ends_with("'"):
        return text.substr(1, text.length() - 2)
    if lower == "true":
        return true
    if lower == "false":
        return false
    if lower == "null":
        return null
    if text.is_valid_int():
        return int(text)
    if text.is_valid_float():
        return float(text)
    return text

func _resolve_state_value(key: String) -> Dictionary:
    var text := key.strip_edges()
    if text == "":
        return { "found": false, "value": null }
    if state.has(text):
        return { "found": true, "value": state[text] }
    if not text.contains("."):
        return { "found": false, "value": null }
    var current = state
    for part in text.split("."):
        if typeof(current) != TYPE_DICTIONARY or not current.has(part):
            return { "found": false, "value": null }
        current = current[part]
    return { "found": true, "value": current }

func _normalize_variable_term(source: String) -> String:
    var text := source.strip_edges().trim_prefix("$")
    return text if _match_regex("^[a-zA-Z_][\\w.]*$", text) != null else ""

func _array_value(value) -> Array:
    return value.duplicate(true) if typeof(value) == TYPE_ARRAY else []

func _values_match(left, right) -> bool:
    if left == right:
        return true
    if str(left).is_valid_float() and str(right).is_valid_float():
        return float(left) == float(right)
    return JSON.stringify(left) == JSON.stringify(right)

func _match_regex(pattern: String, text: String):
    var regex := RegEx.new()
    regex.compile(pattern)
    return regex.search(text)

func _clone(value):
    if typeof(value) == TYPE_DICTIONARY or typeof(value) == TYPE_ARRAY:
        return value.duplicate(true)
    return value
