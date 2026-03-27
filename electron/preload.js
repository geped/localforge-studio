const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Launcher
  launchApp: (app) => ipcRenderer.send('launch-app', app),
  goHome: () => ipcRenderer.send('go-home'),

  // Welcome
  closeWelcome: () => ipcRenderer.send('close-welcome'),

  // Aggiornamenti
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, progress) => cb(progress)),
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Tutorial
  showTutorial: () => ipcRenderer.send('show-tutorial'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),

  // Rete locale
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  getPreferredIp: () => ipcRenderer.invoke('get-preferred-ip'),
  setPreferredIp: (ip) => ipcRenderer.invoke('set-preferred-ip', ip),

  // Selezione cartella nativa
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
});
