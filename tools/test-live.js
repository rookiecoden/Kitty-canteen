// 真实后端冒烟测试：用 Node 版 SDK 走一遍 menu.js 的真实代码路径
// 注意：会写入线上 dishes 表（首次会灌入内置菜单）
const path = require('path');

const ROOT = path.join(__dirname, '..');
const store = { kitchen_pin_v1: '8888' };  // 写操作需要口令，这里是测试用
global.wx = {
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
};

const { createWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk');
const { publicConfig } = require(path.join(ROOT, 'utils', 'config.js'));
const realCloud = createWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  publishableKey: publicConfig.publishableKey,
});

const cloudPath = require.resolve(path.join(ROOT, 'utils', 'cloud.js'));
require.cache[cloudPath] = {
  id: cloudPath,
  filename: cloudPath,
  loaded: true,
  exports: { cloud: realCloud },
};

const menu = require(path.join(ROOT, 'utils', 'menu.js'));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ✓ ' + name); }
  else { fail += 1; console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + extra : '')); }
}

(async () => {
  console.log('1. 首次加载（空表应自动灌入内置菜单）');
  let list = await menu.load(true);
  check('拿到菜品', list.length >= 60, list.length);
  check('没有报错', !menu.lastError(), menu.lastError());

  console.log('2. 从云端重新读（应当读到刚写入的行）');
  menu.invalidate();
  list = await menu.load(true);
  check('重读数量一致', list.length >= 60, list.length);
  check('字段完整', !!(list[0] && list[0].id && list[0].cuisine && typeof list[0].calories === 'number'));

  console.log('3. 新增一道菜（upsert）');
  const probe = {
    id: '__probe-' + Date.now(),
    name: '探针菜',
    cuisine: 'home',
    group: 'stir',
    desc: '冒烟测试用',
    tags: ['测试'],
    calories: 123,
    minutes: 9,
    spicy: 1,
    img: '',
    ingredients: [{ n: '测试食材', q: 1, u: '份' }],
    status: 'on',
    sort: 9999,
    isBuiltin: false,
  };
  const saved = await menu.save(probe);
  check('写入无错误', !saved.error, saved.error && saved.error.message);

  menu.invalidate();
  await menu.load(true);
  const found = menu.findDish(probe.id);
  check('能读回新建的菜', !!found);
  check('字段正确', found && found.name === '探针菜' && found.calories === 123);

  console.log('4. 改状态（下架）');
  await menu.setStatus(probe.id, 'off');
  menu.invalidate();
  await menu.load(true);
  check('下架后前台看不到', !menu.byCuisine('home').some((d) => d.id === probe.id));
  check('管理端看得到', menu.all(true).some((d) => d.id === probe.id && d.status === 'off'));

  console.log('5. 排序交换');
  const before = menu.all(true)
    .filter((d) => d.cuisine === 'home' && d.group === 'stir')
    .sort((a, b) => a.sort - b.sort)
    .map((d) => d.id);
  if (before.length >= 2) {
    await menu.move(before[0], 1);
    menu.invalidate();
    await menu.load(true);
    const after = menu.all(true)
      .filter((d) => d.cuisine === 'home' && d.group === 'stir')
      .sort((a, b) => a.sort - b.sort)
      .map((d) => d.id);
    check('前两个位置对调了', after[0] === before[1] && after[1] === before[0], before.slice(0, 2) + ' → ' + after.slice(0, 2));
    // 换回来
    await menu.move(after[0], 1);
  } else {
    check('排序（数据不足，跳过）', true);
  }

  console.log('6. 清理探针数据');
  await menu.remove(probe.id);
  menu.invalidate();
  await menu.load(true);
  check('探针已删除', !menu.findDish(probe.id));

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
