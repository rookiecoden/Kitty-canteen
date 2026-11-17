// 插画处理：裁掉水印、把奶油白背景转成透明、缩到 320 宽并存为 PNG
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'images', 'illus');

const MAP = [
  ['盘子', 'empty-plate'],
  ['提篮', 'empty-basket'],
  ['小票', 'empty-ticket'],
  ['汤碗', 'empty-bowl'],
];

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  for (const file of files) {
    const hit = MAP.find(([kw]) => file.includes(kw));
    if (!hit) {
      console.log('SKIP:', file);
      continue;
    }
    const src = path.join(DIR, file);
    const meta = await sharp(src).metadata();
    const cropH = Math.round(meta.height * 0.92);

    // 先裁剪 + 缩放，再按角落颜色做透明底
    const { data, info } = await sharp(src)
      .extract({ left: 0, top: 0, width: meta.width, height: cropH })
      .resize({ width: 320 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const ch = info.channels;
    const px = (x, y) => {
      const i = (y * info.width + x) * ch;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const bg = px(2, 2);
    const TOL = 26;

    for (let i = 0; i < data.length; i += ch) {
      const d =
        Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
      if (d < TOL) data[i + 3] = 0;
    }

    const out = path.join(DIR, hit[1] + '.png');
    await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
      .png({ compressionLevel: 9, palette: true })
      .toFile(out);
    const size = fs.statSync(out).size;
    console.log(hit[1] + '.png', (size / 1024).toFixed(1) + 'KB', info.width + 'x' + info.height);
  }
})();
