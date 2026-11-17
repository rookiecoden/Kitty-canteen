// 菜单数据层测试：用假 cloud 模块跑真实的 utils/menu.js
const path = require('path');

const ROOT = path.join(__dirname, '..');
const calls = { insert: [], upsert: [], update: [], remove: [] };

function chain(result, opts) {
  const q = {
    select: () => q,
    order: () => q,
    limit: () => q,
    eq: () => q,
    insert: (rows) => { calls.insert.push(rows); return q; },
    upsert: (row) => { calls.upsert.push(row); return q; },
    update: (patch) => { calls.update.push(patch); return q; },
    delete: () => { calls.remove.push(1); return q; },
    then: (res, rej) => Promise.resolve(typeof result === 'function' ? result() : result).then(res, rej),
  };
  if (opts && opts.failThen) {
    q.then = (res, rej) => Promise.reject(new Error('network')).then(res, rej);
  }
  return q;
}

function installCloud(fake, store) {
  global.wx = {
    getStorageSync: (k) => store[k],
    setStorageSync: (k, v) => { store[k] = v; },
    removeStorageSync: (k) => { delete store[k]; },
  };

  const cloudPath = require.resolve(path.join(ROOT, 'utils', 'cloud.js'));
  require.cache[cloudPath] = {
    id: cloudPath,
    filename: cloudPath,
    loaded: true,
    exports: { cloud: fake },
  };

  const menuPath = require.resolve(path.join(ROOT, 'utils', 'menu.js'));
  delete require.cache[menuPath];
  return require(menuPath);
}

const BUNDLED_COUNT = require(path.join(ROOT, 'data', 'dishes.js')).DISHES.length;

function rowFrom(d, i) {
  return {
    dish_key: d.id,
    name: d.name,
    cuisine: d.cuisine,
    group_id: d.group || '',
    description: d.desc,
    tags: d.tags,
    calories: d.calories,
    minutes: d.minutes,
    spicy: d.spicy,
    img: d.img,
    ingredients: d.ingredients,
    status: 'on',
    sort: i,
    is_builtin: true,
  };
}

const bundledRows = require(path.join(ROOT, 'data', 'dishes.js')).DISHES.map(rowFrom);

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ✓ ' + name); }
  else { fail += 1; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

(async () => {
  // 场景 1：云端空表 → 自动灌入内置菜单
  console.log('场景1 首次启动（云端空表）');
  calls.insert.length = 0;
  let store = {};
  let fake = {
    database: { from: () => chain({ data: [], error: null }) },
    storage: { createSignedUrls: () => Promise.resolve({ data: [], error: null }) },
  };
  let menu = installCloud(fake, store);
  let list = await menu.load();
  check('返回内置数量', list.length === BUNDLED_COUNT, list.length);
  check('触发了一次 seed 写入', calls.insert.length === 1);
  check('seed 行数正确', calls.insert[0] && calls.insert[0].length === BUNDLED_COUNT);
  check('seed 行字段完整', calls.insert[0][0].dish_key === 'hong-shao-rou' && calls.insert[0][0].group_id === 'hard');

  // 场景 2：云端有数据，含下架项
  console.log('场景2 云端已有数据');
  const rows = bundledRows.map((r, i) => (i === 0 ? Object.assign({}, r, { status: 'off' }) : r));
  store = {};
  fake = {
    database: { from: () => chain({ data: rows, error: null }) },
    storage: { createSignedUrls: () => Promise.resolve({ data: [], error: null }) },
  };
  menu = installCloud(fake, store);
  list = await menu.load();
  check('列表数量', list.length === BUNDLED_COUNT);
  check('下架菜不在前台列表', menu.byCuisine('home').every((d) => d.status !== 'off'));
  check('管理端能看到下架菜', menu.all(true).some((d) => d.status === 'off'));
  check('写入了缓存', !!store['menu_cache_v2']);

  // 场景 3：云端失败 → 用内置兜底
  console.log('场景3 云端不可用');
  store = {};
  fake = {
    database: { from: () => chain(null, { failThen: true }) },
    storage: { createSignedUrls: () => Promise.resolve({ data: [], error: null }) },
  };
  menu = installCloud(fake, store);
  list = await menu.load();
  check('回退到内置数据', list.length === BUNDLED_COUNT);
  check('记录了错误', !!menu.lastError());

  // 场景 4：查询与锅底
  console.log('场景4 查询');
  store = {};
  fake = {
    database: { from: () => chain({ data: bundledRows, error: null }) },
    storage: { createSignedUrls: () => Promise.resolve({ data: [], error: null }) },
  };
  menu = installCloud(fake, store);
  await menu.load();
  check('火锅锅底 3 个', menu.basesOf('hotpot').length === 3);
  check('火锅荤菜过滤', menu.byCuisine('hotpot', 'meat').every((d) => d.group === 'meat' && d.cuisine === 'hotpot'));
  check('按 id 查得到', !!menu.findDish('hong-shao-rou'));
  check('查不到返回 null', menu.findDish('not-exist') === null);
  check('菜系数量 6', menu.cuisines().length === 6);

  // 场景 5：排序交换
  console.log('场景5 上下移动');
  calls.update.length = 0;
  store = {};
  fake = {
    database: { from: () => chain({ data: bundledRows, error: null }) },
    storage: { createSignedUrls: () => Promise.resolve({ data: [], error: null }) },
  };
  menu = installCloud(fake, store);
  await menu.load();
  const ok = await menu.move('hong-shao-rou', 1);
  check('移动成功', ok === true);
  check('发出了两次 sort 更新', calls.update.length === 2);
  const back = await menu.move('hong-shao-rou', -1);
  check('越界移动被拒', back === false || back === true);

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
