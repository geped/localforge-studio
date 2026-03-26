const express = require('express');
const next = require('next');
const https = require('https');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const archiver = require('archiver');
const selfsigned = require('selfsigned');
const QRCode = require('qrcode');
const notifier = require('node-notifier');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const nodeCrypto = require('crypto');
const { spawn } = require('child_process');

const port = 3001;
const dev = process.env.NODE_ENV !== 'production';
const NEXT_INTERNAL_PORT = Number(process.env.NEXT_INTERNAL_PORT || 3101);
const standaloneDir = path.join(__dirname, '.next', 'standalone');
const standaloneEntry = path.join(standaloneDir, 'server.js');
let standaloneProc = null;
let app = null;
let handle = null;

// ─── LocalSync Config ─────────────────────────────────────────────────────────
const LS_UPLOAD_BASE = path.join(os.homedir(), 'Desktop', 'LocalSync_Files');
const LS_CONFIG_DIR  = path.join(os.homedir(), '.localforge');

if (!fs.existsSync(LS_UPLOAD_BASE)) fs.mkdirSync(LS_UPLOAD_BASE, { recursive: true });
if (!fs.existsSync(LS_CONFIG_DIR))  fs.mkdirSync(LS_CONFIG_DIR,  { recursive: true });

// ─── Multi-utente ─────────────────────────────────────────────────────────────
const USERS_FILE = path.join(LS_CONFIG_DIR, 'localsync-users.json');

function lsGetUsers() {
  try {
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    // Migrazione dal vecchio formato single-user (oggetto) al nuovo (array)
    if (!Array.isArray(raw)) {
      if (raw && typeof raw === 'object' && raw.username) {
        const migrated = [{ ...raw, id: raw.id || 'admin', role: 'admin' }];
        lsSaveUsers(migrated);
        return migrated;
      }
      return [];
    }
    return raw;
  } catch { return []; }
}
function lsSaveUsers(users) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users)); } catch {}
}
function lsFindUserByToken(token) {
  if (!token) return null;
  return lsGetUsers().find(u => (u.tokens || []).includes(token));
}
function lsFindUserByUsername(username) {
  return lsGetUsers().find(u => u.username === username);
}
function genToken() { return nodeCrypto.randomBytes(32).toString('hex'); }

// ─── Directory e DB per utente ────────────────────────────────────────────────
function getUserUploadDir(username) {
  const dir = path.join(LS_UPLOAD_BASE, username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getUserDbFile(username) {
  return path.join(LS_CONFIG_DIR, `localsync-db-${username}.json`);
}
function loadUserItems(username) {
  try { return JSON.parse(fs.readFileSync(getUserDbFile(username))).items || []; } catch { return []; }
}
function saveUserItems(username, items) {
  try { fs.writeFileSync(getUserDbFile(username), JSON.stringify({ items })); } catch {}
}

// ─── IP locale preferito (WiFi > LAN > altro) ─────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of (ifaces[name] || [])) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  return candidates.find(a => a.startsWith('192.168.'))
      || candidates.find(a => a.startsWith('172.'))
      || candidates.find(a => a.startsWith('10.'))
      || candidates[0] || '127.0.0.1';
}

// ─── Certificato SSL self-signed (cached su disco) ────────────────────────────
const CERT_FILE = path.join(LS_CONFIG_DIR, 'ls-cert.json');
function getOrCreateCert() {
  const localIP = getLocalIP();
  if (fs.existsSync(CERT_FILE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(CERT_FILE, 'utf8'));
      if (stored.ip === localIP) return stored;
    } catch {}
  }
  console.log('[SSL] Generazione certificato self-signed per', localIP, '...');
  const attrs = [{ name: 'commonName', value: localIP }];
  const opts  = {
    days: 3650,
    extensions: [{
      name: 'subjectAltName',
      altNames: [
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: localIP },
      ],
    }],
  };
  const pems  = selfsigned.generate(attrs, opts);
  const creds = { key: pems.private, cert: pems.cert, ip: localIP };
  fs.writeFileSync(CERT_FILE, JSON.stringify(creds));
  return creds;
}
const sslCreds = getOrCreateCert();

