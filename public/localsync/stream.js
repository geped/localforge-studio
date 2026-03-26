// Stream real-time (clipboard items)
let streamItems = [];

socket.on('init-items', (items) => {
    streamItems = items;
    const container = document.getElementById('streamContainer');
    container.innerHTML = '';
    if (items.length === 0) {
        renderEmptyState(container);
    } else {
        items.forEach(item => renderCard(item));
        if (window.hljs) hljs.highlightAll();
    }
});

socket.on('new-item', (item) => {
    streamItems.unshift(item);
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.remove();
    renderCard(item, true);
    if (window.hljs) hljs.highlightAll();
});

socket.on('item-deleted', (id) => {
    streamItems = streamItems.filter(i => i.id !== id);
    const el = document.getElementById(`item-${id}`);
    if (el) el.remove();
    const container = document.getElementById('streamContainer');
    if (container.children.length === 0) renderEmptyState(container);
});

socket.on('item-updated', (item) => {
    const index = streamItems.findIndex(i => i.id == item.id);
    if (index !== -1) streamItems[index] = item;
    const el = document.getElementById(`item-${item.id}`);
    if (el) {
        el.innerHTML = generateCardHtml(item);
        if (window.hljs) hljs.highlightAll();
    }
});

socket.on('clear-all', () => {
    const container = document.getElementById('streamContainer');
    renderEmptyState(container);
});

function renderEmptyState(container) {
    container.innerHTML = `
        <div id="emptyState" class="flex flex-col items-center justify-center h-48" style="opacity:0.3">
            <svg class="w-16 h-16 mb-3" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="color:var(--muted)">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
            </svg>
            <p class="text-sm font-medium" style="color:var(--muted)">Nessun dato presente</p>
            <p class="text-xs mt-1" style="color:var(--muted)">I messaggi appariranno qui in tempo reale</p>
        </div>
    `;
}

function renderCard(item, prepend = false) {
    const container = document.getElementById('streamContainer');
    const div = document.createElement('div');
    div.id = `item-${item.id}`;
    div.className = 'stream-item group';
    div.innerHTML = generateCardHtml(item);
    if (prepend) container.insertBefore(div, container.firstChild);
    else container.appendChild(div);
}

function generateCardHtml(item) {
    const typeIcons = {
        text: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>`,
        link: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`,
        code: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`,
        password: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>`
    };

    let contentHtml = '';
    if (item.type === 'code') {
        contentHtml = `<pre><code class="language-javascript rounded-lg text-sm">${escapeHtml(item.content)}</code></pre>`;
    } else if (item.type === 'link') {
        const url = item.content;
        let previewHtml = '';
        if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
            previewHtml = `<div class="mt-3 rounded-lg overflow-hidden" style="border:1px solid var(--border)"><img src="${url}" class="max-w-full max-h-64 object-contain" style="background:var(--card)"></div>`;
        } else if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
            if (videoId) previewHtml = `<div class="mt-3 rounded-lg overflow-hidden aspect-video" style="border:1px solid var(--border)"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div>`;
        }
        contentHtml = `<a href="${url}" target="_blank" style="color:var(--accent)" class="hover:underline break-all flex items-center gap-2">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            ${url}
        </a>${previewHtml}`;
    } else if (item.type === 'password') {
        contentHtml = `
            <div class="flex items-center gap-3 p-3 rounded-lg" style="background:var(--card);border:1px solid var(--border)">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="#fbbf24" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                <input type="password" value="${escapeHtml(item.content)}" readonly
                    class="bg-transparent border-none outline-none font-mono flex-1 text-lg tracking-wider w-full" style="color:var(--text)"
                    id="pwd-${item.id}">
                <button onclick="copyToClipboard('${escapeHtml(item.content).replace(/'/g, "\\'")}')" style="color:var(--muted)" class="p-2 hover:text-white transition" title="Copia">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button onclick="togglePasswordVisibility('${item.id}')" style="color:var(--muted)" class="p-2 hover:text-white transition">
                    <svg id="eye-${item.id}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <svg id="eye-slash-${item.id}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 hidden">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                    </svg>
                </button>
            </div>`;
    } else {
        contentHtml = `<p class="whitespace-pre-wrap break-words font-light leading-relaxed" style="color:#cbd5e1">${formatText(item.content)}</p>`;
    }

    const copyBtn = item.type === 'password' ? '' :
        `<button onclick="copyToClipboard(\`${escapeHtml(item.content)}\`)" style="color:var(--muted)" class="hover:text-white transition" title="Copia">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>`;
    const editBtn =
        `<button onclick="startEditing('${item.id}')" style="color:var(--muted)" class="hover:text-yellow-400 transition" title="Modifica">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>`;

    const typeBadgeClass = { text: 'type-text', code: 'type-code', link: 'type-link', password: 'type-password' }[item.type] || 'type-text';
    const typeIcon = typeIcons[item.type] || typeIcons['text'];

    return `
        <div class="flex justify-between items-start mb-2">
            <span class="type-badge ${typeBadgeClass}">
                ${typeIcon}
                <span>${new Date(item.id).toLocaleTimeString()} • ${item.type}</span>
            </span>
            <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                ${copyBtn}${editBtn}
                <button onclick="deleteItem(${item.id})" style="color:var(--muted)" class="hover:text-red-400 transition" title="Elimina">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
        ${contentHtml}
    `;
}

