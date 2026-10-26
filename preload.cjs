const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  refresh: call('refresh'),
  activate: call('activate'),
  pickDb: call('pickDb'),
  pickLogo: call('pickLogo'),
  month: call('month'),
  range: call('range'),
  search: call('search'),
  year: call('year'),
  setPhone: call('setPhone'),
  setStatus: call('setStatus'),
  remove: call('remove'),
  openWhatsApp: call('openWhatsApp'),
  version: call('version'),
  installUpdate: call('installUpdate'),
  onUpdateProgress: (fn) => ipcRenderer.on('updateProgress', (_e, percent) => fn(percent)),
  onUpdateReady: (fn) => ipcRenderer.on('updateReady', (_e, version) => fn(version)),
});
