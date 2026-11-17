const { appConfig } = require('./utils/config');
const menu = require('./utils/menu');

App({
  globalData: {
    appName: appConfig.appName,
    kitchenPin: appConfig.kitchenPin,
    subscribeTemplateId: appConfig.subscribeTemplateId,
    orderTable: appConfig.orderTable,
  },

  onLaunch: function () {
    // 菜单后台异步拉取，失败会用缓存/内置数据兜底
    menu.load();
  },
});
