// Gestione file (upload, download, lista)
let _currentSavePath = '';

function loadSavePath() {
    const token = localStorage.getItem('ls_auth_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    fetch('/localsync/api/config', { headers })
        .then(r => r.json())
        .then(d => {
            if (d.savePath) {
                _currentSavePath = d.savePath;
                const el = document.getElementById('savePathDisplay');
                if (el) el.textContent = d.savePath;
            }
        })
        .catch(() => {});
}

function _authHeaders(extra) {
    const token = localStorage.getItem('ls_auth_token') || '';
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
}

const fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) { handleFileSelect(e.target.files); e.target.value = ''; }
    });
}

const dropZone = document.getElementById('dropZone');
if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
        dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); })
    );
    dropZone.addEventListener('dragover',  () => dropZone.classList.add('dragging'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragging');
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files);
    });
}

document.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') files.push(items[i].getAsFile());
    }
    if (files.length > 0) handleFileSelect(files);
});

function handleFileSelect(files) {
    const formData = new FormData();
    [...files].forEach(file => formData.append('file', file));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/localsync/upload', true);
    const token = localStorage.getItem('ls_auth_token') || '';
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            document.getElementById('progressContainer').classList.remove('hidden');
            const pct = Math.round((e.loaded / e.total) * 100);
            document.getElementById('progressBar').style.width = pct + '%';
            document.getElementById('progressText').innerText = pct + '%';
        }
    };
    xhr.onload = () => {
        document.getElementById('progressContainer').classList.add('hidden');
        document.getElementById('progressBar').style.width = '0';
        if (xhr.status === 200) showToast('File caricato con successo!');
        else showToast('Errore durante il caricamento');
    };
    xhr.send(formData);
}

socket.on('new-file', (file) => { renderFile(file, true); updateFileCount(1); });

socket.on('file-deleted-server', (name) => {
    const el = document.querySelector(`[data-servername="${CSS.escape(name)}"]`);
    if (el) { el.remove(); updateFileCount(-1); }
});

socket.on('file-renamed', () => loadFileList());

let currentFileCount = 0;
function updateFileCount(change) {
    currentFileCount = Math.max(0, currentFileCount + change);
    const fCount = document.getElementById('fileCount');
    const mCount = document.getElementById('mobileFileCount');
    if (fCount) fCount.innerText = currentFileCount;
    if (mCount) mCount.innerText = currentFileCount;
}

function loadFileList() {
    fetch('/localsync/api/files', { headers: _authHeaders({}) })
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then(files => {
            if (!Array.isArray(files)) return;
            const list = document.getElementById('fileList');
            if (list) list.innerHTML = '';
            currentFileCount = 0;
            files.forEach(f => { renderFile(f); currentFileCount++; });
            updateFileCount(0);
            setupSearchBar();
        })
        .catch(err => console.warn('Caricamento file list fallito:', err.message));
}

socket.on('connect', () => { loadFileList(); loadSavePath(); });
if (socket.connected) { loadFileList(); loadSavePath(); }

function setupSearchBar() {
    if (document.getElementById('localSearchInput')) return;
    const fileList = document.getElementById('fileList');
    const searchContainer = document.createElement('div');
    searchContainer.className = 'mb-3 relative';
    searchContainer.innerHTML = `
        <input type="text" id="localSearchInput" placeholder="Cerca file..."
            class="w-full text-sm outline-none p-2.5 pl-9 rounded-lg transition"
            style="background:var(--card-alt);border:1px solid var(--border);color:var(--text)">
        <div class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--muted)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        </div>`;
    fileList.parentElement.insertBefore(searchContainer, fileList);
    document.getElementById('localSearchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#fileList li').forEach(li => {
            const name = li.querySelector('span')?.innerText.toLowerCase() || '';
            li.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });
}

