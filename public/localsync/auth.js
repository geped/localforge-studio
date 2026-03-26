// ─── LocalSync Auth — server-side ─────────────────────────────────────────────
// PC (localhost): accesso diretto senza password
// Mobile: login con username/password salvati sul server

const SECURITY_QUESTIONS = [
    { id: 'q1', text: "Qual è il cognome da nubile di tua madre?" },
    { id: 'q2', text: "Come si chiamava il tuo primo animale domestico?" },
    { id: 'q3', text: "In che città sei nato/a?" },
    { id: 'q4', text: "Qual è il tuo film preferito?" },
    { id: 'q5', text: "Qual era il nome della tua prima scuola elementare?" },
    { id: 'q6', text: "Qual è il nome della via in cui sei cresciuto/a?" },
];

const LS_TOKEN_KEY  = 'ls_auth_token';
const isLocalhost   = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

// ─── Crypto ───────────────────────────────────────────────────────────────────
async function lsHash(input) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const enc = new TextEncoder();
            const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {}
    }
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(16).padStart(8, '0').repeat(8);
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function _api(method, path, body) {
    try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const r = await fetch('/localsync/api/auth/' + path, opts);
        return r.json();
    } catch { return {}; }
}
const apiStatus            = ()             => _api('GET',  'status');
const apiRegister          = (u, h)         => _api('POST', 'register',          { username: u, pwdHash: h });
const apiLogin             = (u, h)         => _api('POST', 'login',              { username: u, pwdHash: h });
const apiVerify            = (token)        => _api('POST', 'verify',             { token });
const apiLogout            = (token)        => _api('POST', 'logout',             { token });
const apiGetQuestions      = (u)            => _api('GET',  'recovery-questions' + (u ? '?username=' + encodeURIComponent(u) : ''));
const apiRecoveryVerify    = (u, answers)   => _api('POST', 'recovery-verify',    { username: u, answers });
const apiResetPassword     = (u, t, h)      => _api('POST', 'reset-password',     { username: u, resetToken: t, newPwdHash: h });

// ─── UI refs ──────────────────────────────────────────────────────────────────
const overlay      = document.getElementById('authOverlay');
const loginView    = document.getElementById('loginView');
const noAccView    = document.getElementById('noAccountView');
const recoveryView = document.getElementById('recoveryView');
const resetView    = document.getElementById('resetView');
const choiceView   = document.getElementById('choiceView');
const registerView = document.getElementById('registerView');

const _allViews = ['loginView','noAccountView','recoveryView','resetView','choiceView','registerView'];

function showView(id) {
    _allViews.forEach(vid => {
        const el = document.getElementById(vid);
        if (el) el.classList.add('hidden');
    });
    const t = document.getElementById(id);
    if (t) t.classList.remove('hidden');
    if (id === 'loginView') vkbInit();
}
function overlayShow() { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }
function overlayHide() { overlay.classList.add('hidden');   overlay.classList.remove('flex'); }

