const menu = require('../../utils/menu');
const { CUISINES } = require('../../data/dishes');
const auth = require('../../utils/auth');

const SPICY = ['不辣', '微辣', '中辣', '重辣'];
const MAX_EDGE = 420; // 长边压到这个尺寸，base64 后约 25-35KB
const JPEG_QUALITY = 0.68;
const MAX_BASE64 = 380 * 1024; // 超过这个就先不配图，避免把菜单撑爆

function parseIngredients(text) {
  return String(text || '')
    .split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; })
    .map(function (l) {
      const m = l.match(/^(.+?)[\s，,]+([\d.]+)\s*([a-zA-Z\u4e00-\u9fa5]*)$/);
      if (!m) return { n: l, q: 0, u: '' };
      return { n: m[1].trim(), q: Number(m[2]) || 0, u: m[3] || '' };
    });
}

function stringifyIngredients(list) {
  return (list || []).map(function (i) { return i.n + ' ' + i.q + (i.u || ''); }).join('\n');
}

function getImageInfo(src) {
  return new Promise(function (resolve, reject) {
    wx.getImageInfo({ src: src, success: resolve, fail: reject });
  });
}

function readBase64(filePath) {
  return new Promise(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (res) { resolve(res.data); },
      fail: reject,
    });
  });
}

// 用隐藏 canvas 把图缩到长边 MAX_EDGE，再转成 data URI
function shrinkToDataUri(filePath) {
  return getImageInfo(filePath).then(function (info) {
    const scale = Math.min(1, MAX_EDGE / Math.max(info.width, info.height));
    const w = Math.max(1, Math.round(info.width * scale));
    const h = Math.max(1, Math.round(info.height * scale));

    return new Promise(function (resolve, reject) {
      wx.createSelectorQuery()
        .select('#shrinker')
        .fields({ node: true, size: true })
        .exec(function (res) {
          const canvas = res && res[0] && res[0].node;
          if (!canvas) {
            reject(new Error('no canvas'));
            return;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const img = canvas.createImage();
          img.onload = function () {
            ctx.drawImage(img, 0, 0, w, h);
            wx.canvasToTempFilePath({
              canvas: canvas,
              x: 0,
              y: 0,
              width: w,
              height: h,
              destWidth: w,
              destHeight: h,
              fileType: 'jpg',
              quality: JPEG_QUALITY,
              success: function (r) {
                readBase64(r.tempFilePath)
                  .then(function (b64) { resolve('data:image/jpeg;base64,' + b64); })
                  .catch(reject);
              },
              fail: reject,
            });
          };
          img.onerror = reject;
          img.src = filePath;
        });
    });
  });
}

// 兜底：canvas 不可用时直接用微信压缩，再读 base64
function compressToDataUri(filePath) {
  return new Promise(function (resolve, reject) {
    if (!wx.compressImage) {
      reject(new Error('no compress'));
      return;
    }
    wx.compressImage({
      src: filePath,
      quality: 30,
      success: function (r) {
        readBase64(r.tempFilePath)
          .then(function (b64) { resolve('data:image/jpeg;base64,' + b64); })
          .catch(reject);
      },
      fail: reject,
    });
  });
}

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    let done = false;
    const timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error('timeout'));
    }, ms);
    promise.then(function (v) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }, function (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    });
  });
}

