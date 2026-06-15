extends Node

@export_file("*.json") var runtime_json_path := ""
@export_file("*.json") var route_cases_path := ""
@export var run_on_ready := true

func _ready() -> void:
    if run_on_ready:
        run_routes()

func run_routes() -> Array:
    if runtime_json_path == "":
        push_error("runtime_json_path is required.")
        return []
    var route_cases := _load_route_cases(route_cases_path)
    var results := []
    for route_case in route_cases:
        var runtime := NarrativeCanvasRuntime.from_file(runtime_json_path)
        if runtime == null:
            return results
        var result := _walk_route(runtime, route_case)
        var error := _validate_route_result(route_case, result)
        if error != "":
            push_error(error)
        else:
            print("Narrative Canvas route passed: %s" % str(route_case.get("name", "route")))
        results.append(result)
    print(JSON.stringify({
        "status": "pass",
        "runtime": runtime_json_path,
        "routeCount": results.size(),
        "results": results
    }, "\t"))
    return results

func _load_route_cases(file_path: String) -> Array:
    if file_path == "":
        return [{
            "name": "default",
            "choiceLabels": [],
            "minVisits": 1,
            "expectNode": [],
            "expectText": [],
            "expectState": []
        }]
    var text := FileAccess.get_file_as_string(file_path)
    var parsed = JSON.parse_string(text)
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Route cases file is not a JSON object: %s" % file_path)
        return []
    var cases = parsed.get("cases", [])
    return cases if typeof(cases) == TYPE_ARRAY else []

func _walk_route(runtime: NarrativeCanvasRuntime, route_case: Dictionary) -> Dictionary:
    var choice_labels := _string_list(route_case.get("choiceLabels", []))
    var visited := []
    var output := []
    var selected_choices := []
    for _step in range(100):
        var page := runtime.current_page()
        if page.is_empty():
            break
        var node = page.get("node", {})
        visited.append({
            "id": str(node.get("id", "")),
            "slug": str(node.get("slug", "")),
            "title": str(node.get("title", ""))
        })
        if str(page.get("body", "")) != "":
            output.append(str(page.get("body", "")))
        for value in page.get("custom_fields", {}).values():
            if str(value) != "":
                output.append(str(value))
        var choice := _pick_choice(page.get("choices", []), choice_labels)
        if not choice.is_empty():
            selected_choices.append({
                "id": str(choice.get("id", "")),
                "label": str(choice.get("label", ""))
            })
            runtime.choose(str(choice.get("id", "")))
        elif not runtime.advance():
            break
    return {
        "name": str(route_case.get("name", "route")),
        "visited": visited,
        "selectedChoices": selected_choices,
        "output": "\n".join(output),
        "finalState": runtime.get_state()
    }

func _pick_choice(choices: Array, choice_labels: Array) -> Dictionary:
    if choices.is_empty():
        return {}
    if choice_labels.is_empty():
        return choices[0] if typeof(choices[0]) == TYPE_DICTIONARY else {}
    var requested := str(choice_labels.pop_front())
    for choice in choices:
        if typeof(choice) == TYPE_DICTIONARY:
            if str(choice.get("id", "")) == requested or str(choice.get("label", "")) == requested:
                return choice
    push_error("Choice not found: %s" % requested)
    return {}

func _validate_route_result(route_case: Dictionary, result: Dictionary) -> String:
    var min_visits := int(route_case.get("minVisits", 0))
    if min_visits > 0 and result.get("visited", []).size() < min_visits:
        return "%s visited %d nodes, expected at least %d" % [route_case.get("name", "route"), result.get("visited", []).size(), min_visits]
    for expected in _string_list(route_case.get("expectNode", [])):
        if not _visited_contains(result.get("visited", []), expected):
            return "%s did not visit %s" % [route_case.get("name", "route"), expected]
    for expected in _string_list(route_case.get("expectText", [])):
        if not str(result.get("output", "")).contains(expected):
            return "%s output did not contain %s" % [route_case.get("name", "route"), expected]
    for expected_state in route_case.get("expectState", []):
        if typeof(expected_state) != TYPE_DICTIONARY:
            continue
        var key := str(expected_state.get("key", ""))
        if key == "":
            continue
        var final_state = result.get("finalState", {})
        if not final_state.has(key):
            return "%s final state is missing %s" % [route_case.get("name", "route"), key]
        if not _values_match(final_state[key], expected_state.get("value")):
            return "%s final state %s mismatch" % [route_case.get("name", "route"), key]
    return ""

func _visited_contains(visited: Array, expected: String) -> bool:
    for visit in visited:
        if typeof(visit) != TYPE_DICTIONARY:
            continue
        if str(visit.get("id", "")) == expected or str(visit.get("slug", "")) == expected or str(visit.get("title", "")) == expected:
            return true
    return false

func _string_list(value) -> Array:
    if typeof(value) == TYPE_ARRAY:
        var result := []
        for item in value:
            result.append(str(item))
        return result
    if value == null or str(value) == "":
        return []
    return [str(value)]

func _values_match(left, right) -> bool:
    if left == right:
        return true
    if str(left).is_valid_float() and str(right).is_valid_float():
        return float(left) == float(right)
    return JSON.stringify(left) == JSON.stringify(right)
