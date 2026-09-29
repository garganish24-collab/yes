const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('store', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (data) => ipcRenderer.invoke('store:save', data),
  path: () => ipcRenderer.invoke('store:path'),
  exportBackup: (data) => ipcRenderer.invoke('store:export', data),
  importBackup: () => ipcRenderer.invoke('store:import'),
});
