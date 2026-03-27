const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');
const net  = require('net');
const os   = require('os');
const { spawn } = require('child_process');

// ─── Costanti ────────────────────────────────────────────────────────────────
const PORT   = 3001;
const FF_URL = `https://localhost:${PORT}/fileforge`;
const LS_URL = `https://localhost:${PORT}/localsync`;

const isDev = !app.isPackaged;

// ─── Bypass certificato self-signed per localhost (HTTPS locale) ──────────────
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Bypass SSL per le richieste fetch dal launcher (file:// → https://localhost)
app.whenReady().then(() => {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    if (request.hostname === 'localhost' || request.hostname === '127.0.0.1') {
      callback(0); // 0 = trust
    } else {
      callback(-3); // usa la verifica di default
    }
  });
});

// ─── Stato globale ────────────────────────────────────────────────────────────
let mainWindow   = null;
let splashWindow = null;
let welcomeWindow = null;
let tray         = null;
let ffServer     = null;
let isQuitting   = false;

// ─── Store persistenza ────────────────────────────────────────────────────────
const Store = (() => {
  const filePath = path.join(app.getPath('userData'), 'fileforge-store.json');
  let data = {};
  return {
    load() {
      try {
        if (fs.existsSync(filePath)) data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {}
    },
    save() {
      try { fs.writeFileSync(filePath, JSON.stringify(data)); } catch {}
    },
    get(key, def) { return key in data ? data[key] : def; },
    set(key, val) { data[key] = val; this.save(); },
  };
})();

// ─── Controlla se la porta è già occupata (TCP connect — affidabile su Windows) ─
function isPortInUse(port) {
  return new Promise(resolve => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.connect(port, '127.0.0.1', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// ─── Avvio server (dev + produzione) ─────────────────────────────────────────
async function startServers() {
  // Se la porta è già occupata (es. npm run dev in un altro terminale),
  // non avviamo un secondo server — aspettiamo solo che sia pronto.
  const portOccupied = await isPortInUse(PORT);
  if (portOccupied) {
    console.log(`[Server] Porta ${PORT} già in uso — skip spawn, attendo il server esistente.`);
    return;
  }

  const nodeBin = isDev ? 'node' : process.execPath;
  const appDir  = isDev
    ? path.join(__dirname, '..')
    : path.join(process.resourcesPath, 'app');

  const scriptPath = path.join(appDir, 'server.js');
  if (!fs.existsSync(scriptPath)) {
    console.warn('[Server] server.js non trovato in:', scriptPath);
    return;
  }

  ffServer = spawn(nodeBin, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: String(PORT),
    },
    cwd: appDir,
    stdio: isDev ? 'pipe' : 'ignore',
    windowsHide: true,
  });

  if (isDev && ffServer.stdout) {
    ffServer.stdout.on('data', d => process.stdout.write(`[FF] ${d}`));
    ffServer.stderr.on('data', d => process.stderr.write(`[FF] ${d}`));
  }
  ffServer.on('error', (err) => console.error('[FileForge Server] Errore avvio:', err));
}

// ─── Attendi che il server sia pronto (TCP check) ────────────────────────────
// Più affidabile di wait-on in contesto Electron main process.
function waitForServer(timeoutMs = 60000) {
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      const sock = new net.Socket();
      sock.setTimeout(2000);
      sock.connect(PORT, '127.0.0.1', () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 1000);
        else resolve(false);
      });
      sock.on('timeout', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 1000);
        else resolve(false);
      });
    }
    attempt();
  });
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 320,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
function createWelcome() {
  return new Promise((resolve) => {
    welcomeWindow = new BrowserWindow({
      width: 620,
      height: 640,
      frame: false,
      resizable: false,
      center: true,
      show: false,
      backgroundColor: '#0a0a0a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    welcomeWindow.loadFile(path.join(__dirname, 'welcome.html'));
    welcomeWindow.once('ready-to-show', () => { closeSplash(); welcomeWindow.show(); });
    ipcMain.once('close-welcome', () => {
      if (welcomeWindow && !welcomeWindow.isDestroyed()) welcomeWindow.close();
      resolve();
    });
    welcomeWindow.on('closed', () => { welcomeWindow = null; resolve(); });
  });
}

// ─── Finestra principale ──────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'LocalForge Studio',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'launcher.html'));

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.show();
    if (!isDev) setupUpdater();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('http://localhost')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Riprova se la pagina fallisce il caricamento
  mainWindow.webContents.on('did-fail-load', (_, code) => {
    if ([-6, -102, -105].includes(code) && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.loadFile(path.join(__dirname, 'launcher.html'));
      }, 1500);
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Navigazione tra app ──────────────────────────────────────────────────────
ipcMain.on('launch-app', (_, appName) => {
  if (!mainWindow) return;
  if (appName === 'fileforge') {
    mainWindow.loadURL(FF_URL);
    mainWindow.setTitle('FileForge Studio');
  } else if (appName === 'localsync') {
    mainWindow.loadURL(LS_URL);
    mainWindow.setTitle('LocalSync Bridge');
  }
});

ipcMain.on('go-home', () => {
  if (!mainWindow) return;
  mainWindow.loadFile(path.join(__dirname, 'launcher.html'));
  mainWindow.setTitle('LocalForge Studio');
});

ipcMain.on('show-tutorial', () => showTutorial());

// ─── Tutorial ─────────────────────────────────────────────────────────────────
function showTutorial() {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.focus();
    return;
  }
  mainWindow?.hide();
  createWelcome().then(() => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error();
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('LocalForge Studio');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Home — Seleziona app',
      click: () => {
        mainWindow?.show();
        mainWindow?.loadFile(path.join(__dirname, 'launcher.html'));
        mainWindow?.setTitle('LocalForge Studio');
      }
    },
    { type: 'separator' },
    {
      label: 'FileForge Studio',
      click: () => { mainWindow?.show(); mainWindow?.loadURL(FF_URL); mainWindow?.setTitle('FileForge Studio'); }
    },
    {
      label: 'LocalSync Bridge',
      click: () => { mainWindow?.show(); mainWindow?.loadURL(LS_URL); mainWindow?.setTitle('LocalSync Bridge'); }
    },
    { type: 'separator' },
    { label: 'Rivedi tutorial',        click: () => showTutorial() },
    { label: 'Controlla aggiornamenti', click: () => { if (!isDev) autoUpdater.checkForUpdates(); } },
    { type: 'separator' },
    { label: 'Esci', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available',  (info) => mainWindow?.webContents.send('update-available', info));
  autoUpdater.on('download-progress', (p)    => mainWindow?.webContents.send('download-progress', p));
  autoUpdater.on('update-downloaded', (info) => mainWindow?.webContents.send('update-downloaded', info));
  autoUpdater.on('error', (err) => console.error('Updater:', err));
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

// ─── IPC vari ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-app-name', () => app.getName());
ipcMain.on('install-update', () => { isQuitting = true; autoUpdater.quitAndInstall(); });
ipcMain.on('check-for-updates', () => { if (!isDev) autoUpdater.checkForUpdates(); });

// ─── Rete locale ──────────────────────────────────────────────────────────────
ipcMain.handle('get-network-interfaces', () => {
  const ifaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of (addrs || [])) {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({ name, address: addr.address });
      }
    }
  }
  return result;
});

ipcMain.handle('get-preferred-ip', () => Store.get('preferredIp', null));
ipcMain.handle('set-preferred-ip', (_, ip) => { Store.set('preferredIp', ip); return true; });

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Scegli cartella di destinazione per i file ricevuti',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Store.load();

  // 1. Splash
  createSplash();

  // 2. Avvia il server se la porta è libera (dev: aspetta npm run dev)
  await startServers();

  // 3. Attendi che il server risponda sulla porta (max 60s)
  const serverReady = await waitForServer(60000);

  if (!serverReady) {
    closeSplash();
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Server non raggiungibile',
      message: 'Il server FileForge non si è avviato in tempo.',
      detail: 'Puoi continuare ed usare LocalSync, oppure uscire e riprovare.',
      buttons: ['Continua comunque', 'Esci'],
      defaultId: 0,
    });
    if (response === 1) { app.quit(); return; }
    createSplash();
  }

  // 4. Primo avvio → tutorial
  if (Store.get('firstLaunch', true)) {
    closeSplash();
    await createWelcome();
    Store.set('firstLaunch', false);
  } else {
    closeSplash();
  }

  // 5. Finestra principale
  createMainWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('activate', () => { mainWindow?.show(); mainWindow?.focus(); });

app.on('before-quit', () => {
  isQuitting = true;
  ffServer?.kill();
  ffServer = null;
});
