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

// Already installed? (Android/desktop report display-mode; iOS uses navigator.standalone.)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
// iOS/iPadOS never fires beforeinstallprompt (iPadOS 13+ masquerades as Mac).
const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

function showInstallBanner() { if (installBanner) installBanner.style.display = 'flex'; }
function hideInstallBanner() { if (installBanner) installBanner.style.display = 'none'; }

if (!isStandalone) {
    if (isIOS) {
        // No install API on iOS — surface the manual "Add to Home Screen" path.
        showInstallBanner();
        if (installBtn) {
            installBtn.textContent = 'Comment ?';
            installBtn.addEventListener('click', showIOSInstallHint);
        }
    } else {
        // Android / desktop Chromium: use the real install prompt.
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallBanner();
        });
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => {
                    deferredPrompt = null;
                    hideInstallBanner();
                });
            });
        }
    }
}

// Hide the banner once installed (covers browser-menu installs too).
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBanner();
});

// Persistent toast with the iOS Share-sheet steps (iOS has no install prompt).
function showIOSInstallHint() {
    if (document.getElementById('ios-install-hint')) return;
    const toast = document.createElement('div');
    toast.id = 'ios-install-hint';
    toast.className = 'sidebar-toast toast-info';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">
                Pour installer : appuyez sur
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                (Partager) puis « Sur l'écran d'accueil ».
            </span>
        </div>
        <button type="button" class="toast-close-btn" aria-label="Fermer">&times;</button>
    `;
    let container = document.getElementById('toast-sidebar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-sidebar-container';
        container.className = 'toast-sidebar-container';
        document.body.appendChild(container);
    }
    container.appendChild(toast);
    toast.querySelector('.toast-close-btn').addEventListener('click', () => toast.remove());
}
