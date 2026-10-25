const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  refresh: call('refresh'),
  month: call('month'),
  range: call('range'),
  year: call('year'),
  setPhone: call('setPhone'),
  setStatus: call('setStatus'),
  openWhatsApp: call('openWhatsApp'),
});
