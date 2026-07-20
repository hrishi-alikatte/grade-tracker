// --- 3. Confetti Engine (HTML5 Canvas) & Audio Assets ---
// DOM/Audio lookups are lazy so this module can be imported in Node (tests).
let canvas = null;
let ctx = null;
function ensureCanvas() {
    if (!canvas) {
        canvas = document.getElementById('confetti-canvas');
        ctx = canvas ? canvas.getContext('2d') : null;
    }
    return canvas;
}
let confettiParticles = [];
let confettiAnimationId = null;

let fahAudio = null;
let confettiAudio = null;

function playConfettiSound() {
    try {
        if (!confettiAudio) confettiAudio = new Audio('/sounds/confetti.mp3');
        confettiAudio.currentTime = 0;
        confettiAudio.play().catch(e => console.log("Audio play blocked by browser policy:", e));
    } catch (e) {
        console.error("Error playing confetti sound:", e);
    }
}

function playFahSound() {
    try {
        if (!fahAudio) fahAudio = new Audio('/sounds/fah.mp3');
        fahAudio.currentTime = 0;
        fahAudio.play().catch(e => console.log("Audio play blocked by browser policy:", e));
    } catch (e) {
        console.error("Error playing FAH sound:", e);
    }
}

function showSidebarToast(message, type = 'error') {
    let container = document.getElementById('toast-sidebar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-sidebar-container';
        container.className = 'toast-sidebar-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `sidebar-toast toast-${type}`;
    
    const iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-failing-bg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    
    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <div class="toast-content">
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close-btn" aria-label="Fermer la notification">&times;</button>
    `;
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
        toast.classList.add('toast-slide-out');
        toast.addEventListener('animationend', () => toast.remove());
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-slide-out');
            toast.addEventListener('animationend', () => toast.remove());
        }
    }, 4000);
}

function resizeConfettiCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizeConfettiCanvas);
}

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function startConfetti() {
    // Respect users who opt out of motion — skip the celebration animation.
    if (prefersReducedMotion()) return;
    if (!ensureCanvas() || !ctx) return;
    resizeConfettiCanvas();
    confettiParticles = [];
    const colors = ['#60a5fa', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa'];
    for (let i = 0; i < 90; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            r: Math.random() * 5 + 3,
            d: Math.random() * canvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: Math.random() * 0.06 + 0.02,
            tiltAngle: 0
        });
    }
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
    }
    animateConfetti();
}

function animateConfetti() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeParticles = 0;
    
    confettiParticles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 12;
        
        if (p.y <= canvas.height) {
            activeParticles++;
        }
        
        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
    });
    
    if (activeParticles > 0) {
        confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiAnimationId = null;
    }
}

function initBackgroundBoxes() {
    const grid = document.getElementById('background-boxes-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    // Scale grid density to the viewport: phones get a much lighter grid
    // (~720 cells vs 2400) to cut DOM/paint cost on low-end devices.
    const isSmallViewport = window.innerWidth < 768;
    const cols = isSmallViewport ? 30 : 60;
    const rows = isSmallViewport ? 24 : 40;

    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    const totalCells = cols * rows;
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'box-cell';
        fragment.appendChild(cell);
    }
    
    grid.appendChild(fragment);
}

export { playConfettiSound, playFahSound, showSidebarToast, startConfetti, initBackgroundBoxes };