function formatText(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:white;font-weight:700">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em style="color:var(--muted)">$1</em>');
    html = html.replace(/`(.*?)`/g, '<code style="background:var(--card-alt);padding:1px 6px;border-radius:4px;color:var(--accent);font-family:monospace;font-size:0.8em;border:1px solid var(--border)">$1</code>');
    return linkify(html);
}

function togglePasswordVisibility(id) {
    const input    = document.getElementById(`pwd-${id}`);
    const eye      = document.getElementById(`eye-${id}`);
    const eyeSlash = document.getElementById(`eye-slash-${id}`);
    if (input.type === 'password') {
        input.type = 'text'; eye.classList.add('hidden'); eyeSlash.classList.remove('hidden');
    } else {
        input.type = 'password'; eye.classList.remove('hidden'); eyeSlash.classList.add('hidden');
    }
}

function sendItem(type) {
    const input   = document.getElementById('inputArea');
    const content = input.value.trim();
    if (!content) return;
    if (type === 'text' && /^https?:\/\//i.test(content)) type = 'link';
    socket.emit('add-item', { id: Date.now(), type, content });
    input.value = '';
    showToast('Inviato!');
}

function deleteItem(id)  { socket.emit('delete-item', id); }
function clearAll()       { if (confirm('Eliminare tutto il contenuto?')) socket.emit('clear-all'); }

function startEditing(id) {
    const item = streamItems.find(i => i.id == id);
    if (!item) return;
    const el = document.getElementById(`item-${id}`);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col gap-2">
            <textarea id="edit-input-${id}" class="ff-textarea resize-y min-h-[100px]" style="font-family:monospace;font-size:14px">${escapeHtml(item.content)}</textarea>
            <div class="flex justify-end gap-2">
                <button onclick="cancelEditing('${id}')" class="btn btn-ghost text-xs">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> Annulla
                </button>
                <button onclick="saveEditing('${id}')" class="btn btn-primary text-xs">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Salva
                </button>
            </div>
        </div>`;
}

function cancelEditing(id) {
    const item = streamItems.find(i => i.id == id);
    if (item) {
        const el = document.getElementById(`item-${id}`);
        if (el) { el.innerHTML = generateCardHtml(item); if (window.hljs) hljs.highlightAll(); }
    }
}

function saveEditing(id) {
    const input = document.getElementById(`edit-input-${id}`);
    if (!input) return;
    socket.emit('edit-item', { id, content: input.value });
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) { showToast('Appunti vuoti'); return; }
        const input = document.getElementById('inputArea');
        input.value = text;
        input.focus();
    } catch { showToast('Impossibile leggere appunti'); }
}
