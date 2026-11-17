// 云端环境配置（来自云服务 publicConfig，可随前端一起下发）
const publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  // 发布密钥由 utils/key-a|b|c 三份分片在运行时拼出，不在仓库里明文出现
  publishableKey: require('./key'),
  workBuddyOAuthClientId: 'cb_jq6QyEPkOkJXPcpz0JxS_wbapp_q54fquBB1s6WW7UGqbYa4y',
};

// 本地应用配置
const appConfig = {
  appName: 'Kitty的小食堂',
  // 显示在菜单管理页底部，用来判断手机上跑的是不是最新代码
  buildTag: 'v6 · 11-17 19:05',
  // 厨房口令已移到云端校验（见 utils/auth.js），代码里不再保留明文口令。
  // 要改口令：在数据库执行
  //   update app_secret set v = md5('新口令' || 'kitty-canteen-2026') where k = 'admin_pin_md5';
  // 微信订阅消息模板 ID：在微信公众平台「订阅消息」里申请后填这里，
  // 留空则只用 App 内厨房端看单，不影响下单。
  subscribeTemplateId: '',
  orderTable: 'orders',
  dishTable: 'dishes',
};

module.exports = { publicConfig, appConfig };