function waitForPort(host, targetPort, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const sock = new net.Socket();
      sock.setTimeout(1500);
      sock.connect(targetPort, host, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(tryConnect, 350);
        else resolve(false);
      });
      sock.on('timeout', () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(tryConnect, 350);
        else resolve(false);
      });
    };
    tryConnect();
  });
}

async function ensureNextRuntime() {
  if (dev) {
    app = next({ dev: true });
    handle = app.getRequestHandler();
    await app.prepare();
    return;
  }

  if (!fs.existsSync(standaloneEntry)) {
    throw new Error(`Standalone server non trovato: ${standaloneEntry}`);
  }

  standaloneProc = spawn(process.execPath, [standaloneEntry], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(NEXT_INTERNAL_PORT),
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  const ready = await waitForPort('127.0.0.1', NEXT_INTERNAL_PORT, 45000);
  if (!ready) throw new Error('Standalone Next.js non ha aperto la porta in tempo');
}

function proxyToStandalone(req, res) {
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: NEXT_INTERNAL_PORT,
      path: req.originalUrl || req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${NEXT_INTERNAL_PORT}`,
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 502);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) res.setHeader(key, value);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) res.status(502).send('Next standalone non raggiungibile');
    else res.end();
  });

  req.pipe(proxyReq);
}

// ─── Multer storage dinamico (per utente) ─────────────────────────────────────
const lsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.lsUser?.username || '_default';
    cb(null, getUserUploadDir(username));
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${Date.now()}-${originalName}`);
  }
});
const lsUpload = multer({ storage: lsStorage });

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '').trim() || req.query.token || '';
  const remoteAddr = req.socket?.remoteAddress || req.ip || '';
  const isLocal = remoteAddr === '127.0.0.1' || remoteAddr === '::1'
               || remoteAddr === '::ffff:127.0.0.1';

  if (token) {
    const user = lsFindUserByToken(token);
    if (user) { req.lsUser = user; return next(); }
  }

  if (isLocal) {
    // PC senza token: usa il primo admin disponibile
    const admin = lsGetUsers().find(u => u.role === 'admin');
    req.lsUser = admin || null;
    return next();
  }

  return res.status(401).json({ error: 'Non autenticato' });
}

