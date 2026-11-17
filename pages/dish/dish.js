const menu = require('../../utils/menu');
const cart = require('../../utils/cart');

const SPICY = ['不辣', '微辣', '中辣', '重辣'];

Page({
  data: {
    dish: null,
    notFound: false,
    cartCount: 0,
  },

  onLoad: function (query) {
    this.dishId = query.id;
    this.render();
    const that = this;
    menu.load().then(function () {
      that.render();
    });
  },

  render: function () {
    const d = menu.findDish(this.dishId);
    if (!d) {
      this.setData({ notFound: true });
      return;
    }
    const ingredients = d.ingredients.map(function (ing) {
      return { name: ing.n, amount: ing.q + ing.u };
    });
    this.setData({
      dish: {
        id: d.id,
        name: d.name,
        initial: (d.name || '').charAt(0),
        img: d.img,
        desc: d.desc,
        calories: d.calories,
        minutes: d.minutes,
        tags: d.tags,
        spicyText: SPICY[d.spicy] || '不辣',
        spicy: d.spicy,
        ingredients: ingredients,
      },
    });
    wx.setNavigationBarTitle({ title: d.name });
  },

  onShow: function () {
    const s = cart.summary();
    this.setData({ cartCount: s.count });
  },

  onAdd: function () {
    if (!this.data.dish) return;
    cart.addItem(this.data.dish.id, 1);
    const s = cart.summary();
    this.setData({ cartCount: s.count });
    wx.showToast({ title: '已加入点单', icon: 'none', duration: 900 });
  },

  goCart: function () {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },
});
