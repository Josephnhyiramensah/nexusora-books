const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
});