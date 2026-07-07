// --- 3. Confetti Engine (HTML5 Canvas) & Audio Assets ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimationId = null;

const fahAudio = new Audio('/sounds/fah.mp3');
const confettiAudio = new Audio('/sounds/confetti.mp3');

function playConfettiSound() {
    try {
        confettiAudio.currentTime = 0;
        confettiAudio.play().catch(e => console.log("Audio play blocked by browser policy:", e));
    } catch (e) {
        console.error("Error playing confetti sound:", e);
    }
}

function playFahSound() {
    try {
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
        <button class="toast-close-btn">&times;</button>
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
window.addEventListener('resize', resizeConfettiCanvas);

function startConfetti() {
    if (!canvas || !ctx) return;
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
    
    const cols = 60;
    const rows = 40;
    
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
