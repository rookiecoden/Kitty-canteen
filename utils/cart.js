const KEY = 'family_cart_v1';
const menu = require('./menu');

function getLines() {
  const raw = wx.getStorageSync(KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (l) {
    return l && l.id && l.qty > 0;
  });
}

function save(lines) {
  wx.setStorageSync(KEY, lines);
}

function addItem(id, step) {
  const n = step || 1;
  const lines = getLines();
  let hit = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].id === id) hit = lines[i];
  }
  if (hit) {
    hit.qty += n;
  } else {
    lines.push({ id: id, qty: n });
  }
  save(lines.filter(function (l) { return l.qty > 0; }));
}

function setQty(id, qty) {
  const lines = getLines();
  lines.forEach(function (l) {
    if (l.id === id) l.qty = qty;
  });
  save(lines.filter(function (l) { return l.qty > 0; }));
}

function clear() {
  wx.removeStorageSync(KEY);
}

// 汇总：返回带菜品详情的清单与合计
function summary() {
  const lines = getLines();
  let count = 0;
  let calories = 0;
  const items = [];
  lines.forEach(function (l) {
    const dish = menu.findDish(l.id);
    if (!dish) return;
    count += l.qty;
    calories += dish.calories * l.qty;
    items.push({
      id: dish.id,
      name: dish.name,
      initial: (dish.name || '').charAt(0),
      img: dish.img,
      qty: l.qty,
      calories: dish.calories,
      subtotal: dish.calories * l.qty,
      cuisine: dish.cuisine,
      isBase: dish.isBase === true,
    });
  });
  return { items: items, count: count, calories: calories };
}

module.exports = { getLines, addItem, setQty, clear, summary };