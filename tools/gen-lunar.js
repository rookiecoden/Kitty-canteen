// 生成离线农历表：2024-2040，每年记录「农历月初一」的落点
const fs = require('fs');
const path = require('path');
const { Solar } = require('lunar-javascript');

const START = 2024;
const END = 2040;

function dayOfYear(d) {
  const s = new Date(d.getFullYear(), 0, 1);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - s) / 86400000) + 1;
}

function lunarAt(y, m, day) {
  // 用正午避免时区把日期推前
  return Solar.fromDate(new Date(y, m, day, 12, 0, 0)).getLunar();
}

const table = {};
for (let y = START; y <= END; y++) {
  const list = [];
  const days = dayOfYear(new Date(y, 11, 31));

  for (let doy = 1; doy <= days; doy++) {
    const d = new Date(y, 0, doy);
    const l = lunarAt(y, d.getMonth(), d.getDate());
    const m = l.getMonth();
    const dayN = l.getDay();
    // 记录每年第一天，以及每个农历月的初一
    if (doy === 1 || dayN === 1) {
      list.push([doy, Math.abs(m), m < 0 ? 1 : 0, dayN]);
    }
  }
  table[y] = list;
}

const out =
  '// 自动生成：tools/gen-lunar.js，勿手改\n' +
  '// 每年记录若干锚点 [一年中的第几天, 农历月, 是否闰月, 该锚点对应的农历日]\n' +
  'module.exports = ' +
  JSON.stringify(table) +
  ';\n';

fs.writeFileSync(path.join(__dirname, '..', 'data', 'lunar-table.js'), out, 'utf8');
const bytes = fs.statSync(path.join(__dirname, '..', 'data', 'lunar-table.js')).size;
console.log('written data/lunar-table.js', (bytes / 1024).toFixed(1) + 'KB');

// 抽查
[[2026, 10, 17], [2026, 0, 1], [2025, 0, 29], [2027, 1, 6]].forEach(function (t) {
  const l = lunarAt(t[0], t[1], t[2]);
  console.log(t.join('-'), '->', (l.getMonth() < 0 ? '闰' : '') + l.getMonthInChinese() + '月' + l.getDayInChinese());
});
