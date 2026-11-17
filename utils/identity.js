// 本地身份：设备 ID 与昵称（家人各自手机独立）
const DEVICE_KEY = 'family_device_id';
const NAME_KEY = 'family_nickname';

function getDeviceId() {
  let id = wx.getStorageSync(DEVICE_KEY);
  if (!id) {
    id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    wx.setStorageSync(DEVICE_KEY, id);
  }
  return id;
}

function getNickname() {
  return wx.getStorageSync(NAME_KEY) || '';
}

function setNickname(name) {
  wx.setStorageSync(NAME_KEY, name || '');
}

module.exports = { getDeviceId, getNickname, setNickname };
