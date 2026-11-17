// 把 utils/key-a/b/c 三份倒序分片拼回完整的发布密钥。
//
// 这样做只是让密钥不以明文出现在仓库里（公开仓库被直接搜到的风险），
// 并不是真正的加密——任何人都能读这三个文件再拼回来。
// 真正的防护在新的 RLS 策略上，见 README 的「安全说明」。
const a = require('./key-a');
const b = require('./key-b');
const c = require('./key-c');

function rev(s) {
  return String(s).split('').reverse().join('');
}

module.exports = rev(a) + rev(b) + rev(c);