function renderFile(file, prepend = false) {
    const list = document.getElementById('fileList');
    const ext  = (file.name.match(/\.([^.]+)$/) || ['', ''])[1].toLowerCase();
    const isImg  = ['jpeg','jpg','gif','png','webp'].includes(ext);
    const isVideo = ['mp4','webm','mov'].includes(ext);
    const isAudio = ['mp3','wav','ogg'].includes(ext);
    const isPdf  = ext === 'pdf';
    const isArchive = ['zip','rar','7z','tar','gz'].includes(ext);
    const canPreview = isImg || isVideo || isAudio || isPdf;

    const safeServerName = encodeURIComponent(file.serverName);
    const _tok = localStorage.getItem('ls_auth_token') || '';
    const secureUrl = `/localsync/files/${safeServerName}?t=${Date.now()}` + (_tok ? `&token=${encodeURIComponent(_tok)}` : '');
    const escSafeName   = safeServerName.replace(/'/g, "\\'");
    const escName       = file.name.replace(/'/g, "\\'");
    const escServerName = file.serverName.replace(/'/g, "\\'");
    const escUrl        = secureUrl.replace(/'/g, "\\'");

    // Icone per tipo file
    const thumbHtml = isImg
        ? `<img src="${secureUrl}" class="w-full h-full object-cover">`
        : isVideo
        ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--muted)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`
        : isAudio
        ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--muted)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`
        : isPdf
        ? `<svg class="w-6 h-6" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`
        : isArchive
        ? `<svg class="w-6 h-6" fill="none" stroke="#f59e0b" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>`
        : `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:var(--muted)"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;

    const li = document.createElement('li');
    li.dataset.servername = file.serverName;
    li.className = 'file-item flex flex-col gap-2';
    li.innerHTML = `
        <div class="flex items-center gap-3 w-full">
            <div class="w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style="background:var(--card);border:1px solid var(--border)">
                ${thumbHtml}
            </div>
            <div class="flex-1 min-w-0">
                <span class="text-sm font-medium truncate block" style="color:var(--text)" title="${file.name}">${file.name}</span>
                <p class="text-xs mt-0.5" style="color:var(--muted)">${file.size || '? MB'}</p>
            </div>
            <button onclick="renameFile('${escServerName}','${escName}')" class="p-1.5 transition" style="color:var(--muted)" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'" title="Rinomina">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
        </div>
        <div class="flex gap-1.5 justify-end pt-2" style="border-top:1px solid var(--border)">
            ${canPreview ? `
            <button onclick="openPreview('${escSafeName}','${escName}','${ext}')" class="btn flex-1" style="background:rgba(99,102,241,0.12);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)" onmouseover="this.style.background='#4f46e5';this.style.color='white'" onmouseout="this.style.background='rgba(99,102,241,0.12)';this.style.color='#a5b4fc'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Anteprima
            </button>` : ''}
            <button onclick="downloadFile('${escUrl}','${escName}')" class="btn flex-1" style="background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.2)" onmouseover="this.style.background='#059669';this.style.color='white'" onmouseout="this.style.background='rgba(16,185,129,0.12)';this.style.color='#34d399'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Salva
            </button>
            <button onclick="moveToPcIos('${escServerName}')" class="btn flex-1" style="background:rgba(6,182,212,0.12);color:var(--accent);border:1px solid rgba(6,182,212,0.2)" onmouseover="this.style.background='#0891b2';this.style.color='white'" onmouseout="this.style.background='rgba(6,182,212,0.12)';this.style.color='var(--accent)'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> PC
            </button>
            <button onclick="deleteFile('${escServerName}')" class="btn" style="background:rgba(239,68,68,0.1);color:var(--destructive);border:1px solid rgba(239,68,68,0.2)" onmouseover="this.style.background='#dc2626';this.style.color='white'" onmouseout="this.style.background='rgba(239,68,68,0.1)';this.style.color='var(--destructive)'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>`;

    if (prepend) list.insertBefore(li, list.firstChild);
    else list.appendChild(li);
}

function renameFile(serverName, currentDisplayName) {
    const nameWithoutExt = currentDisplayName.substring(0, currentDisplayName.lastIndexOf('.'));
    const newName = prompt("Nuovo nome (estensione invariata):", nameWithoutExt);
    if (newName && newName.trim() && newName !== nameWithoutExt) {
        fetch('/localsync/api/rename-file', {
            method: 'POST',
            headers: _authHeaders({}),
            body: JSON.stringify({ fileName: serverName, newName })
        }).then(r => r.json()).then(d => {
            if (d.success) showToast('File rinominato!');
        });
    }
}

function moveToPcIos(fileName) {
    fetch('/localsync/api/move-file', {
        method: 'POST',
        headers: _authHeaders({}),
        body: JSON.stringify({ fileName })
    }).then(r => r.json()).then(d => {
        if (d.success) {
            const folder = _currentSavePath.split(/[\\/]/).pop() || 'PC';
            showToast('Spostato in ' + folder + '!');
        }
    });
}

function deleteFile(fileName) {
    fetch('/localsync/api/delete-file', {
        method: 'POST',
        headers: _authHeaders({}),
        body: JSON.stringify({ fileName })
    });
}

function downloadAllZip() {
    const list = document.getElementById('fileList');
    if (!list || list.children.length === 0) { showToast('Nessun file da scaricare'); return; }
    const token = localStorage.getItem('ls_auth_token') || '';
    window.location.href = '/localsync/api/download-all' + (token ? '?token=' + encodeURIComponent(token) : '');
    showToast('Compressione ZIP in corso...');
}

function downloadFile(url, fileName) {
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Download avviato');
}

function openPreview(safeServerName, fileName, ext) {
    const modal   = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    const title   = document.getElementById('previewTitle');
    const secureUrl = `/localsync/files/${safeServerName}?t=${Date.now()}`;
    title.innerText = fileName;
    content.innerHTML = '';
    const isImg   = ['jpeg','jpg','gif','png','webp'].includes(ext);
    const isVideo = ['mp4','webm','mov'].includes(ext);
    const isAudio = ['mp3','wav','ogg'].includes(ext);
    const isPdf   = ext === 'pdf';
    if (isImg)   content.innerHTML = `<img src="${secureUrl}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" style="border:1px solid var(--border)">`;
    else if (isVideo) content.innerHTML = `<video src="${secureUrl}" controls autoplay class="max-w-full max-h-[80vh] rounded-lg shadow-2xl" style="border:1px solid var(--border)"></video>`;
    else if (isAudio) content.innerHTML = `<audio src="${secureUrl}" controls autoplay class="w-full max-w-md mt-10 shadow-2xl"></audio>`;
    else if (isPdf)   content.innerHTML = `<iframe src="${secureUrl}" class="w-full h-[80vh] rounded-lg shadow-2xl bg-white" style="border:1px solid var(--border)"></iframe>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closePreview() {
    const modal = document.getElementById('previewModal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
    document.getElementById('previewContent').innerHTML = '';
}
