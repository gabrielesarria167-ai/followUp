const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  refresh: call('refresh'),
  activate: call('activate'),
  pickDb: call('pickDb'),
  month: call('month'),
  range: call('range'),
  year: call('year'),
  setPhone: call('setPhone'),
  setStatus: call('setStatus'),
  openWhatsApp: call('openWhatsApp'),
});
