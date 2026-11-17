// 权限收紧验证：直连写应该被拒，带口令的 RPC 应该成功
const path = require('path');
const { createWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk');
const { publicConfig } = require(path.join(__dirname, '..', 'utils', 'config.js'));

const cloud = createWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  publishableKey: publicConfig.publishableKey,
});
const db = cloud.database;

const PIN = '8888';
const WRONG = '0000';
let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ✓ ' + name); }
  else { fail += 1; console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 160) : '')); }
}

(async () => {
  console.log('1. 直连写 dishes 应被拒绝');
  const direct = await db.from('dishes').update({ calories: 1 }).eq('dish_key', 'hong-shao-rou').select();
  check('直连 UPDATE 失败', !!direct.error || (Array.isArray(direct.data) && direct.data.length === 0), direct);

  console.log('2. 口令校验');
  const bad = await db.rpc('admin_check', { pin: WRONG });
  check('错口令返回 false', bad.error === null && bad.data === false, bad);
  const good = await db.rpc('admin_check', { pin: PIN });
  check('对口令返回 true', good.error === null && good.data === true, good);

  console.log('3. 带口令的菜单写操作');
  const probeKey = '__sec-' + Date.now();
  const payload = {
    id: probeKey,
    name: '权限测试菜',
    cuisine: 'home',
    group: 'stir',
    desc: '测试',
    tags: ['测试'],
    calories: 111,
    minutes: 5,
    spicy: 0,
    img: '',
    ingredients: [{ n: '测试', q: 1, u: '份' }],
    status: 'on',
    sort: 9998,
    isBuiltin: false,
  };

  const noPin = await db.rpc('admin_save_dish', { pin: WRONG, payload: payload });
  check('错口令写入被拒', !!noPin.error, noPin.error && noPin.error.message);

  const saved = await db.rpc('admin_save_dish', { pin: PIN, payload: payload });
  check('对口令写入成功', !saved.error, saved.error);

  const st = await db.rpc('admin_set_dish_status', { p_pin: PIN, p_key: probeKey, p_status: 'off' });
  check('下架成功', !st.error && st.data && st.data.ok === true, st);

  const rows = await db.from('dishes').select('status').eq('dish_key', probeKey);
  check('状态已落库', rows.data && rows.data[0] && rows.data[0].status === 'off', rows.data);

  const mv = await db.rpc('admin_move_dish', { p_pin: PIN, p_key: probeKey, p_delta: -1 });
  check('排序可调', !mv.error, mv);

  const del = await db.rpc('admin_delete_dish', { p_pin: PIN, p_key: probeKey });
  check('删除成功', !del.error && del.data && del.data.ok === true, del);

  const gone = await db.from('dishes').select('dish_key').eq('dish_key', probeKey);
  check('确实删掉了', gone.data && gone.data.length === 0, gone.data);

  console.log('4. 家人下单仍可直连插入');
  const order = await db.from('orders').insert({
    device_id: '__sec-test',
    customer_name: '权限测试',
    items: [{ id: 'hong-shao-rou', name: '红烧肉', qty: 1, calories: 480 }],
    note: '',
    cook_now: true,
    total_calories: 480,
  }).select();
  check('下单成功', !order.error && Array.isArray(order.data) && order.data.length === 1, order.error);
  const orderId = order.data && order.data[0] && order.data[0].id;

  console.log('5. 改订单状态必须带口令');
  const noPinOrder = await db.rpc('kitchen_set_order_status', { p_pin: WRONG, p_id: orderId, p_status: 'cooking' });
  check('错口令改状态被拒', !!noPinOrder.error, noPinOrder.error && noPinOrder.error.message);

  const withPin = await db.rpc('kitchen_set_order_status', { p_pin: PIN, p_id: orderId, p_status: 'cooking' });
  check('对口令改状态成功', !withPin.error && withPin.data && withPin.data.ok === true, withPin);

  console.log('6. 直连改订单状态应被拒绝');
  const directOrder = await db.from('orders').update({ status: 'served' }).eq('id', orderId).select();
  check('直连 UPDATE 订单失败', !!directOrder.error || (Array.isArray(directOrder.data) && directOrder.data.length === 0), directOrder);

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  if (orderId) console.log('（测试订单 id=' + orderId + '，可在厨房页删掉或忽略）');
  process.exit(fail ? 1 : 0);
})();
