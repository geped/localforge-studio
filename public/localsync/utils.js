// Funzioni di utilità e interfaccia grafica

function showToast(msg, icon) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    const iconEl = document.getElementById('toastIcon');
    if (msgEl) msgEl.innerText = msg;
    if (iconEl && icon) iconEl.innerHTML = icon;
    t.classList.remove('-translate-y-40');
    setTimeout(() => t.classList.add('-translate-y-40'), 2500);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copiato negli appunti'));
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url =>
        `<a href="${url}" target="_blank" style="color:var(--accent)" class="hover:underline">${url}</a>`
    );
}

function switchTab(tab) {
    const streamView = document.getElementById('view-stream');
    const filesView  = document.getElementById('view-files');
    const tabStream  = document.getElementById('tab-stream');
    const tabFiles   = document.getElementById('tab-files');

    if (tab === 'stream') {
        streamView.classList.remove('hidden'); streamView.classList.add('flex');
        filesView.classList.add('hidden');     filesView.classList.remove('flex');
        tabStream.classList.add('active');     tabFiles.classList.remove('active');
    } else {
        filesView.classList.remove('hidden');  filesView.classList.add('flex');
        streamView.classList.add('hidden');    streamView.classList.remove('flex');
        tabFiles.classList.add('active');      tabStream.classList.remove('active');
    }
}

async function toggleQr(show) {
    const modal = document.getElementById('qrModal');
    if (show) {
        modal.classList.remove('hidden');
        try {
            const res  = await fetch('/localsync/api/qrcode');
            const data = await res.json();
            if (data.success) {
                document.getElementById('qrImage').src = data.qr;
                document.getElementById('qrUrl').innerText = data.url;
            }
        } catch {}
    } else {
        modal.classList.add('hidden');
    }
}
