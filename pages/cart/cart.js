const cart = require('../../utils/cart');
const { getDeviceId, getNickname, setNickname } = require('../../utils/identity');
const dateUtil = require('../../utils/date');
const { cloud } = require('../../utils/cloud');
const { appConfig } = require('../../utils/config');

const QUICK_NOTES = ['少辣', '不辣', '少油少盐', '不要香菜', '多放葱', '多加饭'].map(function (t) {
  return { t: t, on: false };
});

// 下单成功的花瓣：位置、延迟、时长、大小都随机，落下来才自然
function buildPetals() {
  const list = [];
  for (let i = 0; i < 14; i++) {
    const left = Math.round(Math.random() * 96);
    const delay = (Math.random() * 0.8).toFixed(2);
    const duration = (2.4 + Math.random() * 1.6).toFixed(2);
    const size = 14 + Math.round(Math.random() * 12);
    list.push({
      key: i,
      style:
        'left:' + left + '%;' +
        'animation-delay:' + delay + 's;' +
        'animation-duration:' + duration + 's;' +
        'width:' + size + 'rpx;' +
        'height:' + Math.round(size * 1.4) + 'rpx;',
    });
  }
  return list;
}

Page({
  data: {
    items: [],
    count: 0,
    calories: 0,
    needBase: false,
    quickNotes: QUICK_NOTES,
    picked: [],
    note: '',
    cookNow: true,
    timeValue: '18:30',
    showSuccess: false,
    petals: [],
    nickname: '',
    submitting: false,
  },

  onShow: function () {
    this.refresh();
    this.setData({ nickname: getNickname() });
  },

  refresh: function () {
    const s = cart.summary();
    let baseCount = 0;
    let sideCount = 0;
    s.items.forEach(function (it) {
      if (it.isBase) baseCount += it.qty;
      else if (it.cuisine === 'hotpot') sideCount += it.qty;
    });
    this.setData({
      items: s.items,
      count: s.count,
      calories: s.calories,
      needBase: sideCount > 0 && baseCount === 0,
    });
  },

  onPlus: function (e) {
    const id = e.currentTarget.dataset.id;
    let qty = 1;
    this.data.items.forEach(function (it) {
      if (it.id === id) qty = it.qty + 1;
    });
    cart.setQty(id, qty);
    this.refresh();
  },

  onMinus: function (e) {
    const id = e.currentTarget.dataset.id;
    let qty = 0;
    this.data.items.forEach(function (it) {
      if (it.id === id) qty = it.qty - 1;
    });
    cart.setQty(id, qty);
    this.refresh();
  },

  onPick: function (e) {
    const tag = e.currentTarget.dataset.tag;
    const notes = this.data.quickNotes.map(function (n) {
      if (n.t === tag) return { t: n.t, on: !n.on };
      return { t: n.t, on: n.on };
    });
    const picked = [];
    notes.forEach(function (n) { if (n.on) picked.push(n.t); });
    this.setData({ quickNotes: notes, picked: picked });
  },

  onNote: function (e) {
    this.setData({ note: e.detail.value });
  },

  onName: function (e) {
    this.setData({ nickname: e.detail.value });
  },

  onCookNow: function () {
    this.setData({ cookNow: true });
  },

  onBookTime: function () {
    this.setData({ cookNow: false });
  },

  onTimeChange: function (e) {
    this.setData({ timeValue: e.detail.value, cookNow: false });
  },

  buildNote: function () {
    const parts = this.data.picked.slice();
    const extra = (this.data.note || '').trim();
    if (extra) parts.push(extra);
    return parts.join('、');
  },

  buildMealTime: function () {
    if (this.data.cookNow) return null;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return y + '-' + pad(m) + '-' + pad(d) + 'T' + this.data.timeValue + ':00+08:00';
  },

  onSubmit: function () {
    if (this.data.submitting) return;
    if (this.data.items.length === 0) {
      wx.showToast({ title: '还没选菜呢', icon: 'none' });
      return;
    }
    const name = (this.data.nickname || '').trim();
    if (!name) {
      wx.showToast({ title: '先写个称呼吧', icon: 'none' });
      return;
    }
    setNickname(name);

    const items = this.data.items.map(function (it) {
      return { id: it.id, name: it.name, qty: it.qty, calories: it.calories };
    });

    const payload = {
      device_id: getDeviceId(),
      customer_name: name,
      items: items,
      note: this.buildNote(),
      cook_now: this.data.cookNow,
      meal_time: this.buildMealTime(),
      total_calories: this.data.calories,
    };

    const that = this;
    this.setData({ submitting: true });
    cloud.database
      .from(appConfig.orderTable)
      .insert(payload)
      .select()
      .then(function (res) {
        if (res.error) {
          that.setData({ submitting: false });
          wx.showModal({
            title: '没提交成功',
            content: '网络或服务出了点问题，稍后再点一次试试。',
            showCancel: false,
          });
          return;
        }
        cart.clear();
        that.setData({ submitting: false, showSuccess: true, petals: buildPetals() });
        wx.vibrateShort({ type: 'light', fail: function () {} });
        setTimeout(function () {
          wx.redirectTo({ url: '/pages/orders/orders' });
        }, 2400);
      })
      .catch(function () {
        that.setData({ submitting: false });
        wx.showModal({
          title: '没提交成功',
          content: '请检查网络后重试。',
          showCancel: false,
        });
      });
  },

  goHome: function () {
    wx.navigateBack();
  },
});
