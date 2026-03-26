// Inizializzazione globale — namespace /localsync (con auth token)
const socket = io('/localsync', {
    auth: { token: localStorage.getItem('ls_auth_token') || '' }
});

// Gestione shortcut globale (Ctrl+Enter per inviare testo)
document.addEventListener('DOMContentLoaded', () => {
    const inputArea = document.getElementById('inputArea');
    if (inputArea) {
        inputArea.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendItem('text');
        });

        // Toolbar "Incolla" sopra l'area testo
        const toolbar = document.createElement('div');
        toolbar.className = "flex justify-end mb-1 pr-1";
        toolbar.innerHTML = `
            <button onclick="pasteFromClipboard()" class="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 transition group" style="color:var(--muted)" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                INCOLLA
            </button>
        `;
        inputArea.parentElement.insertBefore(toolbar, inputArea);
    }
});
