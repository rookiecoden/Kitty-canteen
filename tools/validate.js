// 基础静态校验：工程结构、JSON、WXML 表达式限制、class 覆盖、本地资源引用、包体积估算
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warns = [];
const notes = [];

function read(p) { return fs.readFileSync(p, 'utf8'); }
function exists(p) { return fs.existsSync(p); }

// 1. app.json
let app = null;
try {
  app = JSON.parse(read(path.join(ROOT, 'app.json')));
} catch (e) {
  problems.push('app.json 解析失败: ' + e.message);
}
if (app) {
  if (!Array.isArray(app.pages) || app.pages.length === 0) problems.push('app.json pages 为空');
  if (app.lazyCodeLoading !== 'requiredComponents') problems.push('app.json 缺少 lazyCodeLoading');
  app.pages.forEach(function (p) {
    ['.js', '.json', '.wxml'].forEach(function (ext) {
      if (!exists(path.join(ROOT, p + ext))) problems.push('页面缺失文件: ' + p + ext);
    });
  });
}

// 2. 所有 JSON 可解析 + 收集文件
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    if (d.name === 'node_modules' || d.name === '.git') return;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else out.push(full);
  });
}
const files = [];
walk(ROOT, files);

files.forEach(function (f) {
  if (f.endsWith('.json')) {
    try { JSON.parse(read(f)); } catch (e) { problems.push('JSON 解析失败: ' + path.relative(ROOT, f)); }
  }
});

// 3. WXML 表达式限制
const WXML_BAD = [
  { re: /\{\{[^}]*indexOf\s*\(/, msg: 'WXML 使用了 indexOf() 函数调用' },
  { re: /\{\{[^}]*=>/, msg: 'WXML 使用了箭头函数' },
  { re: /\{\{[^}]*\?\./, msg: 'WXML 使用了可选链 ?.' },
  { re: /\{\{[^}]*\?\?/, msg: 'WXML 使用了 ??' },
  { re: /\{\{[^}]*\bfunction\b/, msg: 'WXML 内联 function' },
];
files.filter(function (f) { return f.endsWith('.wxml'); }).forEach(function (f) {
  const src = read(f);
  WXML_BAD.forEach(function (b) {
    if (b.re.test(src)) problems.push(path.relative(ROOT, f) + ': ' + b.msg);
  });
});

// 4. WXSS 本地背景图
files.filter(function (f) { return f.endsWith('.wxss'); }).forEach(function (f) {
  const src = read(f);
  if (/background-image\s*:\s*url\((['"]?)(?!data:)[^)]+\)/.test(src)) {
    problems.push(path.relative(ROOT, f) + ': WXSS 引用本地背景图');
  }
});

// 5. class 覆盖检查：WXML 用到的 class 必须在某个 WXSS 里有定义
const defined = {};
files.filter(function (f) { return f.endsWith('.wxss'); }).forEach(function (f) {
  const src = read(f);
  const re = /\.(-?[a-zA-Z_][\w-]*)/g;
  let m;
  while ((m = re.exec(src)) !== null) defined[m[1]] = true;
});

function classesInWxml(src) {
  const out = [];
  const attrRe = /class\s*=\s*"([^"]*)"/g;
  let a;
  while ((a = attrRe.exec(src)) !== null) {
    const raw = a[1];
    // 只取三元表达式两个分支里的字面量（比较用的值不是 class）
    const exprRe = /\?\s*'([^']*)'\s*:\s*'([^']*)'/g;
    let e;
    while ((e = exprRe.exec(raw)) !== null) {
      [e[1], e[2]].forEach(function (v) {
        v.split(/\s+/).forEach(function (c) { if (c) out.push(c); });
      });
    }
    const plain = raw.replace(/\{\{[^}]*\}\}/g, ' ');
    plain.split(/\s+/).forEach(function (c) { if (c) out.push(c); });
  }
  return out;
}

files.filter(function (f) { return f.endsWith('.wxml'); }).forEach(function (f) {
  const list = classesInWxml(read(f));
  list.forEach(function (c) {
    if (!defined[c]) warns.push(path.relative(ROOT, f) + ' 使用了未定义的 class: .' + c);
  });
});

// 6. 菜品图片与插画资源
const dishesSrc = read(path.join(ROOT, 'data', 'dishes.js'));
const imgRe = /img:\s*'(\/images\/[^']+)'/g;
let hit;
let imgCount = 0;
while ((hit = imgRe.exec(dishesSrc)) !== null) {
  imgCount++;
  if (!exists(path.join(ROOT, hit[1].replace(/^\//, '')))) problems.push('菜品图缺失: ' + hit[1]);
}
notes.push('菜品图引用数: ' + imgCount);

files.filter(function (f) { return f.endsWith('.wxml'); }).forEach(function (f) {
  const src = read(f);
  const re = /\/assets\/illus\/[\w-]+\.png/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (!exists(path.join(ROOT, m[0].replace(/^\//, '')))) {
      problems.push('插画缺失: ' + m[0] + '（' + path.relative(ROOT, f) + '）');
    }
  }
});

// 7. 包体积（排除 node_modules、tools、菜品原始 PNG）
let total = 0;
files.forEach(function (f) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (rel.startsWith('node_modules/') || rel.startsWith('tools/')) return;
  if (/^images\/(dish|illus)\/.*\.png$/.test(rel)) return;
  // 已下架菜品残留的图，已被 packOptions 忽略
  if (/^images\/dish\/(hotpot-duck-intestine|hotpot-throat|bbq-chicken-heart|bbq-mushroom|bbq-enoki-foil)\.jpg$/.test(rel)) return;
  total += fs.statSync(f).size;
});
notes.push('包内资源约: ' + (total / 1024).toFixed(0) + ' KB');

console.log('=== 校验结果 ===');
if (problems.length === 0) console.log('通过：未发现结构性问题');
else problems.forEach(function (p) { console.log('✗ ' + p); });
if (warns.length) {
  console.log('--- 警告 ---');
  warns.forEach(function (w) { console.log('! ' + w); });
}
console.log('--- 备注 ---');
notes.forEach(function (n) { console.log('· ' + n); });
process.exit(problems.length ? 1 : 0);
