const menu = require('../../utils/menu');
const cart = require('../../utils/cart');
const dateUtil = require('../../utils/date');
const { lunarText } = require('../../utils/lunar');

const SPICY = ['不辣', '微辣', '中辣', '重辣'];
const MAX_BASE = 2;

function decorate(list) {
  return list.map(function (d) {
    const item = {};
    Object.keys(d).forEach(function (k) { item[k] = d[k]; });
    item.spicyText = SPICY[d.spicy] || '不辣';
    item.initial = (d.name || '').charAt(0);
    item.qty = 0;
    return item;
  });
}

function withAll(groups) {
  return [{ id: 'all', name: '全部' }].concat(groups);
}

Page({
  data: {
    cuisines: menu.cuisines(),
    activeCuisine: 'home',
    groups: withAll(menu.groupsFor('home')),
    activeGroup: 'all',
    shown: [],
    bases: [],
    isHotpot: false,
    baseCount: 0,
    baseHint: false,
    greeting: '',
    todayText: '',
    lunar: '',
    loading: true,
    failed: false,
    cartCount: 0,
    cartCal: 0,
  },

  onLoad: function () {
    const now = new Date();
    this.setData({
      greeting: dateUtil.greeting(now),
      todayText: dateUtil.todayText(now),
      lunar: lunarText(now),
    });
    this.hintedBase = false;
    this.applyCuisine('home');

    const that = this;
    menu.load().then(function () {
      that.setData({ loading: false, failed: !!menu.lastError() });
      that.applyCuisine(that.data.activeCuisine);
    });
  },

  onShow: function () {
    this.refreshCart();
  },

  onPullDownRefresh: function () {
    const that = this;
    menu.load(true).then(function () {
      that.applyCuisine(that.data.activeCuisine);
      wx.stopPullDownRefresh();
    });
  },

  applyCuisine: function (cuisineId, groupId) {
    const groups = menu.groupsFor(cuisineId);
    const activeGroup = groupId || 'all';
    this.setData({
      activeCuisine: cuisineId,
      activeGroup: activeGroup,
      groups: withAll(groups),
      shown: decorate(menu.byCuisine(cuisineId, activeGroup)),
      isHotpot: cuisineId === 'hotpot',
    });
    this.refreshCart();
  },

  refreshCart: function () {
    const s = cart.summary();
    const picked = {};
    let baseCount = 0;
    let sideCount = 0;
    s.items.forEach(function (it) {
      if (it.isBase) {
        picked[it.id] = it.qty;
        baseCount += it.qty;
      } else if (it.cuisine === 'hotpot') {
        sideCount += it.qty;
      }
    });

    const bases = decorate(menu.basesOf('hotpot')).map(function (b) {
      b.qty = picked[b.id] || 0;
      return b;
    });

    this.setData({
      cartCount: s.count,
      cartCal: s.calories,
      bases: bases,
      baseCount: baseCount,
      baseHint: sideCount > 0 && baseCount === 0,
    });
  },

  onCuisine: function (e) {
    this.applyCuisine(e.currentTarget.dataset.id);
  },

  onGroup: function (e) {
    this.applyCuisine(this.data.activeCuisine, e.currentTarget.dataset.id);
  },

  goDish: function (e) {
    wx.navigateTo({ url: '/pages/dish/dish?id=' + e.currentTarget.dataset.id });
  },

  onAdd: function (e) {
    const id = e.currentTarget.dataset.id;
    cart.addItem(id, 1);
    this.refreshCart();
    if (this.data.isHotpot && this.data.baseCount === 0 && !this.hintedBase) {
      this.hintedBase = true;
      wx.showToast({ title: '还没选锅底，就在上面', icon: 'none', duration: 1600 });
      return;
    }
    wx.showToast({ title: '已加入点单', icon: 'none', duration: 900 });
  },

  onAddBase: function (e) {
    const id = e.currentTarget.dataset.id;
    let qty = 0;
    this.data.bases.forEach(function (b) {
      if (b.id === id) qty = b.qty;
    });

    if (qty > 0) {
      cart.setQty(id, qty - 1);
      this.refreshCart();
      return;
    }
    if (this.data.baseCount >= MAX_BASE) {
      wx.showToast({ title: '两个锅底就够啦', icon: 'none' });
      return;
    }
    cart.addItem(id, 1);
    this.refreshCart();
  },

  goCart: function () {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  goOrders: function () {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  goKitchen: function () {
    wx.navigateTo({ url: '/pages/kitchen/kitchen' });
  },
});
