#!/usr/bin/env node
/**
 * validate_ncanvas.js — 校验 .ncanvas 文件是否符合 NarrativeCanvas 归一化预期
 *
 * 用法：
 *   node validate_ncanvas.js <path-to-file.ncanvas>
 *   node validate_ncanvas.js <path> --quiet      # 只在出错时输出
 *
 * 检查项（对应 ncanvas-editor 的"写回前自检清单"）：
 *   1. JSON 合法、version===1
 *   2. savedAt 为合法 ISO 时间
 *   3. 顶层结构完整（version/savedAt/project/ui）
 *   4. project 核心：nodes/links/characters/nodeTypes 是数组
 *   5. Choice 节点 choiceOptions ↔ choices 双写一致
 *   6. 所有节点显式 frameId
 *   7. 无悬空 link（from/to 指向现存节点）
 *   8. choiceOptionId 引用有效（指向源 Choice 的选项 id）
 *   9. 节点 id 唯一；link/character id 唯一
 *  10. 未删除 system:true 的节点类型；至少一个 Entry 节点
 *  11. 类型专属字段匹配（Dialog 有 turns 才合理、Choice 有 choiceRevealMode 等）
 *
 * 退出码：0 = 全部通过；1 = 有错误；2 = 用法错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const quiet = process.argv.includes('--quiet');
if (!file) {
  console.error('用法: node validate_ncanvas.js <path-to-file.ncanvas> [--quiet]');
  process.exit(2);
}

const errors = [];
const warnings = [];
let data;

try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`✗ JSON 解析失败: ${e.message}`);
  process.exit(1);
}

const ok = (msg) => { if (!quiet) console.log(`  ✓ ${msg}`); };
const err = (msg) => { errors.push(msg); console.error(`  ✗ ${msg}`); };
const warn = (msg) => { warnings.push(msg); if (!quiet) console.log(`  ⚠ ${msg}`); };

console.log(`校验: ${path.basename(file)}`);

// 1-3. 顶层结构
if (data.version !== 1) err(`version 应为 1，实际 ${data.version}`);
else ok('version === 1');

if (typeof data.savedAt !== 'string' || isNaN(Date.parse(data.savedAt)))
  err(`savedAt 不是合法 ISO 时间: ${data.savedAt}`);
else ok('savedAt 合法');

for (const k of ['project', 'ui']) {
  if (!data[k] || typeof data[k] !== 'object') err(`缺少顶层 ${k}`);
}
const p = data.project || {};
for (const k of ['nodes', 'links', 'characters', 'nodeTypes']) {
  if (!Array.isArray(p[k])) err(`project.${k} 不是数组`);
}
if (errors.length === 0) ok('顶层结构完整');

const nodes = Array.isArray(p.nodes) ? p.nodes : [];
const links = Array.isArray(p.links) ? p.links : [];
const nodeIds = new Set(nodes.map((n) => n.id));

// 9. id 唯一性
function checkUniqueId(items, label) {
  const seen = new Set();
  let dup = false;
  for (const it of items) {
    if (it && typeof it.id === 'string') {
      if (seen.has(it.id)) { err(`${label} id 重复: ${it.id}`); dup = true; }
      seen.add(it.id);
    }
  }
  if (!dup && items.length) ok(`${label} id 唯一 (${items.length} 个)`);
}
checkUniqueId(nodes, 'node');
checkUniqueId(links, 'link');
checkUniqueId(p.characters || [], 'character');

// 6. 显式 frameId
let noFrame = 0;
for (const n of nodes) {
  if (!Object.prototype.hasOwnProperty.call(n, 'frameId')) noFrame++;
}
if (noFrame) warn(`${noFrame} 个节点无显式 frameId（加载时按几何推断，建议补 "frameId":""）`);
else ok('所有节点显式 frameId');

// 5. Choice 双写
let choiceBad = 0;
for (const n of nodes.filter((n) => n.type === 'Choice')) {
  const labels = (n.choiceOptions || []).map((o) => o.label);
  if (JSON.stringify(n.choices) !== JSON.stringify(labels)) {
    err(`Choice ${n.id} 的 choices 与 choiceOptions[].label 不一致`);
    choiceBad++;
  }
}
if (!choiceBad) ok('Choice 双写一致');

// 7. 悬空 link
let dang = 0;
for (const l of links) {
  if (!nodeIds.has(l.from) || !nodeIds.has(l.to)) {
    err(`悬空 link ${l.id}: from=${l.from} to=${l.to}`);
    dang++;
  }
}
if (!dang) ok(`无悬空 link (${links.length} 条)`);

// 8. choiceOptionId 引用
const choiceOptMap = new Map();
for (const n of nodes.filter((n) => n.type === 'Choice')) {
  choiceOptMap.set(n.id, new Set((n.choiceOptions || []).map((o) => o.id)));
}
let badOpt = 0;
for (const l of links) {
  if (l.choiceOptionId) {
    const opts = choiceOptMap.get(l.from);
    if (!opts || !opts.has(l.choiceOptionId)) {
      err(`link ${l.id} 的 choiceOptionId=${l.choiceOptionId} 在源节点 ${l.from} 中不存在`);
      badOpt++;
    }
  }
}
if (!badOpt) ok('choiceOptionId 引用有效');

// 10. system 类型与 Entry
const sysTypes = (p.nodeTypes || []).filter((t) => t && t.system).map((t) => t.type);
const hasEntry = nodes.some((n) => n.type === 'Entry');
if (!hasEntry) err('缺少 Entry 节点（入口不可缺）');
else ok('存在 Entry 节点');
if (!sysTypes.includes('Entry')) warn('nodeTypes 中缺少 system:true 的 Entry 类型定义');

// 11. 类型专属字段粗检
for (const n of nodes) {
  if (n.type === 'Choice' && !Array.isArray(n.choiceOptions)) {
    warn(`Choice ${n.id} 无 choiceOptions（仅有 choices 也能加载，但建议补 choiceOptions）`);
  }
  if (n.type !== 'Dialog' && n.turns) warn(`非 Dialog 节点 ${n.id} 带了 turns（归一化会删除）`);
  if (n.type !== 'Choice' && n.choiceRevealMode) warn(`非 Choice 节点 ${n.id} 带了 choiceRevealMode`);
}

// ui 完整性
if (data.ui && typeof data.ui === 'object') ok('ui 段存在');

console.log('—'.repeat(40));
if (errors.length) {
  console.error(`✗ 失败：${errors.length} 个错误${warnings.length ? `，${warnings.length} 个警告` : ''}`);
  process.exit(1);
}
if (warnings.length) console.log(`⚠ 通过，但有 ${warnings.length} 个警告`);
else console.log('✓ 全部通过');
process.exit(0);
