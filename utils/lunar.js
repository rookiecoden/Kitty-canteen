// 农历展示：读离线表，不再依赖第三方库
const TABLE = require('../data/lunar-table');

const MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function dayName(n) {
  if (n <= 10) return '初' + DIGITS[n - 1];
  if (n < 20) return '十' + DIGITS[n - 11];
  if (n === 20) return '二十';
  if (n < 30) return '廿' + DIGITS[n - 21];
  return '三十';
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today - start) / 86400000) + 1;
}

// 返回「十月初九」这样的字符串；超出表范围返回空串
function lunarText(date) {
  const d = date || new Date();
  const rows = TABLE[d.getFullYear()];
  if (!rows) return '';

  const doy = dayOfYear(d);
  let anchor = rows[0];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] <= doy) anchor = rows[i];
  }
  if (!anchor) return '';

  const month = anchor[1];
  const isLeap = anchor[2] === 1;
  const day = anchor[3] + (doy - anchor[0]);
  return (isLeap ? '闰' : '') + MONTHS[month - 1] + '月' + dayName(day);
}

module.exports = { lunarText };
