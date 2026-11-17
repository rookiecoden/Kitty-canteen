const { cloud } = require('../../utils/cloud');
const { appConfig } = require('../../utils/config');
const { getDeviceId } = require('../../utils/identity');
const dateUtil = require('../../utils/date');

const STATUS_TEXT = {
  pending: '等你接单',
  cooking: '正在做啦',
  served: '已上菜',
};

function formatOrder(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  const names = items.map(function (it) {
    return it.name + ' × ' + it.qty;
  });
  const created = new Date(row.created_at);
  let mealText = '现在就做';
  if (row.cook_now === false && row.meal_time) {
    mealText = '约 ' + dateUtil.timeOf(row.meal_time) + ' 开饭';
  }
  return {
    id: row.id,
    names: names,
    count: items.reduce(function (sum, it) { return sum + (it.qty || 0); }, 0),
    note: row.note || '',
    mealText: mealText,
    status: row.status || 'pending',
    statusText: STATUS_TEXT[row.status] || '等你接单',
    calories: row.total_calories || 0,
    createdText: dateUtil.hhmm(created),
    dayText: dateUtil.isToday(row.created_at) ? '今天' : dateUtil.todayText(created),
  };
}

Page({
  data: {
    orders: [],
    loading: true,
    failed: false,
  },

  onShow: function () {
    this.load();
  },

  onPullDownRefresh: function () {
    const that = this;
    this.load().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  load: function () {
    const that = this;
    this.setData({ loading: this.data.orders.length === 0, failed: false });
    return cloud.database
      .from(appConfig.orderTable)
      .select('*')
      .eq('device_id', getDeviceId())
      .order('created_at', { ascending: false })
      .limit(30)
      .then(function (res) {
        if (res.error) {
          that.setData({ loading: false, failed: true });
          return;
        }
        const list = (res.data || []).map(formatOrder);
        that.setData({ orders: list, loading: false, failed: false });
      })
      .catch(function () {
        that.setData({ loading: false, failed: true });
      });
  },

  goMenu: function () {
    wx.navigateBack();
  },

  retry: function () {
    this.load();
  },
});
