const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function todayText(d) {
  const t = d || new Date();
  return t.getMonth() + 1 + '月' + t.getDate() + '日 ' + WEEK[t.getDay()];
}

function hhmm(d) {
  const t = d || new Date();
  return pad(t.getHours()) + ':' + pad(t.getMinutes());
}

function greeting(d) {
  const h = (d || new Date()).getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

// 把「2026-11-17 18:30」或 ISO 字符串变成 HH:mm
function timeOf(value) {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? m[1] + ':' + m[2] : '';
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const t = startOfToday();
  return d.getTime() >= t.getTime();
}

const STATUS = {
  pending: { text: '等你接单', short: '待接单', color: '#c4964b' },
  cooking: { text: '正在做啦', short: '烹饪中', color: '#d2482f' },
  served: { text: '已上菜', short: '已上菜', color: '#4e7350' },
};

module.exports = { todayText, hhmm, greeting, timeOf, isToday, startOfToday, STATUS };
