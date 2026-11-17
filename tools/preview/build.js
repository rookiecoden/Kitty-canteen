// 把 WXSS + 页面结构转成可在浏览器里看效果的 HTML（仅用于设计自查，不进入小程序包）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = __dirname;

function wxssToCss(files) {
  let css = files
    .map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); })
    .join('\n');
  // rpx -> px（375 宽视口下 1rpx = 0.5px）
  css = css.replace(/(-?\d+\.?\d*)rpx/g, function (_, n) {
    return (parseFloat(n) / 2).toFixed(2).replace(/\.00$/, '') + 'px';
  });
  css = css.replace(/^page\s*\{/m, '.phone {');
  css = css.replace(/,\s*image\s*,/g, ', img,').replace(/\bimage\s*\{/g, 'img {');
  return css;
}

const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #efe7e4; display: block; padding: 0; overflow-x: hidden; }
  view { display: block; }
  text { display: inline; }
  img { display: inline-block; object-fit: cover; }
  input, textarea { display: block; width: 100%; border: none; outline: none; background: transparent;
    font-family: inherit; resize: none; }
  .phone { position: relative; width: 375px; margin: 0; min-height: 700px; overflow: hidden; }
  .navmock { height: 44px; display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 600; color: #43333a; background: #fdf7f4; }
  /* 预览专用：真机里是 fixed 吸底，这里改成常规流，方便静态截图 */
  .cartbar { position: static !important; margin: 18px 13px 0; }
  .bottom, .bottom-bar { position: static !important; margin-top: 18px; }
  .dish, .ticket { animation: none !important; opacity: 1 !important; transform: none !important; }
  .twinkle { animation: none !important; }
  /* 成功页静态截图：花瓣停在半空，卡片直接显示 */
  .petal { animation-play-state: paused !important; }
  .success, .success-card { animation: none !important; }
`;

function page(title, navTitle, bodyHtml, cssFiles) {
  const css = wxssToCss(cssFiles);
  const diag = `
<script>
window.addEventListener('load', function () {
  var w = document.documentElement.clientWidth;
  var bad = [];
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var r = all[i].getBoundingClientRect();
    if (r.width > 0 && r.right > w + 0.5) {
      bad.push((all[i].className || all[i].tagName) + ' -> ' + Math.round(r.right));
    }
  }
  var pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;color:#c00;' +
    'font:11px monospace;padding:4px;white-space:pre-wrap;max-width:100%';
  pre.textContent = 'viewport=' + w + ' overflow=' + bad.length + '\\n' + bad.slice(0, 6).join('\\n');
  document.body.appendChild(pre);
});
</script>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>${BASE}${css}</style></head>
<body><div class="phone">
  <div class="navmock">${navTitle}</div>
  ${bodyHtml}
</div>${diag}</body></html>`;
}

const IMG = '../../images/dish/';

const dishCard = (name, cal, desc, minutes, spicyCls, spicyText, img, tags, delay) => `
    <view class="dish" style="animation-delay:${delay}ms">
      <view class="frame">${
        img
          ? `<img class="dish-img" src="${IMG}${img}.jpg" />`
          : `<view class="dish-img img-ph">${name.charAt(0)}</view>`
      }</view>
      <view class="dish-body">
        <view class="dish-head">
          <text class="dish-name serif">${name}</text>
          <text class="cal-chip">${cal} kcal</text>
        </view>
        <view class="dish-desc">${desc}</view>
        <view class="dish-tags">${tags.map(t => `<text class="tag">${t}</text>`).join('')}</view>
        <view class="dish-foot">
          <text class="meta">${minutes} 分钟</text>
          <text class="dot">·</text>
          <text class="${spicyCls}">${spicyText}</text>
          <view class="add">+</view>
        </view>
      </view>
    </view>`;

const crown = `<view class="crown"><view class="crown-p"></view><view class="crown-p mid"></view><view class="crown-p"></view><view class="crown-base"></view></view>`;

const menu = `
<view class="page">
  <view class="hero">
    <view class="hero-glow"></view>

    <view class="hero-bar">
      <view class="ribbon">今日 · 农历十月初九</view>
      <view class="hero-actions">
        <view class="pill">我的点单</view>
        <view class="pill ghost">厨房</view>
      </view>
    </view>

    <view class="kicker">
      ${crown}
      <text>Kitty的小食堂</text>
      ${crown}
    </view>

    <view class="title serif">今天想吃<text class="title-accent">什么</text></view>
    <view class="title-underline"></view>
    <view class="sub">下午好 · 11月17日 周二</view>
  </view>

  <view class="cuisines">
    <view class="cuisine"><view class="cuisine-name serif">家常炒菜</view><view class="cuisine-tag">四菜一汤</view></view>
    <view class="cuisine on"><view class="cuisine-name serif">火锅</view><view class="cuisine-tag">锅底 + 涮菜</view></view>
    <view class="cuisine"><view class="cuisine-name serif">烧烤</view><view class="cuisine-tag">一把串儿</view></view>
    <view class="cuisine"><view class="cuisine-name serif">面点主食</view><view class="cuisine-tag">管饱</view></view>
  </view>

  <view class="cats">
    <view class="cat tilt-l on">全部</view>
    <view class="cat tilt-r">荤菜</view>
    <view class="cat tilt-l">素菜</view>
    <view class="cat tilt-r">菌菇豆制品</view>
    <view class="cat tilt-l">主食</view>
  </view>

  <view class="base-block">
    <view class="base-head">
      <view class="base-title">
        <text class="base-step">第 1 步</text>
        <text class="base-name">先挑锅底</text>
      </view>
      <view class="base-meta">已选 1 个</view>
    </view>
    <view class="base-list">
      <view class="base-card on">
        <view class="base-frame">
          <img class="base-img" src="${IMG}hotpot-base-mala.jpg" />
          <view class="base-badge">×1</view>
        </view>
        <view class="base-cname serif">麻辣牛油锅底</view>
        <view class="base-cmeta">900 kcal · 重辣</view>
      </view>
      <view class="base-card">
        <view class="base-frame"><img class="base-img" src="${IMG}hotpot-base-tomato.jpg" /></view>
        <view class="base-cname serif">番茄锅底</view>
        <view class="base-cmeta">620 kcal · 不辣</view>
      </view>
      <view class="base-card">
        <view class="base-frame"><img class="base-img" src="${IMG}hotpot-base-mushroom.jpg" /></view>
        <view class="base-cname serif">菌汤锅底</view>
        <view class="base-cmeta">380 kcal · 不辣</view>
      </view>
    </view>
  </view>

  <view class="list">
    <view class="sec-title">第 2 步 · 挑涮菜<text class="sec-more">共 10 道 · 点卡片看食材</text></view>
    ${dishCard('肥牛卷', 520, '下锅十秒就捞，粉了才嫩', 2, 'spicy-empty', '不辣', 'hotpot-beef-roll', ['必点', '涮十秒'], 0)}
    ${dishCard('毛肚', 150, '七上八下，脆得能听见声', 1, 'spicy', '微辣', 'hotpot-tripe', ['爽脆', '七上八下'], 45)}
    ${dishCard('冻豆腐', 180, '蜂窝里全是汤，咬一口爆汁', 4, 'spicy-empty', '不辣', 'hotpot-frozen-tofu', ['爆汁', '必点'], 90)}
  </view>

  <view class="cartbar">
    <view class="cartbar-ribbon">🎀</view>
    <view class="cartbar-info">
      <view class="cartbar-count">已点 4 道</view>
      <view class="cartbar-cal">合计约 1750 kcal</view>
    </view>
    <view class="cartbar-btn">去点单</view>
  </view>
</view>`;

const orderTicket = (day, time, status, statusText, lines, note, meal, count, cal, no) => `
  <view class="ticket">
    <view class="ticket-top">
      <view class="when"><text class="when-day serif">${day}</text><text class="when-time">${time} 下单</text></view>
      <view class="stamp ${status}">${statusText}</view>
    </view>
    <view class="tear"></view>
    <view class="dashes">
      ${lines.map(l => `<view class="dash-line"><text class="dash-star">✦</text><text class="dash-text">${l}</text></view>`).join('')}
    </view>
    ${note ? `<view class="note"><text class="note-quote">「</text>${note}<text class="note-quote">」</text></view>` : ''}
    <view class="ticket-foot">
      <text class="meal">${meal}</text>
      <text class="cal">共 ${count} 份 · 约 ${cal} kcal</text>
    </view>
    <view class="ticket-no">No.${no}</view>
  </view>`;

const orders = `
<view class="page">
  <view class="head">
    <view class="head-kicker"><text class="kicker-star">✦</text><text>点单小票</text></view>
    <view class="head-title serif">我的单子</view>
  </view>
  <view class="tip">下拉刷新，看大厨做到哪一步了</view>
  ${orderTicket('今天', '11:32', 'cooking', '烹饪中', ['红烧肉 × 1', '番茄炒蛋 × 2'], '少辣、多加饭', '约 18:30 开饭', 3, 920, 12)}
  ${orderTicket('今天', '09:15', 'pending', '待接单', ['紫菜蛋花汤 × 1'], '', '现在就做', 1, 60, 11)}
  ${orderTicket('昨天', '18:40', 'served', '已上菜', ['糖醋排骨 × 1', '蒜蓉西兰花 × 1', '蛋炒饭 × 1'], '不要香菜', '约 19:00 开饭', 3, 1120, 9)}
</view>`;

const kitchen = `
<view class="page">
  <view class="head">
    <view class="head-left">
      <view class="head-kicker"><text class="kicker-star">✦</text><text>大厨的工作台</text></view>
      <view class="head-title serif">今天的单子</view>
      <view class="head-meta">3 单 · 7 道菜</view>
    </view>
    <view class="head-right">
      <view class="pending">1 单待接</view>
      <view class="lock">锁上</view>
    </view>
  </view>

  <view class="tabs">
    <view class="tab on">点单</view>
    <view class="tab">买菜清单</view>
  </view>

  <view class="order">
    <view class="order-head">
      <view class="who-wrap"><text class="who serif">公主殿下</text><text class="when">11:32</text></view>
      <view class="stamp pending">待接单</view>
    </view>
    <view class="dash"></view>
    <view class="lines">
      <view class="line"><text class="line-star">✦</text><text class="line-text">红烧肉 × 1</text></view>
      <view class="line"><text class="line-star">✦</text><text class="line-text">番茄炒蛋 × 2</text></view>
    </view>
    <view class="note">「少辣、多加饭」</view>
    <view class="order-foot">
      <view class="meal">约 18:30 开饭 · 约 920 kcal</view>
      <view class="act">接单开做</view>
    </view>
  </view>

  <view class="order">
    <view class="order-head">
      <view class="who-wrap"><text class="who serif">小满</text><text class="when">09:15</text></view>
      <view class="stamp served">已上菜</view>
    </view>
    <view class="dash"></view>
    <view class="lines">
      <view class="line"><text class="line-star">✦</text><text class="line-text">紫菜蛋花汤 × 1</text></view>
    </view>
    <view class="order-foot">
      <view class="meal">现在就做 · 约 60 kcal</view>
      <view class="act done">已完成</view>
    </view>
  </view>

  <view class="shop-head">
    <view class="sec-title no-mb">照着买就行</view>
    <view class="copy">复制清单</view>
  </view>
  <view class="sheet shop">
    <view class="tape"></view>
    <view class="shop-row"><text class="shop-name">五花肉</text><view class="leader"></view><text class="shop-amt serif">1.2kg</text></view>
    <view class="shop-row"><text class="shop-name">番茄</text><view class="leader"></view><text class="shop-amt serif">4个</text></view>
    <view class="shop-row"><text class="shop-name">鸡蛋</text><view class="leader"></view><text class="shop-amt serif">10个</text></view>
    <view class="shop-row"><text class="shop-name">冰糖</text><view class="leader"></view><text class="shop-amt serif">40g</text></view>
  </view>
  <view class="shop-tip">已按今天所有订单合并去重</view>
</view>`;

const cartPage = `
<view class="page">
  <view class="intro">
    <view class="intro-kicker"><text class="kicker-star">✦</text><text>确认菜单</text></view>
    <view class="intro-title serif">就这么定啦</view>
    <view class="intro-sub">写清口味和时间，大厨照着做</view>
  </view>

  <view class="block">
    <view class="sec-title">你点的菜<text class="sec-more">共 3 道</text></view>
    <view class="sheet items">
      <view class="item">
        <view class="item-frame"><img class="item-img" src="${IMG}hotpot-base-mala.jpg" /></view>
        <view class="item-body">
          <view class="item-name serif">麻辣牛油锅底<text class="base-tag">锅底</text></view>
          <view class="item-cal">900 kcal / 份 · 小计 900</view>
        </view>
        <view class="stepper">
          <view class="step-btn minus">−</view>
          <text class="step-num serif">1</text>
          <view class="step-btn plus">+</view>
        </view>
      </view>
      <view class="item">
        <view class="item-frame"><img class="item-img" src="${IMG}hong-shao-rou.jpg" /></view>
        <view class="item-body">
          <view class="item-name serif">红烧肉</view>
          <view class="item-cal">480 kcal / 份 · 小计 480</view>
        </view>
        <view class="stepper">
          <view class="step-btn minus">−</view>
          <text class="step-num serif">1</text>
          <view class="step-btn plus">+</view>
        </view>
      </view>
      <view class="dash items-dash"></view>
      <view class="items-foot">
        <text class="items-foot-label">合计约</text>
        <text class="items-foot-num serif">1880</text>
        <text class="items-foot-unit">kcal</text>
      </view>
    </view>
  </view>

  <view class="block">
    <view class="sec-title">口味备注</view>
    <view class="sheet pad">
      <view class="tape"></view>
      <view class="chips">
        <view class="chip tilt-l chip-on">少辣</view>
        <view class="chip tilt-r">不辣</view>
        <view class="chip tilt-l">少油少盐</view>
        <view class="chip tilt-r chip-on">多加饭</view>
        <view class="chip tilt-l">不要香菜</view>
      </view>
      <view class="dash note-dash"></view>
      <view class="note-input" style="color:#c5b3b6">还想说什么？比如「肉切小一点」「米饭少一半」</view>
    </view>
  </view>

  <view class="block">
    <view class="sec-title">什么时候吃</view>
    <view class="sheet pad">
      <view class="time-row">
        <view class="time-radio"></view>
        <view class="time-text">
          <view class="time-main">现在就做</view>
          <view class="time-sub">点完大厨就开火</view>
        </view>
      </view>
      <view class="dash time-dash"></view>
      <view class="time-row">
        <view class="time-radio on"></view>
        <view class="time-text">
          <view class="time-main">预约开饭时间</view>
          <view class="time-sub">大厨按钟点起锅</view>
        </view>
        <view class="time-pick active serif">18:30</view>
      </view>
    </view>
  </view>

  <view class="block">
    <view class="sec-title">怎么称呼你</view>
    <view class="sheet pad">
      <view class="name-input">公主殿下</view>
    </view>
  </view>

  <view class="bottom">
    <view class="bottom-inner">
      <view class="sum">
        <view class="sum-num serif">920</view>
        <view class="sum-label">千卡 · 3 道</view>
      </view>
      <view class="btn-primary submit">交给大厨</view>
    </view>
  </view>
</view>`;

const dishPage = `
<view class="page">
  <view class="hero-wrap">
    <img class="hero-img" src="${IMG}hong-shao-rou.jpg" />
    <view class="hero-fade"></view>
    <view class="hero-caption">
      <view class="hero-kicker"><text class="kicker-star">✦</text><text>今日为你而做</text></view>
      <view class="hero-name serif">红烧肉</view>
      <view class="hero-desc">小火焖到酥烂，肥而不腻，汤汁拌饭一绝</view>
    </view>
  </view>

  <view class="body">
    <view class="stats">
      <view class="stat tilt-l">
        <view class="stat-num serif">480</view>
        <view class="stat-label">千卡 / 份</view>
      </view>
      <view class="stat tilt-r">
        <view class="stat-num serif">90<text class="stat-unit">分</text></view>
        <view class="stat-label">大致用时</view>
      </view>
      <view class="stat tilt-l">
        <view class="stat-num serif cool">不辣</view>
        <view class="stat-label">口味辣度</view>
      </view>
    </view>

    <view class="block">
      <view class="sec-title">这道菜要用到<text class="sec-more">按一份计</text></view>
      <view class="sheet ing-card">
        <view class="tape"></view>
        <view class="ing-row"><text class="ing-name">五花肉</text><view class="leader"></view><text class="ing-amount">600g</text></view>
        <view class="ing-row"><text class="ing-name">冰糖</text><view class="leader"></view><text class="ing-amount">20g</text></view>
        <view class="ing-row"><text class="ing-name">生抽</text><view class="leader"></view><text class="ing-amount">30ml</text></view>
        <view class="ing-row"><text class="ing-name">老抽</text><view class="leader"></view><text class="ing-amount">10ml</text></view>
        <view class="ing-row"><text class="ing-name">姜</text><view class="leader"></view><text class="ing-amount">3片</text></view>
        <view class="ing-row"><text class="ing-name">八角</text><view class="leader"></view><text class="ing-amount">2个</text></view>
      </view>
      <view class="hint">点两份，买菜清单会自动按双倍计入</view>
    </view>

    <view class="block">
      <view class="sec-title">风味</view>
      <view class="tags">
        <text class="tag-lg">招牌</text>
        <text class="tag-lg">浓油赤酱</text>
      </view>
    </view>
  </view>

  <view class="bottom-bar">
    <view class="bottom-inner">
      <view class="btn-primary bottom-btn">加入点单</view>
    </view>
  </view>
</view>`;

const PETALS = [
  [4, 11, 60, 120],
  [15, 8, 210, 40],
  [26, 13, 330, 200],
  [37, 9, 150, 300],
  [49, 14, 420, 90],
  [61, 10, 260, 240],
  [73, 12, 500, 160],
  [86, 9, 350, 20],
];

const successPage = `
<view class="success">
  ${PETALS.map(function (p) {
    return '<view class="petal" style="left:' + p[0] + '%;top:0;width:' + p[1] + 'px;height:' +
      Math.round(p[1] * 1.4) + 'px;opacity:0.95;animation:none;transform:translate3d(0,' +
      p[2] + 'px,0) rotate(' + p[3] + 'deg)"></view>';
  }).join('')}
  <view class="success-card">
    <view class="candle">
      <view class="flame"></view>
      <view class="wick"></view>
      <view class="wax"><view class="wax-drip"></view></view>
    </view>
    <view class="success-title serif">已经递到大厨手上</view>
    <view class="success-sub">这就开火，去客厅等着吧</view>
  </view>
</view>`;

const pages = [
  { file: 'preview-menu.html', title: '菜单', nav: 'Kitty的小食堂', body: menu, css: ['app.wxss', 'pages/index/index.wxss'] },
  { file: 'preview-orders.html', title: '小票', nav: '我的点单', body: orders, css: ['app.wxss', 'pages/orders/orders.wxss'] },
  { file: 'preview-kitchen.html', title: '厨房', nav: '厨房', body: kitchen, css: ['app.wxss', 'pages/kitchen/kitchen.wxss'] },
  { file: 'preview-cart.html', title: '确认点单', nav: '确认点单', body: cartPage, css: ['app.wxss', 'pages/cart/cart.wxss'] },
  { file: 'preview-dish.html', title: '菜品详情', nav: '红烧肉', body: dishPage, css: ['app.wxss', 'pages/dish/dish.wxss'] },
  { file: 'preview-success.html', title: '下单成功', nav: '下单成功', body: successPage, css: ['app.wxss', 'pages/cart/cart.wxss'] },
  {
    file: 'preview-empty.html',
    title: '空状态',
    nav: '我的点单',
    body: `
<view class="state">
  <img class="illus" src="../../assets/illus/empty-ticket.png" />
  <view class="state-title">还没有点过菜</view>
  <view class="state-text">今天想吃点什么？</view>
  <view class="state-btn">去点菜</view>
</view>
<view class="state">
  <img class="illus" src="../../assets/illus/empty-basket.png" />
  <view class="state-title">还没有要买的</view>
  <view class="state-text">等家人点菜</view>
</view>`,
    css: ['app.wxss', 'pages/orders/orders.wxss'],
  },
  {
    file: 'preview-noodle.html',
    title: '面点主食',
    nav: 'Kitty的小食堂',
    body: `
<view class="page">
  <view class="hero">
    <view class="hero-glow"></view>
    <view class="hero-bar">
      <view class="ribbon">今日 · 农历十月初九</view>
      <view class="hero-actions">
        <view class="pill">我的点单</view>
        <view class="pill ghost">厨房</view>
      </view>
    </view>
    <view class="kicker">${crown}<text>Kitty的小食堂</text>${crown}</view>
    <view class="title serif">今天想吃<text class="title-accent">什么</text></view>
    <view class="title-underline"></view>
    <view class="sub">下午好 · 11月17日 周二</view>
  </view>

  <view class="cuisines">
    <view class="cuisine"><view class="cuisine-name serif">家常炒菜</view><view class="cuisine-tag">四菜一汤</view></view>
    <view class="cuisine"><view class="cuisine-name serif">火锅</view><view class="cuisine-tag">锅底 + 涮菜</view></view>
    <view class="cuisine"><view class="cuisine-name serif">烧烤</view><view class="cuisine-tag">一把串儿</view></view>
    <view class="cuisine on"><view class="cuisine-name serif">面点主食</view><view class="cuisine-tag">管饱</view></view>
    <view class="cuisine"><view class="cuisine-name serif">甜点饮品</view><view class="cuisine-tag">收个尾</view></view>
    <view class="cuisine"><view class="cuisine-name serif">凉菜下酒</view><view class="cuisine-tag">先开胃</view></view>
  </view>

  <view class="list">
    <view class="sec-title"><text class="sec-label">今日菜单</text><text class="sec-more">共 3 道</text></view>
    ${dishCard('韭菜鸡蛋饺子', 420, '现包的，韭菜别剁太碎', 40, 'spicy-empty', '不辣', 'noodle-dumpling', ['现包', '管饱'], 0)}
    ${dishCard('葱油饼', 380, '油酥卷进去，才一层一层地酥', 25, 'spicy-empty', '不辣', 'noodle-scallion-pancake', ['酥脆'], 45)}
    ${dishCard('小笼包', 400, '皮薄有汤，褶子要捏十八个', 50, 'spicy-empty', '不辣', 'noodle-xiaolongbao', ['有汤', '费功夫'], 90)}
  </view>

  <view class="cartbar">
    <view class="cartbar-ribbon">🎀</view>
    <view class="cartbar-info">
      <view class="cartbar-count">已点 2 道</view>
      <view class="cartbar-cal">合计约 800 kcal</view>
    </view>
    <view class="cartbar-btn">去点单</view>
  </view>
</view>`,
    css: ['app.wxss', 'pages/index/index.wxss'],
  },
  {
    file: 'preview-admin.html',
    title: '菜单管理',
    nav: '菜单管理',
    body: `
<view class="page">
  <view class="head">
    <view class="head-left">
      <view class="head-kicker"><text class="kicker-star">✦</text><text>后台</text></view>
      <view class="head-title serif">菜单管理</view>
      <view class="head-meta">共 67 道 · 上架 65 道</view>
    </view>
    <view class="refresh">刷新</view>
  </view>

  <view class="tabs">
    <view class="tab on">家常炒菜</view>
    <view class="tab">火锅</view>
    <view class="tab">烧烤</view>
    <view class="tab">面点主食</view>
    <view class="tab">甜点饮品</view>
    <view class="tab">凉菜下酒</view>
  </view>

  <view class="row">
    <img class="row-img" src="${IMG}hong-shao-rou.jpg" />
    <view class="row-body">
      <view class="row-name serif">红烧肉</view>
      <view class="row-meta">硬菜 · 480 kcal · 90 分</view>
      <view class="row-tags"><text class="badge">上架中</text><text class="badge badge-ghost">内置</text></view>
    </view>
    <view class="row-ops">
      <view class="op op-toggle op-off">下架</view>
      <view class="op-line">
        <view class="op-mini">↑</view><view class="op-mini">↓</view><view class="op-mini">改</view><view class="op-mini op-del">删</view>
      </view>
    </view>
  </view>

  <view class="row row-off">
    <img class="row-img" src="${IMG}ma-po-dou-fu.jpg" />
    <view class="row-body">
      <view class="row-name serif">麻婆豆腐</view>
      <view class="row-meta">小炒 · 240 kcal · 25 分</view>
      <view class="row-tags"><text class="badge badge-off">已下架</text><text class="badge badge-ghost">内置</text></view>
    </view>
    <view class="row-ops">
      <view class="op op-toggle op-on">上架</view>
      <view class="op-line">
        <view class="op-mini">↑</view><view class="op-mini">↓</view><view class="op-mini">改</view><view class="op-mini op-del">删</view>
      </view>
    </view>
  </view>

  <view class="row">
    <img class="row-img" src="${IMG}fan-qie-chao-dan.jpg" />
    <view class="row-body">
      <view class="row-name serif">番茄炒蛋</view>
      <view class="row-meta">小炒 · 220 kcal · 15 分</view>
      <view class="row-tags"><text class="badge">上架中</text></view>
    </view>
    <view class="row-ops">
      <view class="op op-toggle op-off">下架</view>
      <view class="op-line">
        <view class="op-mini">↑</view><view class="op-mini">↓</view><view class="op-mini">改</view><view class="op-mini op-del">删</view>
      </view>
    </view>
  </view>

  <view class="bottom"><view class="btn-primary">+ 新增菜品</view></view>
</view>`,
    css: ['app.wxss', 'pages/menu-admin/menu-admin.wxss'],
  },
  {
    file: 'preview-edit.html',
    title: '编辑菜品',
    nav: '编辑菜品',
    body: `
<view class="page">
  <view class="head">
    <view class="head-kicker"><text class="kicker-star">✦</text><text>修改</text></view>
    <view class="head-title serif">回锅肉</view>
  </view>

  <view class="pic">
    <img class="pic-img" src="${IMG}hong-shao-rou.jpg" />
    <view class="pic-badge">换一张</view>
  </view>

  <view class="form">
    <view class="field"><text class="label">菜名</text><view class="input">回锅肉</view></view>

    <view class="field field-col">
      <text class="label">菜系</text>
      <view class="chips">
        <view class="chip chip-on">家常炒菜</view>
        <view class="chip">火锅</view>
        <view class="chip">烧烤</view>
        <view class="chip">面点主食</view>
        <view class="chip">甜点饮品</view>
        <view class="chip">凉菜下酒</view>
      </view>
    </view>

    <view class="field field-col">
      <text class="label">分类</text>
      <view class="chips">
        <view class="chip">不分类</view>
        <view class="chip chip-on">硬菜</view>
        <view class="chip">小炒</view>
        <view class="chip">素菜</view>
        <view class="chip">汤羹</view>
        <view class="chip">主食</view>
      </view>
    </view>

    <view class="field field-col">
      <text class="label">辣度</text>
      <view class="chips">
        <view class="chip">不辣</view>
        <view class="chip chip-on">微辣</view>
        <view class="chip">中辣</view>
        <view class="chip">重辣</view>
      </view>
    </view>

    <view class="field"><text class="label">热量</text><view class="input">420</view></view>
    <view class="field"><text class="label">用时</text><view class="input">30</view></view>

    <view class="field field-col">
      <text class="label">一句话介绍</text>
      <view class="area">豆瓣酱炒出红油，配蒜苗最香</view>
    </view>

    <view class="field field-col">
      <text class="label">食材用量</text>
      <view class="area area-tall">五花肉 400g
豆瓣酱 30g
蒜苗 100g
姜 3片</view>
      <view class="hint">这个会进买菜清单，写清楚点</view>
    </view>
  </view>

  <view class="bottom"><view class="btn-primary">保存</view></view>
</view>`,
    css: ['app.wxss', 'pages/dish-edit/dish-edit.wxss'],
  },
];

pages.forEach(function (p) {
  fs.writeFileSync(path.join(OUT, p.file), page(p.title, p.nav, p.body, p.css), 'utf8');
  console.log('written', p.file);
});