// ─── Mostra username + ruolo in navbar ───────────────────────────────────────
function _setNavUsername(name, role) {
    const el = document.getElementById('navUsername');
    if (!el) return;
    if (name) {
        const roleLabel = role === 'admin' ? ' · admin' : '';
        el.textContent = name + roleLabel;
        el.classList.remove('hidden');
        el.style.display = '';
    } else {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function authInit() {
    // PC (localhost): ottieni info utente via whoami
    if (isLocalhost) {
        try {
            const r = await fetch('/localsync/api/auth/whoami');
            const d = await r.json();
            if (d.username) _setNavUsername(d.username, d.role);
        } catch {}
        return;
    }

    // Mobile: controlla token salvato
    const token = localStorage.getItem(LS_TOKEN_KEY);
    if (token) {
        const v = await apiVerify(token);
        if (v.valid) {
            _setNavUsername(v.username || '', v.role || '');
            return; // già autenticato
        }
        localStorage.removeItem(LS_TOKEN_KEY);
    }

    // Mostra schermata di scelta (Crea Account / Accedi)
    showView('choiceView');
    overlayShow();
}

// ─── Registrazione mobile ─────────────────────────────────────────────────────
async function doRegister() {
    const username = (document.getElementById('reg-username')?.value || '').trim();
    const pwd1     = document.getElementById('reg-pwd1')?.value || '';
    const pwd2     = document.getElementById('reg-pwd2')?.value || '';
    const errEl    = document.getElementById('registerError');
    errEl.classList.add('hidden');

    if (!username || username.length < 2) { errEl.textContent = 'Username min. 2 caratteri.'; errEl.classList.remove('hidden'); return; }
    if (pwd1.length < 6)  { errEl.textContent = 'Password min. 6 caratteri.'; errEl.classList.remove('hidden'); return; }
    if (pwd1 !== pwd2)    { errEl.textContent = 'Le password non coincidono.'; errEl.classList.remove('hidden'); return; }

    const pwdHash = await lsHash(pwd1);
    const result  = await apiRegister(username, pwdHash);
    if (result.token) {
        localStorage.setItem(LS_TOKEN_KEY, result.token);
        overlayHide();
        // Reconnect socket with authenticated token
        if (typeof socket !== 'undefined') {
            socket.auth = { token: result.token };
            socket.disconnect().connect();
        }
        showToast('Account creato. Benvenuto!');
    } else {
        errEl.textContent = result.error || 'Errore registrazione. Riprova.';
        errEl.classList.remove('hidden');
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function doLogin() {
    const errEl    = document.getElementById('loginError');
    const username = (document.getElementById('loginUsernameInput')?.value || '').trim();
    errEl.style.display = 'none';

    if (!username) {
        errEl.textContent = 'Inserisci lo username.';
        errEl.style.display = 'block';
        return;
    }
    if (!_vkbPwd) {
        errEl.textContent = 'Inserisci la password.';
        errEl.style.display = 'block';
        return;
    }
    const pwdHash = await lsHash(_vkbPwd);
    const result  = await apiLogin(username, pwdHash);
    if (result.token) {
        localStorage.setItem(LS_TOKEN_KEY, result.token);
        overlayHide();
        _setNavUsername(result.username || '', result.role || '');
        // Reconnect socket with authenticated token
        if (typeof socket !== 'undefined') {
            socket.auth = { token: result.token };
            socket.disconnect().connect();
        }
        showToast('Accesso effettuato.');
    } else {
        errEl.textContent = result.error || 'Credenziali errate. Riprova.';
        errEl.style.display = 'block';
        _vkbPwd = '';
        _vkbUpdateDisplay();
        const card = document.getElementById('loginCard');
        if (card) { card.style.animation = 'shake 0.3s ease'; setTimeout(() => card.style.animation = '', 400); }
    }
}

function logout() {
    const token = localStorage.getItem(LS_TOKEN_KEY);
    if (token) { apiLogout(token); localStorage.removeItem(LS_TOKEN_KEY); }
    showView('choiceView');
    overlayShow();
    showToast('Disconnesso.');
}

// ─── Recupero password ────────────────────────────────────────────────────────
let _recoveryUsername = null;
async function showRecovery() {
    const username = (document.getElementById('loginUsernameInput')?.value || '').trim();
    _recoveryUsername = username || null;
    const data = await apiGetQuestions(username || undefined);
    if (!data?.questions?.length) {
        showToast('Nessuna domanda di sicurezza configurata.');
        return;
    }
    const container = document.getElementById('recoveryQAContainer');
    container.innerHTML = '';
    data.questions.forEach((qid, i) => {
        const q = SECURITY_QUESTIONS.find(q => q.id === qid);
        const div = document.createElement('div');
        div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <label class="text-xs font-medium" style="color:var(--muted)">${q ? q.text : 'Domanda ' + (i+1)}</label>
            <input type="text" id="rec-a-${i}" data-qid="${qid}" placeholder="La tua risposta..." class="auth-input text-sm" autocomplete="off">
        `;
        container.appendChild(div);
    });
    showView('recoveryView');
    overlayShow();
}

async function verifyRecovery() {
    const inputs  = document.querySelectorAll('[data-qid]');
    const answers = [];
    for (const inp of inputs) {
        const ans = inp.value.trim().toLowerCase();
        if (!ans) { document.getElementById('recoveryError').textContent = 'Rispondi a tutte le domande.'; document.getElementById('recoveryError').classList.remove('hidden'); return; }
        answers.push({ id: inp.dataset.qid, ansHash: await lsHash(ans) });
    }
    const result = await apiRecoveryVerify(_recoveryUsername, answers);
    if (result.success) {
        _resetToken = result.resetToken;
        showView('resetView');
    } else {
        document.getElementById('recoveryError').textContent = 'Risposte non corrette. Verifica e riprova.';
        document.getElementById('recoveryError').classList.remove('hidden');
    }
}

let _resetToken = null;
async function resetPassword() {
    const pwd1  = document.getElementById('reset-pwd1').value;
    const pwd2  = document.getElementById('reset-pwd2').value;
    const errEl = document.getElementById('resetError');
    errEl.classList.add('hidden');
    if (pwd1.length < 6) { errEl.textContent = 'Min. 6 caratteri.'; errEl.classList.remove('hidden'); return; }
    if (pwd1 !== pwd2)   { errEl.textContent = 'Le password non coincidono.'; errEl.classList.remove('hidden'); return; }
    const newHash = await lsHash(pwd1);
    const result  = await apiResetPassword(_recoveryUsername, _resetToken, newHash);
    if (result.success) {
        localStorage.removeItem(LS_TOKEN_KEY);
        showView('choiceView');
        overlayShow();
        showToast('Password reimpostata con successo!');
    } else {
        errEl.textContent = result.error || 'Errore. Riprova.';
        errEl.classList.remove('hidden');
    }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
function togglePwdVisibility(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    if (!input) return;
    if (input.type === 'password') { input.type = 'text';     if (btn) btn.innerHTML = svgEyeSlash; }
    else                           { input.type = 'password'; if (btn) btn.innerHTML = svgEye; }
}
const svgEye      = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const svgEyeSlash = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>`;

// ─── Tastiera Virtuale ────────────────────────────────────────────────────────
let _vkbMode  = 'num';   // 'num' | 'alpha' | 'sym'
let _vkbShift = false;
let _vkbPwd   = '';

const _svgBack = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8L1 12l7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="13" y2="14"/><line x1="13" y1="9" x2="18" y2="14"/></svg>`;
const _svgShiftIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/></svg>`;

function vkbInit() {
    _vkbMode  = 'num';
    _vkbShift = false;
    _vkbPwd   = '';
    const errEl = document.getElementById('loginError');
    if (errEl) errEl.style.display = 'none';
    _vkbUpdateDisplay();
    _vkbRender();
}

function vkbTypeChar(ch) { _vkbPwd += ch; _vkbUpdateDisplay(); }
function vkbBack()       { _vkbPwd = _vkbPwd.slice(0, -1); _vkbUpdateDisplay(); }

function _vkbUpdateDisplay() {
    const display = document.getElementById('pwdDisplay');
    if (!display) return;
    display.innerHTML = _vkbPwd.length === 0
        ? '<span class="pwd-placeholder">Inserisci la password...</span>'
        : Array.from(_vkbPwd).map(() => '<span class="pwd-dot"></span>').join('');
    const input = document.getElementById('login-pwd');
    if (input) input.value = _vkbPwd;
}

function _vkbBtn(label, action, cls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vkb-key ' + (cls || '');
    if (label instanceof Node) btn.appendChild(label);
    else btn.textContent = label;
    btn.addEventListener('mousedown', e => e.preventDefault());
    // iOS fix: touchend fires action and blocks the redundant click event
    let _touched = false;
    btn.addEventListener('touchend', e => {
        e.preventDefault();
        _touched = true;
        action();
        setTimeout(() => { _touched = false; }, 400);
    }, { passive: false });
    btn.addEventListener('click', () => { if (!_touched) action(); });
    return btn;
}
function _svgEl(s) { const sp = document.createElement('span'); sp.innerHTML = s; return sp.firstChild; }

function _vkbRender() {
    const container = document.getElementById('vkbContainer');
    if (!container) return;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'vkb-wrap';
    container.appendChild(wrap);
    if      (_vkbMode === 'num')   _vkbRenderNum(wrap);
    else if (_vkbMode === 'alpha') _vkbRenderAlpha(wrap);
    else                           _vkbRenderSym(wrap);
}

function _vkbLoginRow(wrap) {
    const row = document.createElement('div');
    row.className = 'vkb-row mt-1';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'vkb-login';
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14"/></svg> Accedi`;
    btn.addEventListener('mousedown', e => e.preventDefault());
    let _ltouched = false;
    btn.addEventListener('touchend', e => {
        e.preventDefault();
        _ltouched = true;
        doLogin();
        setTimeout(() => { _ltouched = false; }, 400);
    }, { passive: false });
    btn.addEventListener('click', () => { if (!_ltouched) doLogin(); });
    row.appendChild(btn);
    wrap.appendChild(row);
}

function _vkbRenderNum(wrap) {
    [['1','2','3'], ['4','5','6'], ['7','8','9'], ['ABC','0','⌫']].forEach(keys => {
        const row = document.createElement('div'); row.className = 'vkb-row';
        keys.forEach(k => {
            if      (k === '⌫')  row.appendChild(_vkbBtn(_svgEl(_svgBack), () => vkbBack(), 'vkb-action'));
            else if (k === 'ABC') row.appendChild(_vkbBtn('ABC', () => { _vkbMode = 'alpha'; _vkbRender(); }, 'vkb-action'));
            else                  row.appendChild(_vkbBtn(k, () => vkbTypeChar(k)));
        });
        wrap.appendChild(row);
    });
    _vkbLoginRow(wrap);
}

function _vkbRenderAlpha(wrap) {
    const rows = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l'],
        ['SHIFT','z','x','c','v','b','n','m','BACK'],
        ['NUM','!?','SPACE','DONE'],
    ];
    rows.forEach(keys => {
        const row = document.createElement('div'); row.className = 'vkb-row';
        keys.forEach(k => {
            let btn;
            if (k === 'SHIFT') {
                btn = _vkbBtn(_svgEl(_svgShiftIcon), () => { _vkbShift = !_vkbShift; _vkbRender(); },
                    'vkb-akey vkb-action vkb-wide' + (_vkbShift ? ' vkb-shift-on' : ''));
            } else if (k === 'BACK') {
                btn = _vkbBtn(_svgEl(_svgBack), () => vkbBack(), 'vkb-akey vkb-action vkb-wide');
            } else if (k === 'NUM') {
                btn = _vkbBtn('123', () => { _vkbMode = 'num'; _vkbRender(); }, 'vkb-akey vkb-action vkb-wide');
            } else if (k === '!?') {
                btn = _vkbBtn('!?@', () => { _vkbMode = 'sym'; _vkbRender(); }, 'vkb-akey vkb-action vkb-wide');
            } else if (k === 'SPACE') {
                btn = _vkbBtn('spazio', () => vkbTypeChar(' '), 'vkb-akey vkb-space');
            } else if (k === 'DONE') {
                btn = _vkbBtn('✓', () => doLogin(), 'vkb-akey vkb-action vkb-wide');
                btn.style.cssText += 'background:var(--primary);border-color:transparent;color:#fff;font-size:16px;';
            } else {
                const ch = _vkbShift ? k.toUpperCase() : k;
                btn = _vkbBtn(ch, () => { vkbTypeChar(_vkbShift ? k.toUpperCase() : k); if (_vkbShift) { _vkbShift = false; _vkbRender(); } }, 'vkb-akey');
            }
            row.appendChild(btn);
        });
        wrap.appendChild(row);
    });
}

function _vkbRenderSym(wrap) {
    const rows = [
        ['!','@','#','$','%','^'],
        ['&','*','(',')','_','-'],
        ['+','=','/','?','.',','],
        [';',':','"',"'",'[',']'],
        ['{','}','\\','~','`','|'],
        ['ABC','SPACE','DONE'],
    ];
    rows.forEach(keys => {
        const row = document.createElement('div'); row.className = 'vkb-row';
        keys.forEach(k => {
            let btn;
            if (k === 'ABC') {
                btn = _vkbBtn('ABC', () => { _vkbMode = 'alpha'; _vkbRender(); }, 'vkb-akey vkb-action vkb-wide');
            } else if (k === 'SPACE') {
                btn = _vkbBtn('spazio', () => vkbTypeChar(' '), 'vkb-akey vkb-space');
            } else if (k === 'DONE') {
                btn = _vkbBtn('✓', () => doLogin(), 'vkb-akey vkb-action vkb-wide');
                btn.style.cssText += 'background:var(--primary);border-color:transparent;color:#fff;font-size:16px;';
            } else {
                btn = _vkbBtn(k, () => vkbTypeChar(k), 'vkb-akey vkb-sym');
            }
            row.appendChild(btn);
        });
        wrap.appendChild(row);
    });
}

// ─── Tastiera fisica ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    // Non intercettare i tasti digitati dentro input reali (es. campo username)
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // Enter sul campo username → sposta il focus al display password
        if (e.key === 'Enter' && e.target.id === 'loginUsernameInput') {
            e.preventDefault();
            document.getElementById('pwdDisplay')?.focus();
        }
        return;
    }
    const ov = document.getElementById('authOverlay');
    const lv = document.getElementById('loginView');
    if (!ov || ov.classList.contains('hidden')) return;
    if (!lv || lv.classList.contains('hidden')) return;
    if (e.key === 'Backspace')                               { vkbBack();          e.preventDefault(); }
    else if (e.key === 'Enter')                              { doLogin();          e.preventDefault(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { vkbTypeChar(e.key); e.preventDefault(); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => authInit());