function requireAdmin(req, res, next) {
  if (!req.lsUser || req.lsUser.role !== 'admin') {
    return res.status(403).json({ error: "Accesso riservato all'amministratore" });
  }
  next();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
ensureNextRuntime().then(() => {
  let lsIo; // assegnato dopo la creazione di io

  const server = express();
  server.use(express.json());

  // ── CORS per il launcher (file:// → null origin) ─────────────────────────
  server.use((req, res, next) => {
    const origin = req.headers.origin;
    // file:// pages send Origin: null; allow them plus any localhost origin
    if (!origin || origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ── Auth: stato account ──────────────────────────────────────────────────────
  server.get('/localsync/api/auth/status', (req, res) => {
    const users = lsGetUsers();
    res.json({ userCount: users.length, hasUsers: users.length > 0 });
  });

  // ── Auth: registrazione ──────────────────────────────────────────────────────
  server.post('/localsync/api/auth/register', (req, res) => {
    const { username, pwdHash, qa } = req.body;
    if (!username || !pwdHash) return res.status(400).json({ error: 'Dati mancanti' });

    const users = lsGetUsers();
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const isFirst = users.length === 0;
    const token = genToken();
    const newUser = {
      id: nodeCrypto.randomBytes(8).toString('hex'),
      username,
      pwdHash,
      qa: qa || [],
      tokens: [token],
      role: isFirst ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };
    users.push(newUser);
    lsSaveUsers(users);
    // Crea cartella upload utente
    getUserUploadDir(username);
    res.json({ success: true, token, role: newUser.role });
  });

  // ── Auth: login ──────────────────────────────────────────────────────────────
  server.post('/localsync/api/auth/login', (req, res) => {
    const { username, pwdHash } = req.body;
    if (!username || !pwdHash) return res.status(400).json({ error: 'Dati mancanti' });

    const users = lsGetUsers();
    const u = users.find(u => u.username === username);
    if (!u) return res.status(404).json({ error: 'Utente non trovato' });
    if (pwdHash !== u.pwdHash) return res.status(401).json({ error: 'Password errata' });

    const token = genToken();
    u.tokens = [...(u.tokens || []).slice(-9), token];
    u.lastLogin = Date.now();
    lsSaveUsers(users);
    res.json({ success: true, token, role: u.role, username: u.username });
  });

  // ── Auth: verifica token ─────────────────────────────────────────────────────
  server.post('/localsync/api/auth/verify', (req, res) => {
    const { token } = req.body;
    const u = lsFindUserByToken(token);
    res.json({ valid: !!u, username: u?.username || null, role: u?.role || null });
  });

  // ── Auth: logout ─────────────────────────────────────────────────────────────
  server.post('/localsync/api/auth/logout', (req, res) => {
    const { token } = req.body;
    if (!token) return res.json({ success: true });
    const users = lsGetUsers();
    const u = users.find(u => (u.tokens || []).includes(token));
    if (u) {
      u.tokens = u.tokens.filter(t => t !== token);
      lsSaveUsers(users);
    }
    res.json({ success: true });
  });

  // ── Auth: whoami ──────────────────────────────────────────────────────────────
  server.get('/localsync/api/auth/whoami', requireAuth, (req, res) => {
    const u = req.lsUser;
    if (!u) return res.status(401).json({ error: 'Non autenticato' });
    res.json({ username: u.username, role: u.role });
  });

  // ── Auth: domande di recupero ────────────────────────────────────────────────
  server.get('/localsync/api/auth/recovery-questions', (req, res) => {
    const { username } = req.query;
    const u = username ? lsFindUserByUsername(username) : lsGetUsers().find(u => u.role === 'admin');
    if (!u || !u.qa?.length) return res.status(404).json({ error: 'Nessun account o domande' });
    res.json({ questions: u.qa.map(q => q.id) });
  });

  // ── Auth: verifica risposte di recupero ──────────────────────────────────────
  server.post('/localsync/api/auth/recovery-verify', (req, res) => {
    const { username, answers } = req.body;
    const users = lsGetUsers();
    const u = username ? users.find(u => u.username === username) : users.find(u => u.role === 'admin');
    if (!u) return res.status(404).json({ error: 'Utente non trovato' });
    let correct = 0;
    for (const { id, ansHash } of (answers || [])) {
      const stored = u.qa?.find(q => q.id === id);
      if (stored && stored.ansHash === ansHash) correct++;
    }
    if (correct >= 2) {
      const idx = users.indexOf(u);
      const resetToken = genToken();
      users[idx].resetToken  = resetToken;
      users[idx].resetExpiry = Date.now() + 10 * 60 * 1000;
      lsSaveUsers(users);
      res.json({ success: true, resetToken });
    } else {
      res.json({ success: false });
    }
  });

  // ── Auth: reset password ─────────────────────────────────────────────────────
  server.post('/localsync/api/auth/reset-password', (req, res) => {
    const { username, resetToken, newPwdHash } = req.body;
    const users = lsGetUsers();
    const idx = username
      ? users.findIndex(u => u.username === username)
      : users.findIndex(u => u.role === 'admin');
    if (idx === -1) return res.status(404).json({ error: 'Utente non trovato' });
    const u = users[idx];
    if (u.resetToken !== resetToken || Date.now() > (u.resetExpiry || 0)) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }
    users[idx].pwdHash = newPwdHash;
    users[idx].tokens  = [];
    delete users[idx].resetToken;
    delete users[idx].resetExpiry;
    lsSaveUsers(users);
    res.json({ success: true });
  });

  // ── Admin: lista utenti ──────────────────────────────────────────────────────
  server.get('/localsync/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const users = lsGetUsers().map(u => {
      let uploadCount = 0;
      try {
        const dir = path.join(LS_UPLOAD_BASE, u.username);
        if (fs.existsSync(dir)) uploadCount = fs.readdirSync(dir).length;
      } catch {}
      return {
        username: u.username,
        role: u.role,
        uploadCount,
        sessionCount: (u.tokens || []).length,
        createdAt: u.createdAt || null,
        lastLogin: u.lastLogin || null,
      };
    });
    res.json({ users });
  });

  // ── Admin: elimina utente ────────────────────────────────────────────────────
  server.delete('/localsync/api/admin/users/:username', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.params;
    const users = lsGetUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.status(404).json({ error: 'Utente non trovato' });
    if (users[idx].role === 'admin') return res.status(403).json({ error: 'Impossibile eliminare l\'admin' });
    // Elimina file utente
    const dir = path.join(LS_UPLOAD_BASE, username);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    const dbFile = getUserDbFile(username);
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    users.splice(idx, 1);
    lsSaveUsers(users);
    res.json({ success: true });
  });

  // ── Admin: cambia ruolo utente ───────────────────────────────────────────────
  server.put('/localsync/api/admin/users/:username/role', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.params;
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Ruolo non valido' });
    const users = lsGetUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.status(404).json({ error: 'Utente non trovato' });
    // Impedisci di declassare l'unico admin
    if (role === 'user' && users[idx].role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) return res.status(403).json({ error: 'Impossibile: è l\'unico amministratore' });
    }
    users[idx].role = role;
    lsSaveUsers(users);
    res.json({ success: true });
  });

  // ── Admin: forza logout utente (elimina tutti i token) ───────────────────────
  server.delete('/localsync/api/admin/users/:username/sessions', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.params;
    const users = lsGetUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.status(404).json({ error: 'Utente non trovato' });
    users[idx].tokens = [];
    lsSaveUsers(users);
    res.json({ success: true });
  });

  // ── Admin: cambia password utente ────────────────────────────────────────────
  server.put('/localsync/api/admin/users/:username/password', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.params;
    const { newPwdHash } = req.body;
    if (!newPwdHash || newPwdHash.length !== 64) return res.status(400).json({ error: 'Hash password non valido' });
    const users = lsGetUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.status(404).json({ error: 'Utente non trovato' });
    users[idx].pwdHash = newPwdHash;
    users[idx].tokens  = [];   // invalida tutte le sessioni esistenti
    lsSaveUsers(users);
    res.json({ success: true });
  });

  // ── Admin: reset app (elimina tutto) ─────────────────────────────────────────
  server.post('/localsync/api/admin/reset-app', requireAuth, requireAdmin, (req, res) => {
    try {
      // Elimina tutti i dati utenti
      const users = lsGetUsers();
      for (const u of users) {
        const dir = path.join(LS_UPLOAD_BASE, u.username);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        const dbFile = getUserDbFile(u.username);
        if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
      }
      // Elimina file utenti
      if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LocalForge hub (portale mobile) ─────────────────────────────────────────
  const lfPublicDir = path.join(__dirname, 'public', 'localforge');
  server.get('/localforge', (req, res) =>
    res.sendFile(path.join(lfPublicDir, 'index.html'))
  );
  server.use('/localforge', express.static(lfPublicDir));

  // ── LocalSync: file statici ─────────────────────────────────────────────────
  const lsPublicDir = path.join(__dirname, 'public', 'localsync');
  server.use('/localsync', express.static(lsPublicDir));
  server.get('/localsync', (req, res) =>
    res.sendFile(path.join(lsPublicDir, 'index.html'))
  );

  // ── LocalSync: QR Code ──────────────────────────────────────────────────────
  server.get('/localsync/api/qrcode', async (req, res) => {
    const localIP = getLocalIP();
    const url = `https://${localIP}:${port}/localforge`;
    try {
      const qrData = await QRCode.toDataURL(url);
      res.json({ success: true, qr: qrData, url });
    } catch {
      res.status(500).json({ error: 'Errore generazione QR' });
    }
  });

  // ── LocalSync: Upload ───────────────────────────────────────────────────────
  server.post('/localsync/upload', requireAuth, lsUpload.array('file'), (req, res) => {
    if (!req.files || req.files.length === 0)
      return res.status(400).send('Nessun file caricato');

    const username = req.lsUser?.username;
    const uploadedFiles = [];
    req.files.forEach(file => {
      const realName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const fileData = {
        id: Date.now() + Math.random(),
        name: realName,
        serverName: file.filename,
        url: `/localsync/files/${encodeURIComponent(file.filename)}`,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: 'file'
      };
      if (lsIo && username) lsIo.to('user-' + username).emit('new-file', fileData);
      uploadedFiles.push(fileData);
      notifier.notify({
        title: 'LocalSync',
        message: `File ricevuto: ${realName}`,
        sound: true
      });
    });
    res.json({ success: true, files: uploadedFiles });
  });

  // ── LocalSync: Download singolo ─────────────────────────────────────────────
  server.get('/localsync/files/:filename', requireAuth, (req, res) => {
    const username = req.lsUser?.username;
    if (!username) return res.status(401).send('Non autenticato');
    const filePath = path.join(getUserUploadDir(username), req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('File non trovato');
  });

  // ── LocalSync: Lista file ───────────────────────────────────────────────────
  server.get('/localsync/api/files', requireAuth, (req, res) => {
    const username = req.lsUser?.username;
    if (!username) return res.json([]);
    const dir = getUserUploadDir(username);
    fs.readdir(dir, (err, files) => {
      if (err) return res.json([]);
      const fileList = files.map(f => {
        const originalName = f.substring(f.indexOf('-') + 1);
        let size = '? MB';
        try {
          const stat = fs.statSync(path.join(dir, f));
          size = (stat.size / 1024 / 1024).toFixed(2) + ' MB';
        } catch {}
        return {
          name: originalName,
          serverName: f,
          url: `/localsync/files/${encodeURIComponent(f)}`,
          size,
          type: 'file'
        };
      }).reverse();
      res.json(fileList);
    });
  });

  // ── LocalSync: Sposta su PC ─────────────────────────────────────────────────
  server.post('/localsync/api/move-file', requireAuth, (req, res) => {
    const { fileName } = req.body;
    const username = req.lsUser?.username;
    if (!fileName || !username) return res.status(400).json({ error: 'Dati mancanti' });
    const PCIOS_DIR = path.join(os.homedir(), 'Desktop', 'PcIOS');
    if (!fs.existsSync(PCIOS_DIR)) fs.mkdirSync(PCIOS_DIR, { recursive: true });
    const sourcePath = path.join(getUserUploadDir(username), fileName);
    const cleanName  = fileName.substring(fileName.indexOf('-') + 1);
    const destPath   = path.join(PCIOS_DIR, cleanName);
    if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'File non trovato' });
    fs.copyFile(sourcePath, destPath, (err) => {
      if (err) return res.status(500).json({ error: 'Errore copia' });
      fs.unlink(sourcePath, () => {
        if (lsIo && username) lsIo.to('user-' + username).emit('file-deleted-server', fileName);
        res.json({ success: true });
      });
    });
  });

  // ── LocalSync: Rinomina ─────────────────────────────────────────────────────
  server.post('/localsync/api/rename-file', requireAuth, (req, res) => {
    const { fileName, newName } = req.body;
    const username = req.lsUser?.username;
    if (!fileName || !newName || !username) return res.status(400).json({ error: 'Dati mancanti' });
    const dir = getUserUploadDir(username);
    const oldPath = path.join(dir, fileName);
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'File non trovato' });
    const ext         = path.extname(fileName);
    const idPart      = fileName.split('-')[0];
    const safeNewName = newName.replace(/[^a-zA-Z0-9_\-\s\(\)]/g, '').trim();
    if (!safeNewName) return res.status(400).json({ error: 'Nome non valido' });
    const newPath = path.join(dir, `${idPart}-${safeNewName}${ext}`);
    fs.rename(oldPath, newPath, (err) => {
      if (err) return res.status(500).json({ error: 'Errore rinomina' });
      if (lsIo && username) lsIo.to('user-' + username).emit('file-renamed');
      res.json({ success: true });
    });
  });

  // ── LocalSync: Elimina ──────────────────────────────────────────────────────
  server.post('/localsync/api/delete-file', requireAuth, (req, res) => {
    const { fileName } = req.body;
    const username = req.lsUser?.username;
    if (!fileName || !username) return res.status(400).json({ error: 'Dati mancanti' });
    const filePath = path.join(getUserUploadDir(username), fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File inesistente' });
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ error: 'Errore eliminazione' });
      if (lsIo && username) lsIo.to('user-' + username).emit('file-deleted-server', fileName);
      res.json({ success: true });
    });
  });

  // ── LocalSync: Download ZIP ─────────────────────────────────────────────────
  server.get('/localsync/api/download-all', requireAuth, (req, res) => {
    const username = req.lsUser?.username;
    if (!username) return res.status(401).send('Non autenticato');
    const dir = getUserUploadDir(username);
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`LocalSync_Archive_${Date.now()}.zip`);
    archive.pipe(res);
    archive.directory(dir, false);
    archive.finalize();
  });

  // ── Next.js handler (catch-all — deve essere ULTIMO) ───────────────────────
  if (dev) {
    server.all('*', (req, res) => handle(req, res));
  } else {
    server.all('*', proxyToStandalone);
  }

  // ─── HTTPS Server + Socket.IO ─────────────────────────────────────────────
  const httpServer = https.createServer({ key: sslCreds.key, cert: sslCreds.cert }, server);
  const io = new Server(httpServer);

  // Namespace FileForge (default)
  io.on('connection', () => {});

  // Namespace LocalSync
  lsIo = io.of('/localsync');

  // Middleware auth per Socket.IO
  lsIo.use((socket, next) => {
    const token = socket.handshake.auth?.token || '';
    const addr  = socket.handshake.address || '';
    const isLocal = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';

    if (token) {
      const user = lsFindUserByToken(token);
      if (user) { socket.lsUser = user; return next(); }
    }
    if (isLocal) {
      const admin = lsGetUsers().find(u => u.role === 'admin');
      socket.lsUser = admin || null;
      return next();
    }
    return next(new Error('Non autenticato'));
  });

  lsIo.on('connection', (socket) => {
    const username = socket.lsUser?.username;
    if (username) socket.join('user-' + username);

    const items = username ? loadUserItems(username) : [];
    socket.emit('init-items', items);

    socket.on('add-item', (item) => {
      if (!username) return;
      const userItems = loadUserItems(username);
      userItems.unshift(item);
      if (userItems.length > 50) userItems.pop();
      saveUserItems(username, userItems);
      lsIo.to('user-' + username).emit('new-item', item);
      notifier.notify({
        title: 'LocalSync Stream',
        message:
          item.type === 'code'     ? 'Nuovo snippet di codice ricevuto' :
          item.type === 'password' ? 'Ricevuta nuova password' :
                                     'Nuovo appunto ricevuto',
        sound: true
      });
    });

    socket.on('edit-item', (data) => {
      if (!username) return;
      const userItems = loadUserItems(username);
      const index = userItems.findIndex(i => i.id == data.id);
      if (index !== -1) {
        userItems[index].content = data.content;
        if (userItems[index].type === 'text' || userItems[index].type === 'link') {
          userItems[index].type = /^https?:\/\//i.test(data.content) ? 'link' : 'text';
        }
        saveUserItems(username, userItems);
        lsIo.to('user-' + username).emit('item-updated', userItems[index]);
      }
    });

    socket.on('delete-item', (id) => {
      if (!username) return;
      const userItems = loadUserItems(username).filter(i => i.id !== id);
      saveUserItems(username, userItems);
      lsIo.to('user-' + username).emit('item-deleted', id);
    });

    socket.on('clear-all', () => {
      if (!username) return;
      saveUserItems(username, []);
      lsIo.to('user-' + username).emit('clear-all');
    });
  });

  // ─── Avvio ────────────────────────────────────────────────────────────────
  httpServer.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> FileForge  → https://localhost:${port}/fileforge`);
    console.log(`> LocalSync  → https://localhost:${port}/localsync`);
    console.log(`> LocalSync  → https://${getLocalIP()}:${port}/localsync  ← mobile`);
  });
}).catch((err) => {
  console.error('[Bootstrap] Errore avvio server:', err);
  process.exit(1);
});

process.on('exit', () => {
  if (standaloneProc && !standaloneProc.killed) standaloneProc.kill();
});
