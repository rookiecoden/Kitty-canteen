// 菜品图压缩：裁水印 + 缩放到 520 宽 + JPEG。64 道菜共用一个尺寸，兼顾清晰度和 2MB 包体
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'images', 'dish');
const WIDTH = 480;
const QUALITY = 60;

// 关键词 -> 文件名。顺序敏感：更具体的关键词必须排在前面的通用词之前
const MAP = [
  // 家常炒菜
  ['红烧肉', 'hong-shao-rou'],
  ['糖醋排骨', 'tang-cu-pai-gu'],
  ['清蒸鲈鱼', 'qing-zheng-lu-yu'],
  ['可乐鸡翅', 'ke-le-ji-chi'],
  ['番茄炒蛋', 'fan-qie-chao-dan'],
  ['青椒肉丝', 'qing-jiao-rou-si'],
  ['宫保鸡丁', 'gong-bao-ji-ding'],
  ['麻婆豆腐', 'ma-po-dou-fu'],
  ['蒜蓉西兰花', 'suan-rong-xi-lan-hua'],
  ['手撕包菜', 'shou-si-bao-cai'],
  ['干煸豆角', 'gan-bian-dou-jiao'],
  ['冬瓜排骨汤', 'dong-gua-pai-gu-tang'],
  ['紫菜蛋花汤', 'zi-cai-dan-hua-tang'],
  ['蛋炒饭', 'dan-chao-fan'],
  // 火锅 · 锅底
  ['麻辣锅底', 'hotpot-base-mala'],
  ['番茄锅底', 'hotpot-base-tomato'],
  ['菌汤锅底', 'hotpot-base-mushroom'],
  // 火锅 · 荤菜
  ['肥牛卷', 'hotpot-beef-roll'],
  ['羊肉卷', 'hotpot-lamb-roll'],
  ['虾滑', 'hotpot-shrimp-paste'],
  ['毛肚', 'hotpot-tripe'],
  ['鸭血', 'hotpot-duck-blood'],
  ['午餐肉', 'hotpot-luncheon-meat'],
  ['牛肉丸', 'hotpot-beef-ball'],
  ['酥肉', 'hotpot-crispy-pork'],
  ['鱼豆腐', 'hotpot-fish-tofu'],
  ['蟹棒', 'hotpot-crab-stick'],
  ['蛋饺', 'hotpot-egg-dumpling'],
  // 烤土豆片必须排在「土豆片」前面
  ['烤土豆片', 'bbq-potato-slice'],
  // 火锅 · 素菜
  ['土豆片', 'hotpot-potato'],
  ['藕片', 'hotpot-lotus-root'],
  ['山药', 'hotpot-yam'],
  ['娃娃菜', 'hotpot-baby-cabbage'],
  // 火锅 · 菌菇豆制品
  ['金针菇', 'hotpot-enoki'],
  ['冻豆腐', 'hotpot-frozen-tofu'],
  ['腐竹', 'hotpot-tofu-stick'],
  // 火锅 · 主食
  ['宽粉', 'hotpot-wide-noodle'],
  ['方便面', 'hotpot-instant-noodle'],
  // 烧烤 · 肉串
  ['羊肉串', 'bbq-lamb-skewer'],
  ['牛肉串', 'bbq-beef-skewer'],
  ['五花肉串', 'bbq-pork-belly-skewer'],
  ['烤鸡翅', 'bbq-chicken-wing'],
  ['烤香肠', 'bbq-sausage'],
  // 烧烤 · 蔬菜海鲜
  ['烤茄子', 'bbq-eggplant'],
  ['烤韭菜', 'bbq-chive'],
  ['烤玉米', 'bbq-corn'],
  ['烤扇贝', 'bbq-scallop'],
  ['烤虾', 'bbq-shrimp'],
  ['生蚝', 'bbq-oyster'],
  // 烧烤 · 主食
  ['烤馒头片', 'bbq-mantou'],
  // 面点主食
  ['饺子', 'noodle-dumpling'],
  ['葱油饼', 'noodle-scallion-pancake'],
  ['小笼包', 'noodle-xiaolongbao'],
  ['揁', 'noodle-hand-pulled'],
  ['炸酱面', 'noodle-zhajiang'],
  ['包子', 'noodle-pork-bun'],
  ['盒子', 'noodle-chive-pocket'],
  ['馄饨', 'noodle-wonton'],
  // 甜点饮品
  ['银耳羹', 'dessert-tremella'],
  ['绿豆汤', 'dessert-mung-bean'],
  // 凉菜
  ['拍黄瓜', 'cold-cucumber'],
  ['凉拌木耳', 'cold-wood-ear'],
  ['口水鸡', 'cold-kou-shui-chicken'],
  ['皮蛋豆腐', 'cold-century-egg-tofu'],
  ['海带', 'cold-kelp'],
  ['蒜泥白肉', 'cold-garlic-pork'],
  ['卤牛肉', 'cold-braised-beef'],
];

// 已下架菜品：即使命中了关键词也跳过，避免覆盖同名菜品图
const SKIP = ['锡纸', '鸭肠', '黄喉', '口蘑', '鸡心'];

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  let total = 0;
  let done = 0;
  const skipped = [];

  for (const file of files) {
    if (SKIP.some((kw) => file.includes(kw))) {
      skipped.push(file);
      continue;
    }
    const hit = MAP.find(([kw]) => file.includes(kw));
    if (!hit) {
      skipped.push(file);
      continue;
    }
    const src = path.join(DIR, file);
    const out = path.join(DIR, hit[1] + '.jpg');
    const meta = await sharp(src).metadata();
    const cropH = Math.round(meta.height * 0.93); // 去掉底部约 7% 的水印区
    await sharp(src)
      .extract({ left: 0, top: 0, width: meta.width, height: cropH })
      .resize({ width: WIDTH })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(out);
    const size = fs.statSync(out).size;
    total += size;
    done += 1;
  }

  console.log('处理 ' + done + ' 张，合计 ' + (total / 1024).toFixed(0) + 'KB');
  if (skipped.length) console.log('未匹配：\n' + skipped.join('\n'));
})();