Page({
  data: {
    isNew: true,
    id: '',
    name: '',
    desc: '',
    calories: '',
    minutes: '',
    tagsText: '',
    ingText: '',
    cuisines: CUISINES,
    cuisine: 'home',
    groupOptions: [],
    group: '',
    spicyOptions: SPICY.map(function (n, i) { return { v: i, n: n }; }),
    spicyIndex: 0,
    img: '',
    pickedImage: '',
    saving: false,
  },

  onLoad: function (query) {
    const that = this;
    menu.load().then(function () {
      if (query.id) {
        that.fill(query.id);
      } else {
        that.setData({ isNew: true });
        that.pickCuisine(query.cuisine || CUISINES[0].id, '');
      }
    });
  },

  fill: function (id) {
    const d = menu.findDish(id);
    if (!d) return;
    this.setData({
      isNew: false,
      id: d.id,
      name: d.name,
      desc: d.desc,
      calories: String(d.calories),
      minutes: String(d.minutes),
      tagsText: (d.tags || []).join('、'),
      ingText: stringifyIngredients(d.ingredients),
      spicyIndex: d.spicy || 0,
      img: d.img,
      isBuiltin: d.isBuiltin,
      sort: d.sort,
    });
    this.pickCuisine(d.cuisine, d.group);
  },

  pickCuisine: function (cuisine, group) {
    // 火锅的「锅底」不在常规分类里，但编辑时不能丢，这里补上
    const groups = menu.groupsFor(cuisine);
    const base = cuisine === 'hotpot' ? [{ id: 'base', name: '锅底' }] : [];
    const options = [{ id: '', name: '不分类' }].concat(base).concat(groups);
    const has = options.some(function (o) { return o.id === (group || ''); });
    this.setData({
      cuisine: cuisine,
      groupOptions: options,
      group: has ? (group || '') : '',
    });
  },

  onPickCuisine: function (e) {
    this.pickCuisine(e.currentTarget.dataset.id, '');
  },

  onPickGroup: function (e) {
    this.setData({ group: e.currentTarget.dataset.id });
  },

  onPickSpicy: function (e) {
    this.setData({ spicyIndex: Number(e.currentTarget.dataset.v) });
  },

  onInput: function (e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = e.detail.value;
    this.setData(patch);
  },

  onPickImage: function () {
    const that = this;
    const apply = function (path) {
      if (!path) return;
      that.setData({ pickedImage: path, img: path });
    };

    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: function (res) {
          const file = res.tempFiles && res.tempFiles[0];
          apply(file && file.tempFilePath);
        },
      });
      return;
    }

    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: function (res) {
          apply(res.tempFilePaths && res.tempFilePaths[0]);
        },
      });
      return;
    }

    wx.showModal({
      title: '这个环境选不了图',
      content: '选图需要真机。可以先保存菜品，回头在手机上补一张图。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onSave: function () {
    if (this.data.saving) return;
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '先写个菜名', icon: 'none' });
      return;
    }

    const that = this;
    const key = this.data.id || 'dish-' + Date.now().toString(36);

    const persist = function (img) {
      const payload = {
        id: key,
        name: name,
        cuisine: that.data.cuisine,
        group: that.data.group,
        desc: (that.data.desc || '').trim(),
        tags: (that.data.tagsText || '')
          .split(/[、,，\s]+/)
          .map(function (t) { return t.trim(); })
          .filter(function (t) { return t.length > 0; }),
        calories: Number(that.data.calories) || 0,
        minutes: Number(that.data.minutes) || 0,
        spicy: that.data.spicyIndex,
        img: img,
        ingredients: parseIngredients(that.data.ingText),
        status: 'on',
        sort: that.data.isNew ? menu.nextSort(that.data.cuisine, that.data.group) : that.data.sort,
        isBuiltin: that.data.isNew ? false : that.data.isBuiltin === true,
      };

      that.setData({ saving: true });
      // 包一层，保证任何同步异常也能走到 catch，不会卡在「保存中」
      Promise.resolve()
        .then(function () { return menu.save(payload); })
        .then(function () {
          menu.invalidate();
          wx.showToast({ title: '存好了', icon: 'success', duration: 900 });
          setTimeout(function () { wx.navigateBack(); }, 700);
        })
        .catch(function (err) {
          that.setData({ saving: false });
          if (auth.isPinError(err)) {
            auth.clearPin();
            wx.showModal({
              title: '口令失效了',
              content: '回厨房页重新输入口令，再进来就能保存。',
              showCancel: false,
              success: function () { wx.navigateBack(); },
            });
            return;
          }
          wx.showModal({
            title: '没存上',
            content: '菜品没有保存：' + ((err && err.message) || '服务没响应') + '。再试一次？',
            showCancel: false,
            confirmText: '知道了',
          });
        });
    };

    // 没换图就直接用原来的
    if (!this.data.pickedImage) {
      persist(this.data.img);
      return;
    }

    wx.showLoading({ title: '处理图片', mask: true });
    withTimeout(
      shrinkToDataUri(this.data.pickedImage).catch(function () {
        return compressToDataUri(that.data.pickedImage);
      }),
      25000
    ).then(function (dataUri) {
      wx.hideLoading();
      if (dataUri.length > MAX_BASE64) {
        wx.showModal({
          title: '这张图压不下来',
          content: '换一张小一点的，或者先不配图保存。',
          confirmText: '不配图保存',
          cancelText: '我再选一张',
          success: function (r) {
            if (r.confirm) persist(that.data.isNew ? '' : that.data.img);
          },
        });
        return;
      }
      persist(dataUri);
    }).catch(function () {
      wx.hideLoading();
      wx.showModal({
        title: '图片没处理成功',
        content: '可以先不配图保存，回头再补一张。',
        confirmText: '不配图保存',
        cancelText: '再试一次',
        success: function (r) {
          if (r.confirm) persist(that.data.isNew ? '' : that.data.img);
        },
      });
    });
  },
});
