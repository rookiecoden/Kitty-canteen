// 菜单数据层：云端为准，storage 缓存兜底，内置数据最后兜底
const bundled = require('../data/dishes');
const { cloud } = require('./cloud');
const { appConfig } = require('./config');
const auth = require('./auth');

const CACHE_KEY = 'menu_cache_v2';
const URL_TTL = 60 * 60 * 24; // 云图签名 URL 有效期 24 小时，每次进小程序重取

let dishes = null; // 当前内存快照
let loading = null;
let lastError = '';

function normalizeBundled() {
  return bundled.DISHES.map(function (d, i) {
    return {
      id: d.id,
      name: d.name,
      cuisine: d.cuisine,
      group: d.group || '',
      calories: d.calories || 0,
      minutes: d.minutes || 0,
      spicy: d.spicy || 0,
      img: d.img || '',
      desc: d.desc || '',
      tags: d.tags || [],
      ingredients: d.ingredients || [],
      status: 'on',
      sort: i,
      isBase: d.group === 'base',
      isBuiltin: true,
    };
  });
}

function fromRow(r) {
  return {
    id: r.dish_key,
    name: r.name,
    cuisine: r.cuisine,
    group: r.group_id || '',
    calories: r.calories || 0,
    minutes: r.minutes || 0,
    spicy: r.spicy || 0,
    img: r.img || '',
    desc: r.description || '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    status: r.status || 'on',
    sort: r.sort || 0,
    isBase: (r.group_id || '') === 'base',
    isBuiltin: r.is_builtin === true,
  };
}

function toRow(d) {
  return {
    dish_key: d.id,
    name: d.name,
    cuisine: d.cuisine,
    group_id: d.group || '',
    description: d.desc || '',
    tags: d.tags || [],
    calories: d.calories || 0,
    minutes: d.minutes || 0,
    spicy: d.spicy || 0,
    img: d.img || '',
    ingredients: d.ingredients || [],
    status: d.status || 'on',
    sort: d.sort || 0,
    is_builtin: d.isBuiltin === true,
  };
}

// ---------- 读取 ----------
function readCache() {
  try {
    const raw = wx.getStorageSync(CACHE_KEY);
    if (raw && Array.isArray(raw.dishes) && raw.dishes.length) return raw.dishes;
  } catch (e) {}
  return null;
}

function writeCache(list) {
  try {
    wx.setStorageSync(CACHE_KEY, { at: Date.now(), dishes: list });
  } catch (e) {}
}

function ensureSync() {
  if (dishes) return dishes;
  dishes = readCache() || normalizeBundled();
  return dishes;
}

// 把 cloud: 开头的存储路径换成可访问的签名 URL
function resolveImages(list) {
  const paths = [];
  list.forEach(function (d) {
    if (d.img && d.img.indexOf('cloud:') === 0) paths.push(d.img.slice(6));
  });
  if (paths.length === 0) return Promise.resolve(list);

  return cloud.storage.createSignedUrls(paths, URL_TTL).then(function (res) {
    if (res.error || !Array.isArray(res.data)) return list;
    const map = {};
    res.data.forEach(function (item) {
      if (item && item.path) map[item.path] = item.signedUrl || item.signedURL || '';
    });
    return list.map(function (d) {
      if (d.img && d.img.indexOf('cloud:') === 0) {
        const url = map[d.img.slice(6)];
        if (url) {
          const copy = {};
          Object.keys(d).forEach(function (k) { copy[k] = d[k]; });
          copy.img = url;
          copy.imgPath = d.img;
          return copy;
        }
      }
      return d;
    });
  }).catch(function () {
    return list;
  });
}

function seed(list) {
  // 写权限已收紧，灌数据走服务端函数（仅当表为空时生效）
  return cloud.database
    .rpc('seed_dishes', { payload: list.map(toRow) })
    .then(function () {
      return list;
    })
    .catch(function () {
      return list;
    });
}

function load(force) {
  if (loading && !force) return loading;

  loading = cloud.database
    .from(appConfig.dishTable)
    .select('*')
    .order('cuisine', { ascending: true })
    .order('sort', { ascending: true })
    .limit(300)
    .then(function (res) {
      if (res.error) throw new Error('read failed');
      const rows = res.data || [];
      if (rows.length === 0) {
        // 首次使用：把内置菜单灌进云端
        const seedList = normalizeBundled();
        return seed(seedList).then(function (seeded) {
          return resolveImages(seeded);
        });
      }
      return resolveImages(rows.map(fromRow));
    })
    .then(function (list) {
      dishes = list;
      lastError = '';
      writeCache(list.filter(function (d) { return d.img.indexOf('cloud:') !== 0; }));
      loading = null;
      return list;
    })
    .catch(function (err) {
      lastError = (err && err.message) || 'load failed';
      loading = null;
      if (!dishes) ensureSync();
      return dishes;
    });

  return loading;
}

// ---------- 查询 ----------
function all(includeOff) {
  const list = ensureSync();
  return includeOff ? list : list.filter(function (d) { return d.status !== 'off'; });
}

function findDish(id) {
  const list = ensureSync();
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function byCuisine(cuisine, group, includeOff) {
  return all(includeOff).filter(function (d) {
    if (d.cuisine !== cuisine) return false;
    if (!group || group === 'all') return true;
    return d.group === group;
  });
}

function basesOf(cuisine) {
  return all().filter(function (d) {
    return d.cuisine === (cuisine || 'hotpot') && d.isBase;
  });
}

function groupsFor(cuisine, includeOff) {
  // 分类定义仍用本地配置，云端只存菜品
  return bundled.groupsOf(cuisine);
}

function cuisines() {
  return bundled.CUISINES;
}

// ---------- 写入（管理端） ----------
// 表的写权限已从 anon 收回，所有写操作必须走带上口令的服务端函数
function rpc(fn, args) {
  return cloud.database.rpc(fn, args).then(function (res) {
    if (res && res.error) throw new Error(res.error.message || (fn + " failed"));
    return res;
  });
}

function save(dish) {
  return rpc("admin_save_dish", { pin: auth.getPin(), payload: toRow(dish) });
}

// 新菜排到同组最后，由服务端在 admin_save_dish 里按 sort 落库
function nextSort(cuisine, group) {
  const list = all(true).filter(function (d) {
    return d.cuisine === cuisine && d.group === (group || '');
  });
  let max = -1;
  list.forEach(function (d) { if (d.sort > max) max = d.sort; });
  return max + 1;
}

function setStatus(id, status) {
  return rpc("admin_set_dish_status", { p_pin: auth.getPin(), p_key: id, p_status: status });
}

function remove(id) {
  return rpc("admin_delete_dish", { p_pin: auth.getPin(), p_key: id });
}

// 上下移动由服务端交换 sort，返回 true/false 表示有没有动
function move(id, delta) {
  return rpc("admin_move_dish", { p_pin: auth.getPin(), p_key: id, p_delta: delta })
    .then(function (res) { return !!(res.data && res.data.ok); });
}

function invalidate() {
  dishes = null;
}

module.exports = {
  load,
  all,
  findDish,
  byCuisine,
  basesOf,
  groupsFor,
  cuisines,
  nextSort,
  save,
  setStatus,
  remove,
  move,
  invalidate,
  normalizeBundled,
  lastError: function () { return lastError; },
};
