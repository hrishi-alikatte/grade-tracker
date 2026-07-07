// --- PWA: service-worker registration + install prompt ---
import { registerSW } from 'virtual:pwa-register';

// --- 1. Service Worker (vite-plugin-pwa, prompt-based updates) ---
// A new deploy makes the fresh SW wait; we show a toast and only reload
// when the user taps "Recharger" — never mid grade-entry. In dev no SW is
// registered, so Vite HMR stays intact.
const updateSW = registerSW({
    onNeedRefresh() {
        showUpdateToast(() => updateSW(true));
    },
    onRegisterError(error) {
        console.error('Service Worker registration failed:', error);
    }
});

function showUpdateToast(onReload) {
    if (document.getElementById('sw-update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'sw-update-toast';
    toast.className = 'sidebar-toast toast-success sw-update-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">Nouvelle version disponible !</span>
        </div>
        <button type="button" class="btn btn-primary sw-update-reload-btn">Recharger</button>
    `;

    let container = document.getElementById('toast-sidebar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-sidebar-container';
        container.className = 'toast-sidebar-container';
        document.body.appendChild(container);
    }
    container.appendChild(toast);
    toast.querySelector('.sw-update-reload-btn').addEventListener('click', () => {
        toast.remove();
        onReload();
    });
}

// --- 2. PWA Installation Prompt ---
let deferredPrompt = null;
const installBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBanner) installBanner.style.display = 'flex';
});

if (installBtn) {
    installBtn.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the PWA install prompt');
                }
                deferredPrompt = null;
                if (installBanner) installBanner.style.display = 'none';
            });
        }
    });
}
