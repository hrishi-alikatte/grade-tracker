// --- 1. PWA Service Worker Registration ---
// Enregistré uniquement en production : en dev, un SW cache-first servirait
// du code périmé et casserait le rechargement à chaud de Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered with scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
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
