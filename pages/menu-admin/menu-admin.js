const menu = require('../../utils/menu');
const { CUISINES } = require('../../data/dishes');
const { appConfig } = require('../../utils/config');

function clockText() {
  const d = new Date();
  const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

Page({
  data: {
    cuisines: CUISINES,
    active: 'home',
    list: [],
    total: 0,
    onCount: 0,
    loading: true,
    busy: false,
    refreshedAt: '',
    buildTag: appConfig.buildTag,
  },

  onLoad: function () {
    this.reload();
  },

  onShow: function () {
    if (!this.data.loading) this.reload();
  },

  reload: function () {
    const that = this;
    return menu.load(true).then(function () {
      that.build();
      that.setData({ loading: false });
    });
  },

  build: function () {
    const all = menu.all(true);
    const active = this.data.active;
    const gmap = { base: '锅底', '': '未分类' };
    menu.groupsFor(active).forEach(function (g) { gmap[g.id] = g.name; });

    const list = all
      .filter(function (d) { return d.cuisine === active; })
      .sort(function (a, b) { return a.sort - b.sort; })
      .map(function (d) {
        return {
          id: d.id,
          name: d.name,
          img: d.img,
          initial: (d.name || '').charAt(0),
          calories: d.calories,
          minutes: d.minutes,
          groupName: gmap[d.group] || '未分类',
          isOff: d.status === 'off',
          isBuiltin: d.isBuiltin,
        };
      });

    this.setData({
      list: list,
      total: all.length,
      onCount: all.filter(function (d) { return d.status !== 'off'; }).length,
      refreshedAt: clockText(),
    });
  },

  onCuisine: function (e) {
    this.setData({ active: e.currentTarget.dataset.id });
    this.build();
  },

  onToggle: function (e) {
    if (this.data.busy) return;
    const id = e.currentTarget.dataset.id;
    const next = e.currentTarget.dataset.off ? 'on' : 'off';
    const that = this;
    this.setData({ busy: true });
    menu.setStatus(id, next).then(function () {
      that.setData({ busy: false });
      that.reload();
      wx.showToast({ title: next === 'off' ? '已下架' : '已上架', icon: 'none', duration: 800 });
    }).catch(function () {
      that.setData({ busy: false });
      wx.showModal({
        title: '没改成',
        content: '这次没写进云端，检查下网络再试。',
        showCancel: false,
      });
    });
  },

  onMove: function (e) {
    if (this.data.busy) return;
    const id = e.currentTarget.dataset.id;
    const delta = Number(e.currentTarget.dataset.delta);
    const that = this;
    this.setData({ busy: true });
    menu.move(id, delta).then(function (ok) {
      that.setData({ busy: false });
      if (!ok) {
        wx.showToast({ title: '到头了', icon: 'none' });
        return;
      }
      that.reload();
    }).catch(function () {
      that.setData({ busy: false });
      wx.showModal({
        title: '顺序没调成',
        content: '这次没写进云端，检查下网络再试。',
        showCancel: false,
      });
    });
  },

  onEdit: function (e) {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit?id=' + e.currentTarget.dataset.id });
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit?cuisine=' + this.data.active });
  },

  onDelete: function (e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const that = this;
    wx.showModal({
      title: '删掉「' + name + '」',
      content: '删掉后家人就点不到了，已经下的单不受影响。',
      confirmText: '删掉',
      confirmColor: '#c96a7d',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        menu.remove(id).then(function (r) {
          wx.hideLoading();
          if (r && r.error) {
            wx.showToast({ title: '没删掉，重试下', icon: 'none' });
            return;
          }
          that.reload();
          wx.showToast({ title: '已删除', icon: 'none' });
        }).catch(function () {
          wx.hideLoading();
          wx.showToast({ title: '网络不太好', icon: 'none' });
        });
      },
    });
  },

  refresh: function () {
    const that = this;
    wx.showLoading({ title: '刷新中', mask: true });
    menu.load(true).then(function () {
      that.build();
      wx.hideLoading();
      wx.showToast({
        title: menu.lastError() ? '云端没连上，显示的是本地缓存' : '已是最新',
        icon: 'none',
        duration: 1400,
      });
    });
  },
});
