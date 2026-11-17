// 厨房口令：不再写在代码里，由云端校验。校验通过后缓存在本机，锁上即清除。
const PIN_KEY = 'kitchen_pin_v1';

function getPin() {
  try {
    return wx.getStorageSync(PIN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setPin(pin) {
  try {
    wx.setStorageSync(PIN_KEY, pin);
  } catch (e) {}
}

function clearPin() {
  try {
    wx.removeStorageSync(PIN_KEY);
  } catch (e) {}
}

// 判断错误是不是「口令失效/不对」，各页面据此提示重新解锁
function isPinError(err) {
  const msg = (err && err.message) || '';
  return msg.indexOf('PIN_REQUIRED') >= 0 || msg.indexOf('28000') >= 0;
}

module.exports = { getPin, setPin, clearPin, isPinError };
