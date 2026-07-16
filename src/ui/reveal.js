// Révélation au défilement pour la page d'accueil : les sections apparaissent
// (fondu + légère montée) quand elles entrent dans la fenêtre. Uniquement
// opacity/transform (accéléré GPU), transition courte (200 ms), et totalement
// désactivé si l'utilisateur préfère des animations réduites ou si le
// navigateur ne supporte pas IntersectionObserver — dans ce cas le contenu
// reste visible immédiatement (jamais masqué sans JS pour le révéler).

let inited = false;

export function initScrollReveal() {
    if (inited) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const targets = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!targets.length) return;
    inited = true;

    const prefersReduced = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pas d'animation possible/souhaitée : on affiche tout tout de suite.
    if (prefersReduced || !('IntersectionObserver' in window)) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    targets.forEach((el, i) => {
        el.classList.add('reveal-init');
        // Léger décalage en cascade, plafonné pour rester réactif.
        el.style.transitionDelay = Math.min(i * 45, 180) + 'ms';
    });

    const remaining = new Set(targets);
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) reveal(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    function reveal(el) {
        el.classList.add('is-visible');
        remaining.delete(el);
        observer.unobserve(el);
    }

    targets.forEach((el) => observer.observe(el));

    // Filet de sécurité : sur défilement, révèle tout élément déjà au niveau ou
    // au-dessus de la fenêtre. Garantit qu'un saut instantané (ancre, retour en
    // haut) ne laisse jamais de contenu masqué. Se retire une fois terminé.
    let ticking = false;
    function sweep() {
        ticking = false;
        if (!remaining.size) {
            window.removeEventListener('scroll', onScroll);
            return;
        }
        const h = window.innerHeight;
        Array.from(remaining).forEach((el) => {
            if (el.getBoundingClientRect().top < h * 0.95) reveal(el);
        });
    }
    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(sweep);
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
}
