const { cloud } = require('../../utils/cloud');
const { appConfig } = require('../../utils/config');
const { findDish } = require('../../utils/menu');
const auth = require('../../utils/auth');
const dateUtil = require('../../utils/date');

const UNLOCK_KEY = 'kitchen_unlocked_v1';

const NEXT_ACTION = {
  pending: { label: '接单开做', next: 'cooking' },
  cooking: { label: '已上菜', next: 'served' },
  served: { label: '已完成', next: '' },
};

function buildShopping(orders) {
  const map = {};
  orders.forEach(function (o) {
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach(function (it) {
      const dish = findDish(it.id);
      if (!dish) return;
      dish.ingredients.forEach(function (ing) {
        const key = ing.n + '|' + ing.u;
        if (!map[key]) map[key] = { name: ing.n, unit: ing.u, qty: 0 };
        map[key].qty += ing.q * (it.qty || 1);
      });
    });
  });
  return Object.keys(map).map(function (k) {
    const r = map[k];
    let amount = r.qty + r.unit;
    if ((r.unit === 'g' || r.unit === 'ml') && r.qty >= 1000) {
      const v = Math.round((r.qty / 1000) * 10) / 10;
      amount = v + (r.unit === 'g' ? 'kg' : 'L');
    }
    return { name: r.name, amount: amount };
  });
}

function formatOrder(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  const status = row.status || 'pending';
  const action = NEXT_ACTION[status] || NEXT_ACTION.pending;
  let mealText = '现在就做';
  if (row.cook_now === false && row.meal_time) {
    mealText = '约 ' + dateUtil.timeOf(row.meal_time) + ' 开饭';
  }
  return {
    id: row.id,
    who: row.customer_name || '家人',
    lines: items.map(function (it) { return it.name + ' × ' + it.qty; }),
    note: row.note || '',
    mealText: mealText,
    status: status,
    statusText: (dateUtil.STATUS[status] || dateUtil.STATUS.pending).short,
    actionLabel: action.label,
    nextStatus: action.next,
    calories: row.total_calories || 0,
    createdText: dateUtil.hhmm(new Date(row.created_at)),
    raw: row,
  };
}

Page({
  data: {
    unlocked: false,
    pinInput: '',
    pinError: '',
    tab: 'orders',
    orders: [],
    shop: [],
    loading: false,
    failed: false,
    pendingCount: 0,
    totalDishes: 0,
  },

  onLoad: function () {
    const unlocked = wx.getStorageSync(UNLOCK_KEY) === true;
    this.setData({ unlocked: unlocked });
    if (unlocked) this.load();
  },

  onShow: function () {
    if (this.data.unlocked) {
      this.load();
      this.startTimer();
    }
  },

  onHide: function () {
    this.stopTimer();
  },

  onUnload: function () {
    this.stopTimer();
  },

  startTimer: function () {
    this.stopTimer();
    const that = this;
    this.timer = setInterval(function () {
      that.load(true);
    }, 25000);
  },

  stopTimer: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  onPin: function (e) {
    this.setData({ pinInput: e.detail.value, pinError: '' });
  },

  onUnlock: function () {
    const pin = (this.data.pinInput || '').trim();
    if (!pin) {
      this.setData({ pinError: '先输个口令' });
      return;
    }
    const that = this;
    wx.showLoading({ title: '核对中', mask: true });
    cloud.database.rpc('admin_check', { pin: pin }).then(function (res) {
      wx.hideLoading();
      if (res.error) {
        that.setData({ pinError: '网络不太好，再试一次' });
        return;
      }
      if (res.data !== true) {
        that.setData({ pinError: '口令不对，再想想' });
        return;
      }
      auth.setPin(pin);
      wx.setStorageSync(UNLOCK_KEY, true);
      that.setData({ unlocked: true, pinError: '', pinInput: '' });
      that.load();
      that.startTimer();
    }).catch(function () {
      wx.hideLoading();
      that.setData({ pinError: '网络不太好，再试一次' });
    });
  },

  switchTab: function (e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  load: function (silent) {
    const that = this;
    const start = dateUtil.startOfToday();
    const isoStart = start.toISOString();
    if (!silent) this.setData({ loading: this.data.orders.length === 0, failed: false });
    return cloud.database
      .from(appConfig.orderTable)
      .select('*')
      .gte('created_at', isoStart)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(function (res) {
        if (res.error) {
          that.setData({ loading: false, failed: true });
          return;
        }
        const rows = res.data || [];
        const list = rows.map(formatOrder);
        let pending = 0;
        let dishes = 0;
        list.forEach(function (o) {
          if (o.status === 'pending') pending += 1;
          dishes += o.lines.length;
        });
        const prevPending = that.data.pendingCount;
        that.setData({
          orders: list,
          shop: buildShopping(rows),
          pendingCount: pending,
          totalDishes: dishes,
          loading: false,
          failed: false,
        });
        if (silent && prevPending > 0 && pending > prevPending) {
          wx.showToast({ title: '有新订单来了', icon: 'none' });
        }
      })
      .catch(function () {
        that.setData({ loading: false, failed: true });
      });
  },

  advance: function (e) {
    const id = e.currentTarget.dataset.id;
    const next = e.currentTarget.dataset.next;
    if (!next) return;
    const that = this;
    wx.showLoading({ title: '更新中', mask: true });
    cloud.database
      .rpc('kitchen_set_order_status', { p_pin: auth.getPin(), p_id: Number(id), p_status: next })
      .then(function (res) {
        wx.hideLoading();
        if (res.error) {
          wx.showToast({ title: '没更新成功，重试下', icon: 'none' });
          return;
        }
        if (!res.data || res.data.ok !== true) {
          wx.showToast({ title: '没更新成功，重试下', icon: 'none' });
          return;
        }
        that.load();
      })
      .catch(function (err) {
        wx.hideLoading();
        if (auth.isPinError(err)) {
          auth.clearPin();
          wx.setStorageSync(UNLOCK_KEY, false);
          that.setData({ unlocked: false, pinError: '口令过期了，重新输一下' });
          return;
        }
        wx.showToast({ title: '网络不太好', icon: 'none' });
      });
  },

  copyShop: function () {
    if (this.data.shop.length === 0) {
      wx.showToast({ title: '还没有菜要买', icon: 'none' });
      return;
    }
    const lines = this.data.shop.map(function (s) {
      return '· ' + s.name + ' ' + s.amount;
    });
    const text = '买菜清单（' + dateUtil.todayText() + '）\n' + lines.join('\n');
    wx.setClipboardData({
      data: text,
      success: function () {
        wx.showToast({ title: '清单已复制', icon: 'success' });
      },
    });
  },

  refresh: function () {
    this.load();
  },

  goMenuAdmin: function () {
    wx.navigateTo({ url: '/pages/menu-admin/menu-admin' });
  },

  lock: function () {
    wx.removeStorageSync(UNLOCK_KEY);
    auth.clearPin();
    this.stopTimer();
    this.setData({ unlocked: false, pinInput: '' });
  },
});
