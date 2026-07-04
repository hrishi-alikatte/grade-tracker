/**
 * GradeVibe Vaud - PWA App Logic & Customizations v3
 */

// --- IndexedDB Storage for Test Photos ---
const DB_NAME = 'GradeTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'grade_photos';
let db = null;

function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };
        request.onerror = (e) => {
            console.error('IndexedDB initialization error:', e.target.error);
            resolve(null);
        };
    });
}

// Call initDB on startup
initDB();

function storePhoto(gradeId, base64Data) {
    return new Promise((resolve) => {
        if (!db) {
            console.warn('IndexedDB not ready, cannot store photo');
            resolve(false);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(base64Data, gradeId);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => {
                console.error('storePhoto error:', e.target.error);
                resolve(false);
            };
        } catch (err) {
            console.error('storePhoto transaction error:', err);
            resolve(false);
        }
    });
}

function getPhoto(gradeId) {
    return new Promise((resolve) => {
        if (!db) {
            resolve(null);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(gradeId);
            request.onsuccess = (e) => resolve(e.target.result || null);
            request.onerror = (e) => {
                console.error('getPhoto error:', e.target.error);
                resolve(null);
            };
        } catch (err) {
            console.error('getPhoto transaction error:', err);
            resolve(null);
        }
    });
}

function deletePhoto(gradeId) {
    return new Promise((resolve) => {
        if (!db) {
            resolve(false);
            return;
        }
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(gradeId);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => {
                console.error('deletePhoto error:', e.target.error);
                resolve(false);
            };
        } catch (err) {
            console.error('deletePhoto transaction error:', err);
            resolve(false);
        }
    });
}

// --- OCR and Photo Temporary State ---
let currentUploadedPhotoBase64 = null;
let currentOcrText = "";
let isOcrRunning = false;

let editUploadedPhotoBase64 = null;
let editOcrText = "";
let isEditOcrRunning = false;
let editPhotoDeleted = false;

// Normalize text and check if grade exists in it
function verifyGradeInText(ocrText, gradeValue) {
    if (!ocrText) return false;
    const normalized = ocrText.toLowerCase().replace(/[,;]/g, '.').replace(/\s+/g, ' ');
    const valStr = gradeValue.toFixed(1);
    const valInt = Math.floor(gradeValue).toString();
    
    if (normalized.includes(valStr)) return true;
    if (gradeValue % 1 === 0) {
        const regex = new RegExp(`\\b${valInt}\\b`);
        if (regex.test(normalized)) return true;
    }
    return false;
}

// --- 1. PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
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

// --- 3. Confetti Engine (HTML5 Canvas) & Audio Assets ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimationId = null;

const fahAudio = new Audio(encodeURI('FAH SOUND .mpeg'));
const confettiAudio = new Audio(encodeURI('CONFETTI SOUND.mp3'));

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

// --- 4. Swiss Vaud Gymnase Calculations ---

function roundToHalfPoint(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 0;
    }
    return Math.round(value * 2) / 2;
}

/**
 * Calculates subject averages supporting both semesters and annual combinations
 */
function calculateLockedYear2PhysChem() {
    if (!state.subjectsYear2) return null;
    const phys = state.subjectsYear2.find(s => s.name.toLowerCase().includes('physique'));
    const chim = state.subjectsYear2.find(s => s.name.toLowerCase().includes('chimie'));
    
    const physData = phys ? calculateSubjectData(phys, 'annual') : null;
    const chimData = chim ? calculateSubjectData(chim, 'annual') : null;
    
    const avgPhys = physData && physData.rawAverage !== null ? physData.roundedAverage : null;
    const avgChim = chimData && chimData.rawAverage !== null ? chimData.roundedAverage : null;
    
    if (avgPhys !== null && avgChim !== null) {
        return roundToHalfPoint((avgPhys + avgChim) / 2);
    } else if (avgPhys !== null) {
        return avgPhys;
    } else if (avgChim !== null) {
        return avgChim;
    }
    return null;
}

function formatYear2SubjectAvg(nameSub) {
    if (!state.subjectsYear2) return '—';
    const sub = state.subjectsYear2.find(s => s.name.toLowerCase().includes(nameSub));
    if (!sub) return '—';
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? `${data.roundedAverage.toFixed(1)} (moy: ${data.rawAverage.toFixed(2)})` : '—';
}

function getYear2SubjectAverage(nameSub) {
    if (!state.subjectsYear2) return null;
    const sub = state.subjectsYear2.find(s => s.name.toLowerCase().includes(nameSub));
    if (!sub) return null;
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? data.roundedAverage : null;
}

function getYear2ArtAverage() {
    if (!state.subjectsYear2) return null;
    const sub = state.subjectsYear2.find(s => s.role === 'art');
    if (!sub) return null;
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? data.roundedAverage : null;
}

function formatYear2ArtAvg() {
    if (!state.subjectsYear2) return '—';
    const sub = state.subjectsYear2.find(s => s.role === 'art');
    if (!sub) return '—';
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? `${data.roundedAverage.toFixed(1)} (moy: ${data.rawAverage.toFixed(2)})` : '—';
}

/**
 * Calculates subject averages supporting both semesters and annual combinations
 */
function calculateSubjectData(subject, semester) {
    if (subject.role === 'physique_y2') {
        const val = getYear2SubjectAverage('physique');
        return {
            rawAverage: val,
            roundedAverage: val,
            taAverage: null,
            tsAverage: null
        };
    }
    if (subject.role === 'chimie_y2') {
        const val = getYear2SubjectAverage('chimie');
        return {
            rawAverage: val,
            roundedAverage: val,
            taAverage: null,
            tsAverage: null
        };
    }
    if (subject.role === 'art_y2') {
        const val = getYear2ArtAverage();
        return {
            rawAverage: val,
            roundedAverage: val,
            taAverage: null,
            tsAverage: null
        };
    }
    if (subject.role === 'phys_chimie_y2') {
        const val = calculateLockedYear2PhysChem();
        if (val === null) {
            return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
        }
        return {
            rawAverage: val,
            roundedAverage: val,
            taAverage: null,
            tsAverage: null
        };
    }

    const sem = semester || state.currentSemester;

    if (sem === 'annual') {
        const data1 = calculateSubjectDataForSem(subject, 'sem1');
        const data2 = calculateSubjectDataForSem(subject, 'sem2');

        const avg1 = data1.roundedAverage;
        const avg2 = data2.roundedAverage;

        if (avg1 === null && avg2 === null) {
            return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
        }

        // Annual average is the average of both semesters' rounded averages
        let rawAverage = 0;
        if (avg1 !== null && avg2 !== null) {
            rawAverage = (avg1 + avg2) / 2;
        } else {
            rawAverage = avg1 !== null ? avg1 : avg2;
        }
        const roundedAverage = roundToHalfPoint(rawAverage);

        return {
            rawAverage,
            roundedAverage,
            taAverage: null,
            tsAverage: null,
            sem1Data: data1,
            sem2Data: data2
        };
    } else {
        return calculateSubjectDataForSem(subject, sem);
    }
}

function calculateSubjectDataForSem(subject, sem) {
    const grades = (subject.grades && subject.grades[sem]) ? subject.grades[sem] : [];

    if (grades.length === 0) {
        return { rawAverage: null, roundedAverage: null, taAverage: null, tsAverage: null };
    }

    const mode = subject.evaluationMode || 'dual';

    if (mode === 'standard') {
        const sum = grades.reduce((s, g) => s + g.value, 0);
        const rawAverage = sum / grades.length;
        const roundedAverage = roundToHalfPoint(rawAverage);
        return {
            rawAverage,
            roundedAverage,
            taAverage: null,
            tsAverage: null
        };
    }

    const tas = grades.filter(g => g.type === 'TA');
    const tss = grades.filter(g => g.type === 'TS');

    let taAverage = null;
    let taAvgRounded = null;
    if (tas.length > 0) {
        const taSum = tas.reduce((sum, g) => sum + g.value, 0);
        taAverage = taSum / tas.length;
        taAvgRounded = roundToHalfPoint(taAverage);
    }

    let tsAverage = null;
    if (tss.length > 0) {
        const tsSum = tss.reduce((sum, g) => sum + g.value, 0);
        tsAverage = tsSum / tss.length;
    }

    // Combine TS grades with virtual TA average
    const combinedTS = tss.map(g => g.value);
    if (taAvgRounded !== null) {
        combinedTS.push(taAvgRounded);
    }

    if (combinedTS.length === 0) {
        return { rawAverage: null, roundedAverage: null, taAverage, tsAverage };
    }

    const rawAverage = combinedTS.reduce((sum, val) => sum + val, 0) / combinedTS.length;
    const roundedAverage = roundToHalfPoint(rawAverage);

    return {
        rawAverage,
        roundedAverage,
        taAverage,
        tsAverage
    };
}

function calculateRequiredGrade(subject, sem, numTests, typeRemaining) {
    const grades = (subject.grades && subject.grades[sem]) ? subject.grades[sem] : [];
    const target = subject.target;
    const mode = subject.evaluationMode || 'dual';
    
    if (mode === 'locked') return null;
    
    const reqRaw = target - 0.25;
    
    if (mode === 'standard') {
        const S_curr = grades.reduce((s, g) => s + g.value, 0);
        const C_curr = grades.length;
        const reqGrade = (reqRaw * (C_curr + numTests) - S_curr) / numTests;
        return reqGrade;
    }
    
    // Dual mode
    const tas = grades.filter(g => g.type === 'TA');
    const tss = grades.filter(g => g.type === 'TS');
    
    if (typeRemaining === 'TS') {
        let taAvgRounded = null;
        if (tas.length > 0) {
            const taSum = tas.reduce((s, g) => s + g.value, 0);
            taAvgRounded = roundToHalfPoint(taSum / tas.length);
        }
        
        const combined = tss.map(g => g.value);
        if (taAvgRounded !== null) combined.push(taAvgRounded);
        
        const S_curr = combined.reduce((s, val) => s + val, 0);
        const C_curr = combined.length;
        
        const reqGrade = (reqRaw * (C_curr + numTests) - S_curr) / numTests;
        return reqGrade;
    } else {
        // Remaining is TA
        const N_ts = tss.length;
        const S_ts = tss.reduce((s, g) => s + g.value, 0);
        const K_ta = tas.length;
        const S_ta = tas.reduce((s, g) => s + g.value, 0);
        
        if (N_ts === 0 && K_ta === 0) {
            return target - 0.25;
        }
        
        const reqTaAvgRounded = reqRaw * (N_ts + 1) - S_ts;
        if (reqTaAvgRounded > 6.0) {
            return 999.0; // Impossible
        }
        
        const reqTaAvgMin = Math.ceil(reqTaAvgRounded * 2) / 2;
        const reqGrade = ((reqTaAvgMin - 0.25) * (K_ta + numTests) - S_ta) / numTests;
        return reqGrade;
    }
}

function updateCardSimulatorBadge(card, subject, sem) {
    const badge = card.querySelector('.sim-result-badge');
    if (!badge) return;
    
    const numTestsSelect = card.querySelector('.sim-num-tests');
    const typeSelect = card.querySelector('.sim-type');
    
    const numTests = parseInt(numTestsSelect.value);
    const typeRemaining = typeSelect ? typeSelect.value : 'TS';
    
    const reqGrade = calculateRequiredGrade(subject, sem, numTests, typeRemaining);
    
    badge.className = 'sim-result-badge'; // reset class
    
    if (reqGrade === null) {
        badge.style.display = 'none';
        return;
    }
    
    if (reqGrade > 6.0) {
        badge.textContent = 'Impossible';
        badge.classList.add('impossible');
        badge.title = 'Impossible d\'atteindre l\'objectif avec ce nombre d\'évaluations.';
    } else if (reqGrade <= 1.0) {
        badge.textContent = '≥ 1.0 (garanti)';
        badge.classList.add('passing');
        badge.title = 'Objectif déjà atteint ou garanti avec la note minimale.';
    } else {
        badge.textContent = `≈ ${reqGrade.toFixed(1)}`;
        if (reqGrade <= 4.0) {
            badge.classList.add('passing');
        } else if (reqGrade <= 5.0) {
            badge.classList.add('warning');
        } else {
            badge.classList.add('failing');
        }
        badge.title = `Note moyenne requise sur les évaluations restantes : ${reqGrade.toFixed(2)}`;
    }
}

/**
 * Computes Vaud Swiss Gymnase promotion status based on rounded subject averages
 */
function checkVaudPromotion(subjects, semester) {
    const sem = semester || state.currentSemester;
    let activeSubjectsCount = 0;
    let roundedAveragesSum = 0;
    let insuffisances = 0;
    let pointsManquants = 0; // Deficits
    let pointsEnPlus = 0;    // Surplus

    subjects.forEach(s => {
        const data = calculateSubjectData(s, sem);
        if (data.rawAverage !== null) {
            activeSubjectsCount++;
            const avgRounded = data.roundedAverage;
            roundedAveragesSum += avgRounded;

            if (avgRounded < 4.0) {
                insuffisances++;
                pointsManquants += (4.0 - avgRounded);
            } else if (avgRounded > 4.0) {
                pointsEnPlus += (avgRounded - 4.0);
            }
        }
    });

    // Compute G1 points sum
    const french = subjects.find(s => s.role === 'french');
    const math = subjects.find(s => s.role === 'math');
    const os = subjects.find(s => s.role === 'os');
    const l2 = subjects.find(s => s.role === 'l2');
    const l3 = subjects.find(s => s.role === 'l3');

    const mathData = math ? calculateSubjectData(math, sem) : null;
    const mathRound = mathData && mathData.rawAverage !== null ? mathData.roundedAverage : null;
    
    const frData = french ? calculateSubjectData(french, sem) : null;
    const frRound = frData && frData.rawAverage !== null ? frData.roundedAverage : null;

    const osObj = os ? calculateSubjectData(os, sem) : null;
    const osRound = osObj && osObj.rawAverage !== null ? osObj.roundedAverage : null;

    const l2Data = l2 ? calculateSubjectData(l2, sem) : null;
    const l3Data = l3 ? calculateSubjectData(l3, sem) : null;
    let l2l3AvgRounded = null;
    if (l2Data && l2Data.rawAverage !== null && l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = roundToHalfPoint((l2Data.roundedAverage + l3Data.roundedAverage) / 2);
    } else if (l2Data && l2Data.rawAverage !== null) {
        l2l3AvgRounded = l2Data.roundedAverage;
    } else if (l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = l3Data.roundedAverage;
    }

    let g1Sum = 0;
    g1Sum += mathRound !== null ? mathRound : 0;
    g1Sum += frRound !== null ? frRound : 0;
    g1Sum += osRound !== null ? osRound : 0;
    g1Sum += l2l3AvgRounded !== null ? l2l3AvgRounded : 0;

    const hasCoreGrades = (mathRound !== null || frRound !== null || osRound !== null || l2l3AvgRounded !== null);
    const coreSumPassed = !hasCoreGrades || g1Sum >= 16.0;

    const overallAverage = activeSubjectsCount > 0 ? (roundedAveragesSum / activeSubjectsCount) : null;
    const requiredCompensation = (state.currentYear === 3) ? (2 * pointsManquants) : 0;
    let isPromoted = false;
    if (state.currentYear === 1 || state.currentYear === 2) {
        isPromoted = activeSubjectsCount > 0 &&
                     coreSumPassed &&
                     overallAverage >= 4.0 &&
                     insuffisances <= 4;
    } else {
        isPromoted = activeSubjectsCount > 0 && 
                     overallAverage >= 4.0 && 
                     insuffisances <= 4 && 
                     pointsEnPlus >= requiredCompensation &&
                     pointsManquants <= 3.0 &&
                     coreSumPassed;
    }

    return {
        overallAverage: overallAverage !== null ? Math.round(overallAverage * 100) / 100 : null,
        activeSubjectsCount,
        insuffisances,
        pointsManquants: Math.round(pointsManquants * 100) / 100,
        pointsEnPlus: Math.round(pointsEnPlus * 100) / 100,
        requiredCompensation,
        isPromoted,
        g1Sum,
        coreSumPassed,
        g2Sum: roundedAveragesSum,
        g2Min: activeSubjectsCount * 4.0
    };
}

// Helper to map grade/average to color CSS class (yellow for exactly 4.0)
function getStatusClass(val) {
    if (val === null || val === undefined) return 'empty';
    if (val < 4.0) return 'failing';
    if (val === 4.0) return 'warning';
    return 'passing';
}

// --- 5. Default Vaud Subjects lists ---
const defaultSubjectsYear1 = [
    { id: 'y1_maths', name: 'Maths', role: 'math', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_francais', name: 'Français', role: 'french', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_eco_os', name: 'Option Spécifique (OS)', role: 'os', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_anglais', name: 'Anglais', role: 'l3', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_l2_langue', name: 'Allemand', role: 'l2', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_eco_df', name: 'Économie DF', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_chimie_df', name: 'Chimie DF', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_physique_df', name: 'Physique DF', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_arts_visuels', name: 'Arts Visuels', role: 'art', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_informatique', name: 'Informatique', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y1_histoire', name: 'Histoire', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } }
];

const defaultSubjectsYear2 = [
    { id: 'y2_maths', name: 'Maths', role: 'math', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_francais', name: 'Français', role: 'french', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_eco_os', name: 'Option Spécifique (OS)', role: 'os', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_anglais', name: 'Anglais', role: 'l3', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_l2_langue', name: 'Allemand', role: 'l2', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_chimie_df', name: 'Chimie DF', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_physique_df', name: 'Physique DF', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_arts_visuels', name: 'Arts Visuels', role: 'art', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_informatique', name: 'Informatique', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_biologie', name: 'Biologie', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_geographie', name: 'Géographie', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y2_histoire', name: 'Histoire', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } }
];

const defaultSubjectsYear3 = [
    { id: 'y3_maths', name: 'Maths', role: 'math', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_francais', name: 'Français', role: 'french', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_eco_os', name: 'Option Spécifique (OS)', role: 'os', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_anglais', name: 'Anglais', role: 'l3', target: 4.5, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_l2_langue', name: 'Allemand', role: 'l2', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_oc', name: 'Option Complémentaire (OC)', role: 'oc', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_biologie', name: 'Biologie', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_geographie', name: 'Géographie', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_histoire', name: 'Histoire', role: 'general', target: 4.0, evaluationMode: 'dual', grades: { sem1: [], sem2: [] } },
    { id: 'y3_tm', name: 'Travail de Maturité (TM)', role: 'tm', target: 4.5, evaluationMode: 'standard', grades: { sem1: [], sem2: [] } },
    { id: 'y3_physique_y2', name: 'Physique (Y2)', role: 'physique_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } },
    { id: 'y3_chimie_y2', name: 'Chimie (Y2)', role: 'chimie_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } },
    { id: 'y3_art_y2', name: 'Arts Visuels / Musique (Y2)', role: 'art_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } }
];

// --- 6. State Management ---
let state = {
    studentName: 'Étudiant',
    currentYear: 1,
    currentSemester: 'sem1',
    subjectsYear1: [],
    subjectsYear2: [],
    subjectsYear3: [],
    theme: 'navy'
};

let activeSubjectFilters = null;
let animateCards = false;

function migrateSubjectGrades(subject) {
    if (Array.isArray(subject.grades)) {
        const oldGrades = subject.grades;
        subject.grades = {
            sem1: oldGrades,
            sem2: []
        };
    } else if (!subject.grades) {
        subject.grades = {
            sem1: [],
            sem2: []
        };
    } else {
        if (!subject.grades.sem1) subject.grades.sem1 = [];
        if (!subject.grades.sem2) subject.grades.sem2 = [];
    }
}

function runStateMigrations() {
    if (!state.subjectsYear1 || state.subjectsYear1.length === 0) {
        state.subjectsYear1 = JSON.parse(JSON.stringify(defaultSubjectsYear1));
    }
    if (!state.subjectsYear2 || state.subjectsYear2.length === 0) {
        state.subjectsYear2 = JSON.parse(JSON.stringify(defaultSubjectsYear2));
    }
    if (!state.subjectsYear3 || state.subjectsYear3.length === 0) {
        state.subjectsYear3 = JSON.parse(JSON.stringify(defaultSubjectsYear3));
    } else {
        const hasCombined = state.subjectsYear3.some(s => s.id === 'y3_phys_chimie_y2');
        if (hasCombined) {
            state.subjectsYear3 = state.subjectsYear3.filter(s => s.id !== 'y3_phys_chimie_y2');
            if (!state.subjectsYear3.some(s => s.id === 'y3_physique_y2')) {
                state.subjectsYear3.push({ id: 'y3_physique_y2', name: 'Physique (Y2)', role: 'physique_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } });
            }
            if (!state.subjectsYear3.some(s => s.id === 'y3_chimie_y2')) {
                state.subjectsYear3.push({ id: 'y3_chimie_y2', name: 'Chimie (Y2)', role: 'chimie_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } });
            }
        }
        if (!state.subjectsYear3.some(s => s.id === 'y3_art_y2')) {
            state.subjectsYear3.push({ id: 'y3_art_y2', name: 'Arts Visuels / Musique (Y2)', role: 'art_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } });
        }
    }

    // Sync the Year 3 Art name from Year 2 choice
    const y3Art = state.subjectsYear3.find(s => s.role === 'art_y2');
    const y2Art = state.subjectsYear2.find(s => s.role === 'art');
    if (y2Art && y3Art) {
        y3Art.name = `${y2Art.name} (Y2)`;
    }
}

function applyTheme() {
    const theme = state.theme || 'navy';
    document.body.setAttribute('data-theme', theme);
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) themeSelector.value = theme;
}

function loadState() {
    const saved = localStorage.getItem('gymnase_vaud_state_v5');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.studentName) state.studentName = 'Étudiant';
            if (!state.currentYear) state.currentYear = 1;
            if (!state.currentSemester) state.currentSemester = 'sem1';
            if (!state.theme) state.theme = 'navy';
            if (state.hasSeenOnboarding === undefined) state.hasSeenOnboarding = false;
            if (!state.promoViewMode) state.promoViewMode = 'visual';
            
            runStateMigrations();
            
            state.subjectsYear1.forEach(migrateSubjectGrades);
            state.subjectsYear2.forEach(migrateSubjectGrades);
            state.subjectsYear3.forEach(migrateSubjectGrades);
            
            applyTheme();
        } catch(e) {
            console.error("Failed to parse state v5", e);
            resetStateToDefault();
        }
    } else {
        resetStateToDefault();
    }
}

function resetStateToDefault() {
    state = {
        studentName: 'Étudiant',
        currentYear: 1,
        currentSemester: 'sem1',
        subjectsYear1: JSON.parse(JSON.stringify(defaultSubjectsYear1)),
        subjectsYear2: JSON.parse(JSON.stringify(defaultSubjectsYear2)),
        subjectsYear3: JSON.parse(JSON.stringify(defaultSubjectsYear3)),
        theme: 'navy',
        hasSeenOnboarding: false,
        promoViewMode: 'visual'
    };
    saveState();
    applyTheme();
}

function saveState() {
    localStorage.setItem('gymnase_vaud_state_v5', JSON.stringify(state));
}

// --- 7. DOM Elements ---
let activeDetailsSubjectId = null;
const gemClasses = [
    'ruby-zoisite',
    'red-jasper',
    'ocean-jasper',
    'rainbow-moonstone',
    'selenite',
    'sodalite',
    'serpentine',
    'rose-quartz',
    'labradorite',
    'picture-jasper',
    'amazonite'
];

function getGemClassForSubject(subject, index) {
    const isStandardSubject = subject.id.startsWith('y1_') || subject.id.startsWith('y2_') || subject.id.startsWith('y3_');
    if (!isStandardSubject) return 'custom';
    
    const roleMapping = {
        'math': 'ruby-zoisite',
        'french': 'red-jasper',
        'os': 'ocean-jasper',
        'l3': 'rainbow-moonstone',
        'l2': 'selenite',
        'art': 'labradorite'
    };
    
    if (roleMapping[subject.role]) return roleMapping[subject.role];
    
    const nameLower = subject.name.toLowerCase();
    if (nameLower.includes('économie') || nameLower.includes('eco')) return 'sodalite';
    if (nameLower.includes('chimie')) return 'serpentine';
    if (nameLower.includes('physique')) return 'rose-quartz';
    if (nameLower.includes('informatique') || nameLower.includes('info')) return 'picture-jasper';
    if (nameLower.includes('histoire')) return 'amazonite';
    
    return gemClasses[index % gemClasses.length];
}

const subjectsContainer = document.getElementById('subjects-container');
const promoTitle = document.getElementById('promo-title');
const promoSubtitle = document.getElementById('promo-subtitle');
const promoStatusBadge = document.getElementById('promo-status-badge');
const promoDashboard = document.getElementById('promo-dashboard');

const statInsuffisances = document.getElementById('stat-insuffisances');
const statDeficit = document.getElementById('stat-deficit');
const statSurplus = document.getElementById('stat-surplus');
const statCompensation = document.getElementById('stat-compensation');
const cardCompensation = document.getElementById('card-compensation');
const promoStatsGrid = document.getElementById('promo-stats-grid');

// Group Bilan Elements
const g1PointsText = document.getElementById('g1-points-text');
const g2PointsText = document.getElementById('g2-points-text');
const g1List = document.getElementById('g1-list');
const g2List = document.getElementById('g2-list');

const studentNameEl = document.getElementById('student-name');

// --- 8. Event Binding: Student Name Inline Edit ---
studentNameEl.addEventListener('blur', () => {
    let nameText = studentNameEl.textContent.trim();
    if (!nameText) nameText = 'Étudiant';
    state.studentName = nameText;
    studentNameEl.textContent = nameText;
    saveState();
});

studentNameEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        studentNameEl.blur();
    }
});

// --- 9. UI Rendering ---

function updateDashboard() {
    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const results = checkVaudPromotion(currentSubjects, state.currentSemester);

    // Update name UI if different
    if (studentNameEl.textContent !== state.studentName) {
        studentNameEl.textContent = state.studentName;
    }

    if (results.activeSubjectsCount === 0) {
        if (promoDashboard) promoDashboard.className = 'promo-dashboard-container status-neutral';
        promoTitle.textContent = "Aucune note saisie";
        promoSubtitle.textContent = "Saisissez des notes pour voir votre statut de promotion.";
        
        renderEvolutionGraph();
        updateGroupsBilan();
        return;
    }

    // Status styling
    if (results.isPromoted) {
        if (promoDashboard) promoDashboard.className = 'promo-dashboard-container status-promoted';
        promoTitle.textContent = "Promotion garantie";
        const periodLabel = state.currentSemester === 'sem1' ? 'du 1er semestre' : state.currentSemester === 'sem2' ? 'du 2ème semestre' : 'annuelle (combinée)';
        promoSubtitle.textContent = `Félicitations, vous remplissez toutes les conditions de promotion avec une moyenne de ${results.overallAverage.toFixed(2)} (${periodLabel}) !`;
    } else {
        if (promoDashboard) promoDashboard.className = 'promo-dashboard-container status-failing';
        promoTitle.textContent = "Promotion insuffisante";
        
        const reasons = [];
        if (results.g2Sum < results.g2Min) {
            const diff = (results.g2Min - results.g2Sum).toFixed(1);
            reasons.push(`Il vous manque ${diff} point(s) pour atteindre les ${results.g2Min.toFixed(1)} points requis dans le Groupe 2 (toutes les disciplines)`);
        }
        if (!results.coreSumPassed) {
            const diff = (16.0 - results.g1Sum).toFixed(1);
            reasons.push(`Il vous manque ${diff} point(s) pour atteindre les 16.0 points requis dans le Groupe 1 (disciplines fondamentales)`);
        }
        if (results.insuffisances > 4) {
            reasons.push(`Vous avez ${results.insuffisances} branches insuffisantes (maximum 4 autorisées)`);
        }
        if (results.pointsManquants > 3.0) {
            const diff = (results.pointsManquants - 3.0).toFixed(1);
            reasons.push(`Votre déficit total de branches insuffisantes (${results.pointsManquants.toFixed(1)}) dépasse de ${diff} point(s) la limite autorisée (3.0)`);
        }
        if (results.pointsEnPlus < results.requiredCompensation) {
            const diff = (results.requiredCompensation - results.pointsEnPlus).toFixed(1);
            reasons.push(`Il vous manque ${diff} point(s) de compensation (le surplus au-dessus de 4.0 doit combler le double du déficit)`);
        }
        
        promoSubtitle.innerHTML = reasons.join('<br>');
    }

    // Update Bilan lists
    updateGroupsBilan();
    renderEvolutionGraph();
}

function updateGroupsBilan() {
    g1List.innerHTML = '';
    g2List.innerHTML = '';

    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const sem = state.currentSemester;
    const results = checkVaudPromotion(currentSubjects, sem);

    // --- 1. Compute Group 1 (Branches fondamentales) ---
    const french = currentSubjects.find(s => s.role === 'french');
    const math = currentSubjects.find(s => s.role === 'math');
    const os = currentSubjects.find(s => s.role === 'os');
    const l2 = currentSubjects.find(s => s.role === 'l2');
    const l3 = currentSubjects.find(s => s.role === 'l3');

    // Maths
    const mathData = math ? calculateSubjectData(math, sem) : null;
    const mathRound = mathData && mathData.rawAverage !== null ? mathData.roundedAverage : null;
    
    // Français
    const frData = french ? calculateSubjectData(french, sem) : null;
    const frRound = frData && frData.rawAverage !== null ? frData.roundedAverage : null;

    // OS
    const osObj = os ? calculateSubjectData(os, sem) : null;
    const osRound = osObj && osObj.rawAverage !== null ? osObj.roundedAverage : null;

    // L2 & L3 combined
    const l2Data = l2 ? calculateSubjectData(l2, sem) : null;
    const l3Data = l3 ? calculateSubjectData(l3, sem) : null;
    let l2l3AvgRounded = null;
    if (l2Data && l2Data.rawAverage !== null && l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = roundToHalfPoint((l2Data.roundedAverage + l3Data.roundedAverage) / 2);
    } else if (l2Data && l2Data.rawAverage !== null) {
        l2l3AvgRounded = l2Data.roundedAverage;
    } else if (l3Data && l3Data.rawAverage !== null) {
        l2l3AvgRounded = l3Data.roundedAverage;
    }

    g1PointsText.textContent = `Min 16 / tes points: ${results.g1Sum.toFixed(1)} · Max 24`;
    if (results.g1Sum < 16.0) {
        g1PointsText.style.color = 'var(--color-avg-failing-text)';
    } else {
        g1PointsText.style.color = 'var(--color-avg-passing-text)';
    }

    const createBilanItem = (name, val) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '0.2rem 0';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        
        const valText = val !== null ? val.toFixed(1) : '—';
        let color = 'inherit';
        if (val !== null) {
            if (val > 4.0) color = '#10b981';
            else if (val === 4.0) color = '#f59e0b';
            else color = '#ef4444';
        }
        
        li.innerHTML = `
            <span>- ${escapeHTML(name)}</span>
            <strong style="color: ${color};">${valText}</strong>
        `;
        return li;
    };

    g1List.appendChild(createBilanItem('Français', frRound));
    g1List.appendChild(createBilanItem('Mathématiques', mathRound));
    g1List.appendChild(createBilanItem(os ? os.name : 'Option Spécifique (OS)', osRound));
    
    const l2Name = l2 ? l2.name : 'Langue 2 (L2)';
    const l3Name = l3 ? l3.name : 'Langue 3 (L3)';
    g1List.appendChild(createBilanItem(l2Name, l2Data && l2Data.rawAverage !== null ? l2Data.roundedAverage : null));
    g1List.appendChild(createBilanItem(l3Name, l3Data && l3Data.rawAverage !== null ? l3Data.roundedAverage : null));
    
    if (l2l3AvgRounded !== null) {
        g1List.appendChild(createBilanItem('↳ Moyenne (L2 + L3)', l2l3AvgRounded));
    }

    // --- 2. Compute Group 2 (Toutes les branches) ---
    let g2Sum = 0;
    let g2Count = 0;

    currentSubjects.forEach(subject => {
        g2Count++;
        const data = calculateSubjectData(subject, sem);
        const rounded = data.rawAverage !== null ? data.roundedAverage : null;
        
        g2Sum += rounded !== null ? rounded : 0;
        g2List.appendChild(createBilanItem(subject.name, rounded));
    });

    const g2Min = g2Count * 4;
    const g2Max = g2Count * 6;
    g2PointsText.textContent = `Min ${g2Min} / tes points: ${g2Sum.toFixed(1)} · Max ${g2Max}`;
    if (g2Sum < g2Min) {
        g2PointsText.style.color = 'var(--color-avg-failing-text)';
    } else {
        g2PointsText.style.color = 'var(--color-avg-passing-text)';
    }
}



function findMatchingSubject(subjectList, refSubject) {
    if (!subjectList) return null;
    // 1. Try matching by role if it's not a generic role
    if (refSubject.role && !['general', 'standard', 'locked', 'art_y2', 'physique_y2', 'chimie_y2', 'phys_chimie_y2'].includes(refSubject.role)) {
        const found = subjectList.find(s => s.role === refSubject.role);
        if (found) return found;
    }
    // 2. If it's a locked Y2 science/art subject in Year 3, match it to the normal counterpart in Year 2
    if (refSubject.role === 'physique_y2') {
        const found = subjectList.find(s => s.name.toLowerCase().includes('physique'));
        if (found) return found;
    }
    if (refSubject.role === 'chimie_y2') {
        const found = subjectList.find(s => s.name.toLowerCase().includes('chimie'));
        if (found) return found;
    }
    if (refSubject.role === 'art_y2') {
        const found = subjectList.find(s => s.role === 'art');
        if (found) return found;
    }
    // 3. Fallback to matching by name (case-insensitive, trimmed)
    const refNameClean = refSubject.name.toLowerCase().trim();
    const foundByName = subjectList.find(s => s.name.toLowerCase().trim() === refNameClean);
    if (foundByName) return foundByName;

    // 4. Try matching partial names
    const foundPartial = subjectList.find(s => s.name.toLowerCase().includes(refNameClean) || refNameClean.includes(s.name.toLowerCase()));
    return foundPartial || null;
}

function getAnnualAverageForSubjectInYear(yearNum, refSubject) {
    let list = [];
    if (yearNum === 1) list = state.subjectsYear1;
    else if (yearNum === 2) list = state.subjectsYear2;
    else if (yearNum === 3) list = state.subjectsYear3;

    if (yearNum === 3) {
        if (refSubject.role === 'art_y2') {
            return getYear2ArtAverage();
        }
        if (refSubject.role === 'physique_y2') {
            return getYear2SubjectAverage('physique');
        }
        if (refSubject.role === 'chimie_y2') {
            return getYear2SubjectAverage('chimie');
        }
    }

    const matched = findMatchingSubject(list, refSubject);
    if (!matched) return null;
    
    const data = calculateSubjectData(matched, 'annual');
    return data.rawAverage !== null ? data.roundedAverage : null;
}

function renderSubjectEvolutionChart(subject, drawer) {
    const points = [];
    const xCoords = { 1: 60, 2: 180, 3: 300 };
    
    [1, 2, 3].forEach(y => {
        const avg = getAnnualAverageForSubjectInYear(y, subject);
        if (avg !== null && !isNaN(avg)) {
            const svgY = 85 - (avg - 1.0) * (70 / 5.0);
            points.push({ year: y, avg: avg, x: xCoords[y], y: svgY });
        }
    });

    if (points.length === 0) {
        drawer.innerHTML = `
            <div style="text-align: center; font-size: 0.8rem; color: var(--color-text-muted); padding: 1rem 0;">
                Aucune moyenne disponible pour tracer l'évolution sur 3 ans.
            </div>
        `;
        return;
    }

    let pathHTML = '';
    if (points.length > 1) {
        const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        pathHTML = `<path d="${pathData}" fill="none" stroke="var(--color-primary)" stroke-width="2.5" />`;
    }

    const circlesHTML = points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#0f172a" stroke="var(--color-primary)" stroke-width="2" />
        <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="white">${p.avg.toFixed(1)}</text>
    `).join('');

    const thresholdY = 85 - (4.0 - 1.0) * (70 / 5.0); // 43

    drawer.innerHTML = `
        <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
            <span>📈 Évolution de ${escapeHTML(subject.name)}</span>
            <span style="font-weight: normal; font-size: 0.75rem; color: var(--color-text-muted);">Seuil de promotion: 4.0</span>
        </div>
        <div style="background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 0.5rem; display: flex; justify-content: center;">
            <svg viewBox="0 0 360 100" width="100%" height="100" style="max-width: 360px; overflow: visible;">
                <!-- Promotion Threshold Line -->
                <line x1="20" y1="${thresholdY}" x2="340" y2="${thresholdY}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.6" />
                <text x="15" y="${thresholdY + 3}" font-size="8" fill="#ef4444" font-weight="bold" text-anchor="end">4.0</text>
                
                <!-- X-Axis Labels -->
                <text x="60" y="98" font-size="9" fill="var(--color-text-muted)" text-anchor="middle">1ère année</text>
                <text x="180" y="98" font-size="9" fill="var(--color-text-muted)" text-anchor="middle">2ème année</text>
                <text x="300" y="98" font-size="9" fill="var(--color-text-muted)" text-anchor="middle">3ème année</text>

                <!-- Grid lines for years -->
                <line x1="60" y1="15" x2="60" y2="85" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <line x1="180" y1="15" x2="180" y2="85" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <line x1="300" y1="15" x2="300" y2="85" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

                <!-- Trend Line and circles -->
                ${pathHTML}
                ${circlesHTML}
            </svg>
        </div>
    `;
}

function updateTabVisibility() {
    const isYear4 = (state.currentYear === 4);
    
    const evoContainer = document.getElementById('evolution-slide-container');
    const semTabs = document.querySelector('.semester-sidebar') || document.querySelector('.semester-tabs-container');
    const subjectsSec = document.querySelector('.subjects-section');
    const bilanSec = document.querySelector('.bilan-section');
    const addSubBtn = document.getElementById('add-subject-btn');

    if (isYear4) {
        if (evoContainer) evoContainer.style.display = 'flex';
        if (promoDashboard) promoDashboard.style.display = 'none';
        if (semTabs) semTabs.style.display = 'none';
        if (subjectsSec) subjectsSec.style.display = 'none';
        if (bilanSec) bilanSec.style.display = 'none';
        if (addSubBtn) addSubBtn.style.display = 'none';
        
        renderDedicatedEvolutionSlide();
    } else {
        if (evoContainer) evoContainer.style.display = 'none';
        if (promoDashboard) promoDashboard.style.display = 'block';
        if (semTabs) semTabs.style.display = 'flex';
        if (subjectsSec) subjectsSec.style.display = 'block';
        if (bilanSec) bilanSec.style.display = 'block';
        if (addSubBtn) addSubBtn.style.display = 'inline-flex';
    }
}

function renderDedicatedEvolutionSlide() {
    const container = document.getElementById('evolution-slide-container');
    if (!container) return;

    container.innerHTML = `
        <!-- Overall Average Trend Card -->
        <div class="subject-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="font-size: 1.15rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <span>📈 Évolution Générale</span>
                </h3>
                <span style="font-size: 0.8rem; color: var(--color-text-secondary); font-weight: 500;">Moyennes annuelles générales sur 3 ans</span>
            </div>
            <div id="evolution-graph-wrapper" style="position: relative; width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center;">
                <!-- Dynamically rendered -->
            </div>
        </div>

        <!-- Multi-Subject Comparison Card -->
        <div class="subject-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="font-size: 1.15rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <span>Évolution par Branche</span>
                </h3>
                <span style="font-size: 0.8rem; color: var(--color-text-secondary); font-weight: 500;">Branches principales et OS</span>
            </div>
            <div id="multi-subject-graph-wrapper" style="position: relative; width: 100%; min-height: 250px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <!-- Dynamically rendered -->
            </div>
        </div>
    `;

    renderEvolutionGraph();
    renderMultiSubjectGraph();
}

function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

function getAllUniqueSubjects() {
    const unique = [];
    const seen = new Set();

    const addFromList = (list) => {
        if (!list) return;
        list.forEach(sub => {
            let key = sub.role;
            if (!key || ['general', 'standard', 'locked'].includes(key)) {
                key = sub.name.toLowerCase().trim();
            }
            if (key === 'physique_y2') key = 'physique';
            if (key === 'chimie_y2') key = 'chimie';
            if (key === 'art_y2') key = 'art';

            if (!seen.has(key)) {
                seen.add(key);
                
                let label = sub.name;
                if (sub.role === 'physique_y2') label = 'Physique';
                if (sub.role === 'chimie_y2') label = 'Chimie';
                if (sub.role === 'art_y2') {
                    const y2Art = state.subjectsYear2.find(s => s.role === 'art');
                    label = y2Art ? y2Art.name : 'Arts Visuels';
                }
                
                unique.push({
                    key: key,
                    label: label,
                    name: label,
                    role: sub.role
                });
            }
        });
    };

    addFromList(state.subjectsYear1);
    addFromList(state.subjectsYear2);
    addFromList(state.subjectsYear3);

    return unique;
}

function renderMultiSubjectGraph() {
    const wrapper = document.getElementById('multi-subject-graph-wrapper');
    if (!wrapper) return;

    const allSubjects = getAllUniqueSubjects();

    if (allSubjects.length === 0) {
        wrapper.innerHTML = `
            <div class="graph-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary); opacity: 0.4;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <h4>Aucune donnée de moyenne annuelle</h4>
                <p>Saisissez des notes pour afficher la comparaison.</p>
            </div>
        `;
        return;
    }

    const subjectColors = [
        '#ef4444', // Red
        '#3b82f6', // Blue
        '#10b981', // Emerald Green
        '#f59e0b', // Amber
        '#a78bfa', // Violet
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#f97316', // Orange
        '#14b8a6', // Teal
        '#84cc16', // Lime
        '#8b5cf6', // Purple
        '#6366f1', // Indigo
        '#d946ef'  // Fuchsia
    ];

    allSubjects.forEach((sub, idx) => {
        sub.color = subjectColors[idx % subjectColors.length];
    });

    // Initialize filter set if not present (By default, only show the core subjects to keep the graph clean)
    if (!activeSubjectFilters) {
        activeSubjectFilters = new Set();
        const coreRoles = ['math', 'french', 'os', 'l2', 'l3'];
        allSubjects.forEach(sub => {
            if (coreRoles.includes(sub.role)) {
                activeSubjectFilters.add(sub.key);
            }
        });
    }

    const filtersHTML = `
        <div style="font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 0.75rem; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span>Sélectionnez les branches à afficher :</span>
            <button type="button" class="btn-chart-control" id="btn-chart-all" style="background: none; border: none; color: var(--color-primary); font-size: 0.75rem; cursor: pointer; text-decoration: underline; font-weight: 600;">Tout afficher</button>
            <span style="color: var(--color-border-subtle); font-size: 0.75rem;">|</span>
            <button type="button" class="btn-chart-control" id="btn-chart-none" style="background: none; border: none; color: var(--color-primary); font-size: 0.75rem; cursor: pointer; text-decoration: underline; font-weight: 600;">Effacer</button>
        </div>
        <div class="chart-filters" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; justify-content: center; width: 100%;">
            ${allSubjects.map(sub => {
                const active = activeSubjectFilters.has(sub.key);
                return `
                    <button type="button" class="filter-pill ${active ? 'active' : ''}" data-key="${sub.key}" style="${active ? `border-color: ${sub.color}; background-color: rgba(${hexToRgb(sub.color)}, 0.1);` : ''}">
                        <span class="pill-dot" style="background-color: ${active ? sub.color : 'var(--color-text-muted)'};"></span>
                        <span>${escapeHTML(sub.label)}</span>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    const xCoords = { 1: 100, 2: 300, 3: 500 };
    const mapY = (val) => {
        const clamped = Math.max(1.0, Math.min(6.0, val));
        return 180 - ((clamped - 1.0) / 5.0) * 150;
    };

    const thresholdY = mapY(4.0);

    let graphGroupsHTML = '';
    let hasAnyDataToPlot = false;

    allSubjects.forEach(sub => {
        if (!activeSubjectFilters.has(sub.key)) return;

        const points = [];
        [1, 2, 3].forEach(y => {
            const avg = getAnnualAverageForSubjectInYear(y, sub);
            if (avg !== null && !isNaN(avg)) {
                points.push({ year: y, val: avg, x: xCoords[y], y: mapY(avg) });
                hasAnyDataToPlot = true;
            }
        });

        if (points.length === 0) return;

        let pathHTML = '';
        if (points.length > 1) {
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            pathHTML = `<path d="${pathData}" fill="none" stroke="${sub.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
        }

        let markersHTML = points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="5" fill="#0f172a" stroke="${sub.color}" stroke-width="2" />
            <text class="node-text" x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="white" stroke="#0f172a" stroke-width="3" paint-order="stroke fill">${p.val.toFixed(1)}</text>
        `).join('');

        graphGroupsHTML += `
            <g class="graph-line-group" data-key="${sub.key}">
                ${pathHTML}
                ${markersHTML}
            </g>
        `;
    });

    let svgHTML = '';
    if (hasAnyDataToPlot) {
        svgHTML = `
            <svg id="multi-subject-svg" viewBox="0 0 600 220" width="100%" height="220" style="overflow: visible; cursor: crosshair;">
                <!-- Grid horizontal lines -->
                <line x1="50" y1="${mapY(6.0)}" x2="550" y2="${mapY(6.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(5.0)}" x2="550" y2="${mapY(5.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(3.0)}" x2="550" y2="${mapY(3.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(2.0)}" x2="550" y2="${mapY(2.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

                <!-- Promotion Limit Line (4.0) -->
                <line x1="50" y1="${thresholdY}" x2="550" y2="${thresholdY}" stroke="#ef4444" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.6"/>
                <text x="555" y="${thresholdY + 3}" fill="#ef4444" font-family="var(--font-family-sans)" font-size="10" font-weight="700">4.0</text>

                <!-- X-Axis Labels -->
                <text x="100" y="212" font-size="11" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">1ère année</text>
                <text x="300" y="212" font-size="11" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">2ème année</text>
                <text x="500" y="212" font-size="11" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">3ème année</text>

                <!-- Vertical grid lines -->
                <line x1="100" y1="20" x2="100" y2="190" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <line x1="300" y1="20" x2="300" y2="190" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <line x1="500" y1="20" x2="500" y2="190" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

                <!-- Grouped lines and circles -->
                ${graphGroupsHTML}
            </svg>
        `;
    } else {
        svgHTML = `
            <div class="graph-empty-state" style="margin-top: 1rem; width: 100%; min-height: 180px; display: flex; align-items: center; justify-content: center;">
                <p style="color: var(--color-text-muted); font-size: 0.9rem;">Aucune branche n'est sélectionnée ou aucune moyenne n'est disponible.</p>
            </div>
        `;
    }

    wrapper.innerHTML = filtersHTML + svgHTML;

    // Attach click listeners to filter pills
    wrapper.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (activeSubjectFilters.has(key)) {
                activeSubjectFilters.delete(key);
            } else {
                activeSubjectFilters.add(key);
            }
            renderMultiSubjectGraph();
        });
    });

    // Attach click listeners for control buttons (all/none)
    const btnAll = wrapper.querySelector('#btn-chart-all');
    const btnNone = wrapper.querySelector('#btn-chart-none');
    if (btnAll) {
        btnAll.addEventListener('click', () => {
            allSubjects.forEach(sub => activeSubjectFilters.add(sub.key));
            renderMultiSubjectGraph();
        });
    }
    if (btnNone) {
        btnNone.addEventListener('click', () => {
            activeSubjectFilters.clear();
            renderMultiSubjectGraph();
        });
    }

    // Attach hover highlight listeners to filter pills
    wrapper.querySelectorAll('.filter-pill').forEach(btn => {
        const key = btn.getAttribute('data-key');
        
        btn.addEventListener('mouseover', () => {
            const svg = wrapper.querySelector('#multi-subject-svg');
            if (svg) {
                svg.classList.add('has-highlight');
                const grp = svg.querySelector(`.graph-line-group[data-key="${key}"]`);
                if (grp) grp.classList.add('highlighted');
            }
        });

        btn.addEventListener('mouseout', () => {
            const svg = wrapper.querySelector('#multi-subject-svg');
            if (svg) {
                svg.classList.remove('has-highlight');
                const grp = svg.querySelector(`.graph-line-group[data-key="${key}"]`);
                if (grp) grp.classList.remove('highlighted');
            }
        });
    });
}

function renderEvolutionGraph() {
    const wrapper = document.getElementById('evolution-graph-wrapper');
    if (!wrapper) return;

    const resultsY1 = checkVaudPromotion(state.subjectsYear1, 'annual');
    const resultsY2 = checkVaudPromotion(state.subjectsYear2, 'annual');
    const resultsY3 = checkVaudPromotion(state.subjectsYear3, 'annual');

    const avgY1 = resultsY1.activeSubjectsCount > 0 ? resultsY1.overallAverage : null;
    const avgY2 = resultsY2.activeSubjectsCount > 0 ? resultsY2.overallAverage : null;
    const avgY3 = resultsY3.activeSubjectsCount > 0 ? resultsY3.overallAverage : null;

    const points = [];
    if (avgY1 !== null) points.push({ x: 100, val: avgY1, label: "1ère année" });
    if (avgY2 !== null) points.push({ x: 300, val: avgY2, label: "2ème année" });
    if (avgY3 !== null) points.push({ x: 500, val: avgY3, label: "3ème année" });

    if (points.length === 0) {
        wrapper.innerHTML = `
            <div class="graph-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary); opacity: 0.4;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <h4>Aucune moyenne annuelle à afficher</h4>
                <p>Saisissez des notes pour afficher l'évolution de vos moyennes sur 3 ans.</p>
            </div>
        `;
        return;
    }

    const mapY = (val) => {
        const clamped = Math.max(1.0, Math.min(6.0, val));
        return 160 - ((clamped - 1.0) / 5.0) * 130;
    };

    points.forEach(pt => {
        pt.y = mapY(pt.val);
    });

    const promotionLimitY = mapY(4.0);

    let pathD = '';
    let areaD = '';
    if (points.length > 1) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }
        areaD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            areaD += ` L ${points[i].x} ${points[i].y}`;
        }
        areaD += ` L ${points[points.length - 1].x} 175 L ${points[0].x} 175 Z`;
    }

    let svgContent = `
        <svg class="evolution-graph-svg" viewBox="0 0 600 200">
            <defs>
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.0"/>
                </linearGradient>
                <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#3b82f6"/>
                    <stop offset="100%" stop-color="#10b981"/>
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <!-- Grid horizontal lines -->
            <line x1="50" y1="${mapY(6.0)}" x2="550" y2="${mapY(6.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="50" y1="${mapY(5.0)}" x2="550" y2="${mapY(5.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="50" y1="${mapY(3.0)}" x2="550" y2="${mapY(3.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="50" y1="${mapY(2.0)}" x2="550" y2="${mapY(2.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

            <!-- Promotion Limit Line (4.0) -->
            <line x1="50" y1="${promotionLimitY}" x2="550" y2="${promotionLimitY}" stroke="rgba(245,158,11,0.25)" stroke-dasharray="6,4" stroke-width="1.5"/>
            <text x="555" y="${promotionLimitY + 3}" fill="rgba(245,158,11,0.7)" font-family="var(--font-family-sans)" font-size="10" font-weight="700">4.0 (limite)</text>

            <!-- Area under line -->
            ${areaD ? `<path class="graph-area" d="${areaD}" fill="url(#area-grad)"/>` : ''}

            <!-- Connecting Line -->
            ${pathD ? `<path class="graph-path" d="${pathD}" stroke="url(#line-grad)" stroke-width="3" stroke-linecap="round" fill="none"/>` : ''}

            <!-- Node Points -->
            ${points.map((pt, idx) => {
                const color = pt.val >= 4.0 ? '#10b981' : '#ef4444';
                return `
                    <g class="graph-node" style="animation-delay: ${idx * 0.15}s;">
                        <circle cx="${pt.x}" cy="${pt.y}" r="7" fill="${color}" filter="url(#glow)"/>
                        <circle cx="${pt.x}" cy="${pt.y}" r="3" fill="white"/>
                        
                        <!-- Value label above node -->
                        <text class="node-text" x="${pt.x}" y="${pt.y - 12}" fill="white" font-family="var(--font-family-sans)" font-size="11" font-weight="800" text-anchor="middle">
                            ${pt.val.toFixed(2)}
                        </text>
                        
                        <!-- Year label below node -->
                        <text class="node-label" x="${pt.x}" y="195" fill="var(--color-text-secondary)" font-family="var(--font-family-sans)" font-size="10" font-weight="600" text-anchor="middle">
                            ${pt.label}
                        </text>
                    </g>
                `;
            }).join('')}
        </svg>
    `;
    wrapper.innerHTML = svgContent;
}

function getSubjectCardInnerHTML(subject, sem) {
    const data = calculateSubjectData(subject, sem);
    const avgRaw = data.rawAverage;
    const avgRounded = data.roundedAverage;

    // Circular badge average
    let badgeHTML = '';
    if (avgRaw !== null) {
        const statusClass = getStatusClass(avgRounded);
        badgeHTML = `
            <div class="subject-average-badge ${statusClass}">
                <span class="subject-average-val">${avgRaw.toFixed(2)}</span>
                <span class="subject-average-lbl">MOYENNE</span>
            </div>
        `;
    } else {
        badgeHTML = `
            <div class="subject-average-badge empty">
                <span class="subject-average-val">—</span>
                <span class="subject-average-lbl">MOYENNE</span>
            </div>
        `;
    }

    // Target status
    let targetStatusHTML = '';
    if (avgRaw !== null) {
        const isTargetMet = avgRaw >= subject.target;
        if (isTargetMet) {
            targetStatusHTML = '<span class="subject-status" style="display:inline-flex; align-items:center; gap:0.25rem;"><svg class="status-icon success" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Objectif atteint</span>';
        } else if (avgRounded === 4.0 && subject.target === 4.0) {
            targetStatusHTML = '<span class="subject-status warning" style="display:inline-flex; align-items:center; gap:0.25rem;"><svg class="status-icon warning" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Objectif atteint (limite)</span>';
        } else {
            targetStatusHTML = '<span class="subject-status not-reached" style="display:inline-flex; align-items:center; gap:0.25rem;"><svg class="status-icon danger" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Objectif non atteint</span>';
        }
    } else {
        targetStatusHTML = '<span class="subject-status neutral">Aucune note pour l\'instant.</span>';
    }

    // Separate grades into TA and TS lanes
    const gradesList = (subject.grades && subject.grades[sem]) ? subject.grades[sem] : [];
    const tas = gradesList.filter(g => g.type === 'TA');
    const tss = gradesList.filter(g => g.type === 'TS');

    const createPillsHTML = (list) => {
        if (list.length === 0) return '<span style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic;">—</span>';
        return list.map(g => {
            const statusClass = getStatusClass(g.value);
            const commentIndicator = '';
            const photoIndicator = g.hasPhoto ? '<svg class="grade-indicator-icon" style="margin-left:2px;" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' : '';
            const indicators = (commentIndicator || photoIndicator) ? `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-left:0.15rem; gap:1px; opacity:0.85;">${commentIndicator}${photoIndicator}</span>` : '';
            return `
                <div class="grade-pill ${statusClass}" data-grade-id="${g.id}">
                    <span>${g.value.toFixed(1)}</span>${indicators}
                </div>
            `;
        }).join('');
    };

    // Calculate lane averages for display header
    const getLaneAvgHTML = (list) => {
        if (list.length === 0) return '';
        const sum = list.reduce((s, g) => s + g.value, 0);
        const avg = sum / list.length;
        const rounded = roundToHalfPoint(avg);
        const statusClass = getStatusClass(rounded);
        return `<span class="lane-avg-badge ${statusClass}">moy: ${avg.toFixed(2)} (≈ ${rounded.toFixed(1)})</span>`;
    };

    // Langue 2 selector inside its header card
    let langToggleHTML = '';
    if (subject.role === 'l2') {
        const isDe = subject.name === 'Allemand';
        const isIt = subject.name === 'Italien';
        langToggleHTML = `
            <div class="lang-toggle-container" style="margin-left: 0.5rem; vertical-align: middle; padding: 1px;">
                <button type="button" class="lang-toggle-btn ${isDe ? 'active' : ''}" data-lang="Allemand">DE</button>
                <button type="button" class="lang-toggle-btn ${isIt ? 'active' : ''}" data-lang="Italien">IT</button>
            </div>
        `;
    }

    // Art Visuel / Musique selector inside its header card
    let artToggleHTML = '';
    if (subject.role === 'art') {
        const isArts = subject.name === 'Arts Visuels';
        const isMus = subject.name === 'Musique';
        artToggleHTML = `
            <div class="lang-toggle-container" style="margin-left: 0.5rem; vertical-align: middle; padding: 1px;">
                <button type="button" class="lang-toggle-btn ${isArts ? 'active' : ''}" data-lang="Arts Visuels">Arts</button>
                <button type="button" class="lang-toggle-btn ${isMus ? 'active' : ''}" data-lang="Musique">Musique</button>
            </div>
        `;
    }

    const mode = subject.evaluationMode || 'dual';
    let lanesHTML = '';
    let footerHTML = '';

    if (mode === 'locked') {
        let detailText = '';
        if (subject.role === 'physique_y2') {
            detailText = formatYear2SubjectAvg('physique');
        } else if (subject.role === 'chimie_y2') {
            detailText = formatYear2SubjectAvg('chimie');
        } else if (subject.role === 'art_y2') {
            detailText = formatYear2ArtAvg();
        }
        lanesHTML = `
            <div class="grade-lanes-container" style="grid-template-columns: 1fr;">
                <div class="grade-lane">
                    <div class="lane-title">
                        <span>Moyenne reprise de la 2ème année</span>
                    </div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: white; padding: 0.25rem 0;">
                        ${detailText}
                    </div>
                </div>
            </div>
        `;
        const showEvoBtn = (state.currentYear === 3 && sem === 'annual');
        const evoBtnHTML = showEvoBtn ? `<button type="button" class="btn-sub-evo" title="Afficher l'évolution sur 3 ans">Évolution</button>` : '';

        footerHTML = `
            <div class="subject-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                ${targetStatusHTML}
                ${evoBtnHTML}
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary); font-style: italic; margin-top: 0.5rem;">
                Note de 2ème année verrouillée pour le Bilan.
            </div>
        `;
    } else if (sem === 'annual') {
        // Annual Combined view: show comparison of Sem 1 and Sem 2 averages and final average
        const avgSem1 = data.sem1Data ? data.sem1Data.roundedAverage : null;
        const avgSem2 = data.sem2Data ? data.sem2Data.roundedAverage : null;
        const avgAnn = data.roundedAverage;

        const getCompareValClass = (val) => {
            if (val === null || val === undefined) return 'empty';
            if (val < 4.0) return 'failing';
            if (val === 4.0) return 'warning';
            return 'passing';
        };

        const formatVal = (val) => (val !== null && val !== undefined) ? val.toFixed(1) : '—';

        lanesHTML = `
            <div class="annual-comparison-grid">
                <div class="comparison-col">
                    <span class="comparison-col-title">Semestre 1</span>
                    <span class="comparison-col-val ${getCompareValClass(avgSem1)}">${formatVal(avgSem1)}</span>
                </div>
                <div class="comparison-col">
                    <span class="comparison-col-title">Semestre 2</span>
                    <span class="comparison-col-val ${getCompareValClass(avgSem2)}">${formatVal(avgSem2)}</span>
                </div>
                <div class="comparison-col" style="border-left: 1px solid var(--color-border-subtle); padding-left: 0.5rem;">
                    <span class="comparison-col-title" style="color: var(--color-primary);">Note Annuelle</span>
                    <span class="comparison-col-val ${getCompareValClass(avgAnn)}" style="font-size: 1.3rem;">${formatVal(avgAnn)}</span>
                </div>
            </div>
        `;

        const showEvoBtn = (state.currentYear === 3);
        const evoBtnHTML = showEvoBtn ? `<button type="button" class="btn-sub-evo" title="Afficher l'évolution sur 3 ans">Évolution</button>` : '';

        footerHTML = `
            <div class="subject-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                ${targetStatusHTML}
                ${evoBtnHTML}
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary); font-style: italic; margin-top: 0.5rem;">
                Notes éditables en mode Semestre uniquement.
            </div>
        `;
    } else {
        // Normal semester view: show lanes
        if (mode === 'standard') {
            lanesHTML = `
                <div class="grade-lanes-container" style="grid-template-columns: 1fr;">
                    <div class="grade-lane">
                        <div class="lane-title">
                            <span>Notes</span>
                            ${getLaneAvgHTML(gradesList)}
                        </div>
                        <div class="lane-grades-list">
                            ${createPillsHTML(gradesList)}
                        </div>
                    </div>
                </div>
            `;
        } else {
            lanesHTML = `
                <div class="grade-lanes-container">
                    <div class="grade-lane">
                        <div class="lane-title">
                            <span>TS</span>
                            ${getLaneAvgHTML(tss)}
                        </div>
                        <div class="lane-grades-list">
                            ${createPillsHTML(tss)}
                        </div>
                    </div>
                    <div class="grade-lane">
                        <div class="lane-title">
                            <span>TA</span>
                            ${getLaneAvgHTML(tas)}
                        </div>
                        <div class="lane-grades-list">
                            ${createPillsHTML(tas)}
                        </div>
                    </div>
                </div>
            `;
        }

        footerHTML = `
            <div class="subject-footer">
                ${targetStatusHTML}
                <button class="btn btn-secondary add-grade-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: var(--radius-full);">
                    + Ajouter une note
                </button>
            </div>
        `;
    }

    let ocEditHTML = '';
    if (subject.role === 'oc') {
        ocEditHTML = `
            <button type="button" class="oc-edit-btn" title="Modifier le sujet choisi">
                modifier
            </button>
        `;
    }

    let osEditHTML = '';
    if (subject.role === 'os') {
        osEditHTML = `
            <button type="button" class="os-edit-btn" title="Modifier le nom de l'OS">
                modifier
            </button>
        `;
    }

    const isStandardSubject = subject.id.startsWith('y1_') || subject.id.startsWith('y2_') || subject.id.startsWith('y3_');
    const deleteBtnHTML = isStandardSubject ? '' : `<button class="btn-delete-subject" title="Supprimer la branche">&times;</button>`;
    const drawerHTML = (state.currentYear === 3 && sem === 'annual') ? `<div class="sub-evo-drawer"></div>` : '';

    let simulatorHTML = '';
    if (mode !== 'locked' && sem !== 'annual') {
        simulatorHTML = `
            <div class="target-simulator" data-subject-id="${subject.id}">
                <div class="simulator-header">
                    <span>Cible : <strong style="color: var(--color-primary);">${subject.target.toFixed(1)}</strong></span>
                    <span style="font-size: 0.7rem; color: var(--color-text-muted);">Simulateur de réussite</span>
                </div>
                <div class="simulator-controls">
                    <select class="sim-num-tests">
                        <option value="1">1 test</option>
                        <option value="2">2 tests</option>
                        <option value="3">3 tests</option>
                        <option value="4">4 tests</option>
                    </select>
                    ${mode === 'dual' ? `
                    <span style="font-size: 0.75rem; color: var(--color-text-muted);">en</span>
                    <select class="sim-type">
                        <option value="TS">TS</option>
                        <option value="TA">TA</option>
                    </select>
                    ` : ''}
                    <span style="font-size: 0.75rem; color: var(--color-text-muted);">req. :</span>
                    <span class="sim-result-badge">...</span>
                </div>
            </div>
        `;
    }

    return `
        ${deleteBtnHTML}
        <div class="subject-header">
            <div class="subject-title-area">
                <h3 class="subject-name" style="display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap;">
                    ${escapeHTML(subject.name)}
                    ${ocEditHTML}
                    ${osEditHTML}
                    ${langToggleHTML}
                    ${artToggleHTML}
                </h3>
                <span class="subject-target" title="Cliquez pour modifier l'objectif">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    Objectif <span class="subject-target-val">${subject.target.toFixed(1)}</span>
                </span>
            </div>
            ${badgeHTML}
        </div>

        <!-- Lanes or Comparison layout -->
        ${lanesHTML}

        ${simulatorHTML}
        ${footerHTML}
        ${drawerHTML}
    `;
}

function updateSubjectDetailsModalContent(subject) {
    const modalContent = document.getElementById('subject-details-modal-content');
    if (!modalContent) return;
    
    modalContent.innerHTML = '';
    
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.setAttribute('data-id', subject.id);
    card.style.background = 'none';
    card.style.border = 'none';
    card.style.padding = '0';
    card.style.boxShadow = 'none';
    card.style.backdropFilter = 'none';
    card.style.webkitBackdropFilter = 'none';
    
    const sem = state.currentSemester;
    card.innerHTML = getSubjectCardInnerHTML(subject, sem);
    modalContent.appendChild(card);
    
    const mode = subject.evaluationMode || 'dual';
    if (mode !== 'locked' && sem !== 'annual') {
        updateCardSimulatorBadge(card, subject, sem);
    }
}

function openSubjectDetailsModal(subject) {
    activeDetailsSubjectId = subject.id;
    updateSubjectDetailsModalContent(subject);
    openModal(document.getElementById('subject-details-modal'));
}

function renderSubjects() {
    subjectsContainer.innerHTML = '';
    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const sem = state.currentSemester;

    if (state.promoViewMode === 'visual') {
        subjectsContainer.classList.add('gemstone-mode');
        
        currentSubjects.forEach((subject, index) => {
            const data = calculateSubjectData(subject, sem);
            const avgRaw = data.rawAverage;
            const avgRounded = data.roundedAverage;
            const gemClass = getGemClassForSubject(subject, index);

            let displayAvg = '—';
            let statusClass = 'empty';
            if (avgRaw !== null) {
                displayAvg = avgRaw.toFixed(2);
                statusClass = getStatusClass(avgRounded);
            }

            const gemDisplayName = gemClass.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            const isStandardSubject = subject.id.startsWith('y1_') || subject.id.startsWith('y2_') || subject.id.startsWith('y3_');
            const deleteBtnHTML = isStandardSubject ? '' : `<button class="btn-delete-gem" data-id="${subject.id}" title="Supprimer la branche">&times;</button>`;

            const item = document.createElement('div');
            item.className = 'gem-item';
            item.setAttribute('data-id', subject.id);
            item.innerHTML = `
                ${deleteBtnHTML}
                <div class="gem-sphere gem-${gemClass} ${statusClass}">
                    <div class="gem-texture"></div>
                    <span class="gem-sphere-average">${displayAvg}</span>
                </div>
                <div class="gem-sphere-shadow"></div>
                <div class="gem-subject-name">${escapeHTML(subject.name)}</div>
                <div class="gem-type-name">${gemDisplayName}</div>
            `;
            subjectsContainer.appendChild(item);
        });

        // Initialize rotation dragging physics on the new spheres
        initGemstoneRotation();

        // If there is an active details subject modal open, re-render it
        if (activeDetailsSubjectId) {
            const activeSubject = currentSubjects.find(s => s.id === activeDetailsSubjectId);
            if (activeSubject) {
                updateSubjectDetailsModalContent(activeSubject);
            } else {
                closeModal(document.getElementById('subject-details-modal'));
                activeDetailsSubjectId = null;
            }
        }
    } else {
        subjectsContainer.classList.remove('gemstone-mode');
        
        currentSubjects.forEach(subject => {
            const data = calculateSubjectData(subject, sem);
            
            // Subject Card container
            const card = document.createElement('div');
            card.className = animateCards ? 'subject-card slide-up' : 'subject-card';
            card.setAttribute('data-id', subject.id);
            
            card.innerHTML = getSubjectCardInnerHTML(subject, sem);
            subjectsContainer.appendChild(card);
            
            const mode = subject.evaluationMode || 'dual';
            if (mode !== 'locked' && sem !== 'annual') {
                updateCardSimulatorBadge(card, subject, sem);
            }
        });
    }
    animateCards = false;
}

function initGemstoneRotation() {
    const spheres = subjectsContainer.querySelectorAll('.gem-sphere');
    spheres.forEach(sphere => {
        const item = sphere.closest('.gem-item');
        const subId = item.getAttribute('data-id');
        const texture = sphere.querySelector('.gem-texture');
        if (!texture) return;
        
        let isDragging = false;
        let startX = 0, startY = 0;
        let currentX = 0, currentY = 0; // Current position of texture
        let lastX = 0, lastY = 0;
        let vx = 0, vy = 0; // Velocities
        let rotationAngle = 0; // tracking 2D spin angle in degrees
        let rafId = null;
        let dragDistance = 0;
        
        const maxShift = 20; // Maximum texture slide boundary in pixels (keeps 196px photo inside 140px sphere)

        // Physics step function for inertia
        function physicsStep() {
            vx *= 0.95;
            vy *= 0.95;
            currentX += vx;
            currentY += vy;
            
            // Add spin based on translation velocities
            rotationAngle += (vx + vy) * 0.5;
            
            // Bounce/clamp at texture boundaries - vector distance clamp
            const dist = Math.sqrt(currentX * currentX + currentY * currentY);
            if (dist > maxShift) {
                currentX = (currentX / dist) * maxShift;
                currentY = (currentY / dist) * maxShift;
                vx = -vx * 0.2;
                vy = -vy * 0.2;
            }
            
            texture.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotationAngle}deg)`;
            
            if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
                rafId = requestAnimationFrame(physicsStep);
            } else {
                rafId = null;
                if (item) item.classList.remove('is-rotating');
            }
        }

        // Pointer start (Mouse & Touch)
        function onPointerStart(clientX, clientY) {
            isDragging = true;
            dragDistance = 0;
            
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            startX = clientX - currentX;
            startY = clientY - currentY;
            lastX = clientX;
            lastY = clientY;
            vx = 0;
            vy = 0;
            
            sphere.style.cursor = 'grabbing';
            if (item) item.classList.add('is-rotating');
        }

        // Pointer move
        function onPointerMove(clientX, clientY) {
            if (!isDragging) return;
            
            const dx = clientX - lastX;
            const dy = clientY - lastY;
            dragDistance += Math.sqrt(dx * dx + dy * dy);
            
            currentX = clientX - startX;
            currentY = clientY - startY;
            
            // Constrain drag within limits - vector distance clamp
            const dist = Math.sqrt(currentX * currentX + currentY * currentY);
            if (dist > maxShift) {
                currentX = (currentX / dist) * maxShift;
                currentY = (currentY / dist) * maxShift;
            }
            
            // Calculate velocity with smoothing
            vx = dx * 0.8;
            vy = dy * 0.8;
            
            // Add spin relative to motion
            rotationAngle += (dx + dy) * 0.5;
            
            lastX = clientX;
            lastY = clientY;
            
            texture.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotationAngle}deg)`;
        }

        // Pointer end
        function onPointerEnd() {
            if (!isDragging) return;
            isDragging = false;
            sphere.style.cursor = 'grab';
            
            // If the user barely moved the cursor, treat it as a click!
            if (dragDistance < 6) {
                if (item) item.classList.remove('is-rotating');
                const currentSubjects = state.subjectsYear1;
                const subject = currentSubjects.find(s => s.id === subId);
                if (subject) {
                    openSubjectDetailsModal(subject);
                }
            } else {
                // If it was a drag, start inertia slide
                rafId = requestAnimationFrame(physicsStep);
            }
        }

        // Event listeners - Mouse
        sphere.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onPointerStart(e.clientX, e.clientY);
            
            const onMouseMove = (moveEv) => {
                onPointerMove(moveEv.clientX, moveEv.clientY);
            };
            const onMouseUp = () => {
                onPointerEnd();
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Event listeners - Touch (Mobile)
        sphere.addEventListener('touchstart', (e) => {
            if (e.touches.length === 0) return;
            const touch = e.touches[0];
            onPointerStart(touch.clientX, touch.clientY);
            
            const onTouchMove = (moveEv) => {
                if (moveEv.touches.length === 0) return;
                const t = moveEv.touches[0];
                onPointerMove(t.clientX, t.clientY);
                if (dragDistance > 3) {
                    moveEv.preventDefault();
                }
            };
            const onTouchEnd = () => {
                onPointerEnd();
                sphere.removeEventListener('touchmove', onTouchMove);
                sphere.removeEventListener('touchend', onTouchEnd);
            };
            sphere.addEventListener('touchmove', onTouchMove, { passive: false });
            sphere.addEventListener('touchend', onTouchEnd);
        });
    });
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// --- 10. Modal Management & Click Bindings ---
const addSubjectModal = document.getElementById('add-subject-modal');
const addGradeModal = document.getElementById('add-grade-modal');
const gradeDetailsModal = document.getElementById('grade-details-modal');

// Detail elements
const detailGradeName = document.getElementById('detail-grade-name');
const detailGradeValue = document.getElementById('detail-grade-value');
const detailGradeType = document.getElementById('detail-grade-type');
const detailGradeDate = document.getElementById('detail-grade-date');
const deleteDetailGradeBtn = document.getElementById('delete-detail-grade-btn');
const detailCommentContainer = document.getElementById('detail-comment-container');
const detailGradeComment = document.getElementById('detail-grade-comment');
const detailPhotoContainer = document.getElementById('detail-photo-container');
const detailGradePhoto = document.getElementById('detail-grade-photo');

const detailsModalTitle = document.getElementById('details-modal-title');
const gradeDetailsViewPanel = document.getElementById('grade-details-view-panel');
const gradeDetailsEditPanel = document.getElementById('grade-details-edit-panel');
const gradeDetailsViewActions = document.getElementById('grade-details-view-actions');
const gradeDetailsEditActions = document.getElementById('grade-details-edit-actions');

// Edit inputs
const editGradeName = document.getElementById('edit-grade-name');
const editGradeDate = document.getElementById('edit-grade-date');
const editGradeComment = document.getElementById('edit-grade-comment');
const editOcrLoadingStatus = document.getElementById('edit-ocr-loading-status');
const editGradePhotoPreviewContainer = document.getElementById('edit-grade-photo-preview-container');
const editGradePhotoPreview = document.getElementById('edit-grade-photo-preview');
const editRemoveGradePhotoBtn = document.getElementById('edit-remove-grade-photo-btn');
// Camera scanning states and references
let addGradeCameraStream = null;
let editGradeCameraStream = null;

const btnStartCamera = document.getElementById('btn-start-camera');
const btnCaptureFrame = document.getElementById('btn-capture-frame');
const btnCloseCamera = document.getElementById('btn-close-camera');
const cameraScannerView = document.getElementById('camera-scanner-view');
const cameraStream = document.getElementById('camera-stream');

const editBtnStartCamera = document.getElementById('edit-btn-start-camera');
const editBtnCaptureFrame = document.getElementById('edit-btn-capture-frame');
const editBtnCloseCamera = document.getElementById('edit-btn-close-camera');
const editCameraScannerView = document.getElementById('edit-camera-scanner-view');
const editCameraStream = document.getElementById('edit-camera-stream');

let selectedSubjectIdForDetails = null;
let selectedGradeIdForDetails = null;

async function startScanning(videoElement, containerElement, isEditMode) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        videoElement.srcObject = stream;
        containerElement.style.display = 'block';
        
        if (isEditMode) {
            editGradeCameraStream = stream;
        } else {
            addGradeCameraStream = stream;
        }
    } catch (err) {
        console.error("Failed to start camera:", err);
        alert("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
    }
}

function stopScanning(isEditMode) {
    const stream = isEditMode ? editGradeCameraStream : addGradeCameraStream;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        if (isEditMode) {
            editGradeCameraStream = null;
            if (editCameraStream) editCameraStream.srcObject = null;
            if (editCameraScannerView) editCameraScannerView.style.display = 'none';
        } else {
            addGradeCameraStream = null;
            if (cameraStream) cameraStream.srcObject = null;
            if (cameraScannerView) cameraScannerView.style.display = 'none';
        }
    }
}

function captureFrame(videoElement, isEditMode) {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    stopScanning(isEditMode);
    
    return base64Data;
}

function openModal(modal) {
    modal.classList.add('active');
}
function closeModal(modal) {
    modal.classList.remove('active');
}

function toggleEditMode(enable) {
    if (enable) {
        gradeDetailsViewPanel.style.display = 'none';
        gradeDetailsViewActions.style.display = 'none';
        gradeDetailsEditPanel.style.display = 'flex';
        gradeDetailsEditActions.style.display = 'flex';
        detailsModalTitle.textContent = "Modifier la note";
    } else {
        gradeDetailsViewPanel.style.display = 'flex';
        gradeDetailsViewActions.style.display = 'flex';
        gradeDetailsEditPanel.style.display = 'none';
        gradeDetailsEditActions.style.display = 'none';
        detailsModalTitle.textContent = "Détails de la note";
    }
}

function closeDetailsModalAndReset() {
    stopScanning(true);
    closeModal(gradeDetailsModal);
    toggleEditMode(false);
}

// Modal headers close actions
document.getElementById('close-subject-modal').addEventListener('click', () => closeModal(addSubjectModal));
document.getElementById('cancel-subject-btn').addEventListener('click', () => closeModal(addSubjectModal));

document.getElementById('close-grade-modal').addEventListener('click', () => {
    stopScanning(false);
    closeModal(addGradeModal);
});
document.getElementById('cancel-grade-btn').addEventListener('click', () => {
    stopScanning(false);
    closeModal(addGradeModal);
});

document.getElementById('close-details-modal').addEventListener('click', closeDetailsModalAndReset);
document.getElementById('close-details-btn').addEventListener('click', closeDetailsModalAndReset);
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    stopScanning(true);
    toggleEditMode(false);
});

// Header actions
document.getElementById('add-subject-btn').addEventListener('click', () => {
    document.getElementById('add-subject-form').reset();
    openModal(addSubjectModal);
});

// Removed toggle-promo-view listener

// --- 11. Tabs and Selector Bindings ---
document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentYear = parseInt(btn.getAttribute('data-year'));
        
        // Close details modal on year switch
        closeModal(document.getElementById('subject-details-modal'));
        activeDetailsSubjectId = null;
        
        saveState();
        updateTabVisibility();
        if (state.currentYear !== 4) {
            animateCards = true;
            renderSubjects();
            updateDashboard();
        }
    });
});
document.querySelectorAll('.semester-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.semester-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentSemester = btn.getAttribute('data-sem');
        
        // Close details modal on semester switch
        closeModal(document.getElementById('subject-details-modal'));
        activeDetailsSubjectId = null;
        
        saveState();
        animateCards = true;
        renderSubjects();
        updateDashboard();
    });
});

// --- 12. Grade & Type Chips Bindings ---
document.querySelectorAll('#grade-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#grade-chips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.querySelectorAll('#type-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#type-chips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.querySelectorAll('#edit-grade-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#edit-grade-chips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.querySelectorAll('#edit-type-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#edit-type-chips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

document.querySelectorAll('#subject-mode-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#subject-mode-chips .chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Add Subject form submit
document.getElementById('add-subject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subject-name').value.trim();
    const target = parseFloat(document.getElementById('subject-target').value);
    
    if(!name || isNaN(target)) return;

    // Detect role based on subject name
    let role = 'general';
    const lowerName = name.toLowerCase();
    if(lowerName.includes('math')) role = 'math';
    else if(lowerName.includes('fran')) role = 'french';
    else if(lowerName.includes('os') || lowerName.includes('spécifique')) role = 'os';
    else if(lowerName.includes('allemand') || lowerName.includes('l2') || lowerName.includes('italien')) role = 'l2';
    else if(lowerName.includes('anglais') || lowerName.includes('l3')) role = 'l3';
    else if(lowerName.includes('art') || lowerName.includes('musique')) role = 'art';

    const activeModeBtn = document.querySelector('#subject-mode-chips .chip-btn.active');
    const evaluationMode = activeModeBtn ? activeModeBtn.getAttribute('data-value') : 'dual';

    const newSub = {
        id: 'sub_' + Date.now(),
        name,
        role,
        target,
        evaluationMode,
        grades: {
            sem1: [],
            sem2: []
        }
    };

    if (state.currentYear === 3) {
        state.subjectsYear3.push(newSub);
    } else if (state.currentYear === 2) {
        state.subjectsYear2.push(newSub);
    } else {
        state.subjectsYear1.push(newSub);
    }
    
    saveState();
    renderSubjects();
    updateDashboard();
    
    // Reset modal state
    document.getElementById('add-subject-form').reset();
    document.querySelectorAll('#subject-mode-chips .chip-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === 'dual');
    });
    
    closeModal(addSubjectModal);
});

// Shared helper function for click interactions inside subject cards (normal or detailed modal)
function handleSubjectInteractionClick(e) {
    const card = e.target.closest('.subject-card');
    if (!card) return;
    const subId = card.getAttribute('data-id');
    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const subject = currentSubjects.find(s => s.id === subId);
    if (!subject) return;

    // Toggle subject-specific evolution chart drawer
    if (e.target.classList.contains('btn-sub-evo')) {
        const drawer = card.querySelector('.sub-evo-drawer');
        if (drawer) {
            const isVisible = window.getComputedStyle(drawer).display !== 'none';
            if (isVisible) {
                drawer.style.display = 'none';
            } else {
                drawer.style.display = 'block';
                renderSubjectEvolutionChart(subject, drawer);
            }
        }
        return;
    }

    // Open Add Grade modal
    if (e.target.classList.contains('add-grade-btn')) {
        if (state.currentSemester === 'annual') {
            alert("Veuillez sélectionner le 1er ou le 2ème semestre pour ajouter une note.");
            return;
        }
        document.getElementById('add-grade-form').reset();
        document.getElementById('grade-subject-id').value = subId;
        document.getElementById('modal-subject-name').textContent = subject.name;
        
        // Hide/Show Type selector based on subject evaluationMode
        const typeGroup = document.getElementById('grade-type-group');
        const mode = subject.evaluationMode || 'dual';
        if (typeGroup) {
            if (mode === 'standard') {
                typeGroup.style.display = 'none';
            } else {
                typeGroup.style.display = 'block';
            }
        }
        
        openModal(addGradeModal);
    }

    // Delete branch
    if (e.target.classList.contains('btn-delete-subject')) {
        if (confirm(`Voulez-vous vraiment supprimer la branche "${subject.name}"?`)) {
            if (state.currentYear === 3) {
                state.subjectsYear3 = state.subjectsYear3.filter(s => s.id !== subId);
            } else if (state.currentYear === 2) {
                state.subjectsYear2 = state.subjectsYear2.filter(s => s.id !== subId);
            } else {
                state.subjectsYear1 = state.subjectsYear1.filter(s => s.id !== subId);
            }
            saveState();
            renderSubjects();
            updateDashboard();
        }
    }

    // Edit OC choice name
    const ocEditBtn = e.target.closest('.oc-edit-btn');
    if (ocEditBtn) {
        const newName = prompt("Entrez le nom de votre Option Complémentaire (OC) :", subject.name);
        if (newName && newName.trim() !== "") {
            subject.name = newName.trim();
            saveState();
            renderSubjects();
            updateDashboard();
        }
        return;
    }

    // Edit OS choice name
    const osEditBtn = e.target.closest('.os-edit-btn');
    if (osEditBtn) {
        const newName = prompt("Entrez le nom de votre Option Spécifique (OS) :", subject.name);
        if (newName && newName.trim() !== "") {
            const nameVal = newName.trim();
            subject.name = nameVal;
            
            // Propagate OS name to all years
            state.subjectsYear1.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear2.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear3.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            
            saveState();
            renderSubjects();
            updateDashboard();
        }
        return;
    }

    // Toggle L2 Language or Art/Musique inside the card
    const toggleBtn = e.target.closest('.lang-toggle-btn');
    if (toggleBtn) {
        const lang = toggleBtn.getAttribute('data-lang');
        subject.name = lang;
        
        // If we are changing Year 2 Art, also update Year 3 Art Card name!
        if (subject.role === 'art' && state.currentYear === 2) {
            const y3Art = state.subjectsYear3.find(s => s.role === 'art_y2');
            if (y3Art) {
                y3Art.name = `${lang} (Y2)`;
            }
        }
        
        saveState();
        renderSubjects();
        updateDashboard();
    }

    // Edit objective
    const targetSpan = e.target.closest('.subject-target');
    if (targetSpan) {
        const currentTarget = subject.target;
        const newTargetStr = prompt(`Modifier l'objectif pour ${subject.name} (de 1.0 à 6.0) :`, currentTarget.toFixed(1));
        const newTargetVal = parseFloat(newTargetStr);
        if (!isNaN(newTargetVal) && newTargetVal >= 1.0 && newTargetVal <= 6.0) {
            subject.target = newTargetVal;
            saveState();
            renderSubjects();
            updateDashboard();
        }
    }

    // Click on grade pill -> show details popover modal
    const gradePill = e.target.closest('.grade-pill');
    if (gradePill) {
        const gradeId = gradePill.getAttribute('data-grade-id');
        migrateSubjectGrades(subject);
        const sem = state.currentSemester;
        if (sem !== 'annual') {
            const gradeObj = subject.grades[sem].find(g => g.id === gradeId);
            if (gradeObj) {
                selectedSubjectIdForDetails = subId;
                selectedGradeIdForDetails = gradeId;
                
                detailGradeName.textContent = gradeObj.name || 'Évaluation';
                detailGradeValue.textContent = gradeObj.value.toFixed(1);
                detailGradeType.textContent = gradeObj.type === 'TA' ? 'TA' : 'TS';
                const dateStr = gradeObj.date ? new Date(gradeObj.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non spécifiée';
                detailGradeDate.textContent = dateStr;

                // Load comments
                detailCommentContainer.style.display = 'none';
                detailGradeComment.textContent = '—';
                if (gradeObj.comment) {
                    detailGradeComment.textContent = gradeObj.comment;
                    detailCommentContainer.style.display = 'flex';
                }

                // Load photos
                detailPhotoContainer.style.display = 'none';
                detailGradePhoto.src = '';
                editGradePhotoPreviewContainer.style.display = 'none';
                editGradePhotoPreview.src = '';
                editUploadedPhotoBase64 = null;
                editPhotoDeleted = false;
                editOcrText = "";
                isEditOcrRunning = false;

                if (gradeObj.hasPhoto) {
                    getPhoto(gradeId).then(photoData => {
                        if (photoData) {
                            detailGradePhoto.src = photoData;
                            detailPhotoContainer.style.display = 'flex';
                            editGradePhotoPreview.src = photoData;
                            editGradePhotoPreviewContainer.style.display = 'block';
                            editUploadedPhotoBase64 = photoData;
                        }
                    });
                }

                // Pre-fill edit inputs
                const dateISO = gradeObj.date;
                const dateYMD = dateISO ? dateISO.substring(0, 10) : "";
                editGradeName.value = gradeObj.name || "";
                editGradeDate.value = dateYMD;
                editGradeComment.value = gradeObj.comment || "";
                
                // Highlight edit mode active chips
                document.querySelectorAll('#edit-grade-chips .chip-btn').forEach(btn => {
                    btn.classList.toggle('active', parseFloat(btn.getAttribute('data-value')) === gradeObj.value);
                });
                document.querySelectorAll('#edit-type-chips .chip-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-value') === gradeObj.type);
                });

                toggleEditMode(false); // Default to view mode
                openModal(gradeDetailsModal);
            }
        }
    }
}

// Subject click delegation
subjectsContainer.addEventListener('click', (e) => {
    // Standard delegation
    handleSubjectInteractionClick(e);
});

// Also bind clicks inside the details modal!
const subjectDetailsModal = document.getElementById('subject-details-modal');
if (subjectDetailsModal) {
    subjectDetailsModal.addEventListener('click', (e) => {
        handleSubjectInteractionClick(e);
    });
}

// Close subject details modal explicit actions
document.getElementById('close-subject-details-modal').addEventListener('click', () => {
    closeModal(subjectDetailsModal);
    activeDetailsSubjectId = null;
});

// Shared helper function for target simulator changes
function handleSubjectInteractionChange(e) {
    const simControl = e.target.closest('.simulator-controls select');
    if (simControl) {
        const card = e.target.closest('.subject-card');
        if (!card) return;
        const subId = card.getAttribute('data-id');
        const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
        const subject = currentSubjects.find(s => s.id === subId);
        if (subject) {
            updateCardSimulatorBadge(card, subject, state.currentSemester);
        }
    }
}

// Listeners for target simulator changes
subjectsContainer.addEventListener('change', handleSubjectInteractionChange);
if (subjectDetailsModal) {
    subjectDetailsModal.addEventListener('change', handleSubjectInteractionChange);
}

// Delete Grade action inside details modal
if (deleteDetailGradeBtn) {
    deleteDetailGradeBtn.addEventListener('click', () => {
        if (selectedSubjectIdForDetails && selectedGradeIdForDetails) {
            const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
            const subject = currentSubjects.find(s => s.id === selectedSubjectIdForDetails);
            if (subject) {
                if (confirm("Supprimer cette note?")) {
                    migrateSubjectGrades(subject);
                    const sem = state.currentSemester;
                    if (sem !== 'annual') {
                        subject.grades[sem] = subject.grades[sem].filter(g => g.id !== selectedGradeIdForDetails);
                        saveState();
                        closeModal(gradeDetailsModal);
                        renderSubjects();
                        updateDashboard();
                    }
                }
            }
        }
    });
}
// Toggle to edit mode on clicking Edit button inside Details Modal
document.getElementById('edit-details-btn').addEventListener('click', () => {
    toggleEditMode(true);
});

// Save edits inside Details Modal
document.getElementById('save-edit-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (!selectedSubjectIdForDetails || !selectedGradeIdForDetails) return;

    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const subject = currentSubjects.find(s => s.id === selectedSubjectIdForDetails);
    if (!subject) return;

    const sem = state.currentSemester;
    if (sem === 'annual') return;

    const name = editGradeName.value.trim() || 'Évaluation';
    const dateVal = editGradeDate.value;
    const commentVal = editGradeComment.value.trim() || null;

    const activeGradeBtn = document.querySelector('#edit-grade-chips .chip-btn.active');
    const activeTypeBtn = document.querySelector('#edit-type-chips .chip-btn.active');
    const value = activeGradeBtn ? parseFloat(activeGradeBtn.getAttribute('data-value')) : 4.0;
    const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-value') : 'TS';

    const proceedSavingEdits = () => {
        const gradeObj = subject.grades[sem].find(g => g.id === selectedGradeIdForDetails);
        if (gradeObj) {
            gradeObj.name = name;
            gradeObj.value = value;
            gradeObj.type = type;
            gradeObj.date = dateVal ? new Date(dateVal).toISOString() : null;
            gradeObj.comment = commentVal;
            
            let photoPromise = Promise.resolve();
            if (editPhotoDeleted) {
                gradeObj.hasPhoto = false;
                photoPromise = deletePhoto(selectedGradeIdForDetails);
            } else if (editUploadedPhotoBase64) {
                gradeObj.hasPhoto = true;
                photoPromise = storePhoto(selectedGradeIdForDetails, editUploadedPhotoBase64);
            }

            photoPromise.finally(() => {
                saveState();
                closeDetailsModalAndReset();
                renderSubjects();
                updateDashboard();
            });
        }
    };

    // OCR mismatch check on edit
    if (editUploadedPhotoBase64 && isEditOcrRunning) {
        if (confirm("L'analyse de l'image est en cours. Voulez-vous enregistrer la note sans vérification ?")) {
            proceedSavingEdits();
        }
    } else if (editUploadedPhotoBase64 && editOcrText) {
        const isMatch = verifyGradeInText(editOcrText, value);
        if (!isMatch) {
            if (confirm(`Alerte : La note modifiée (${value.toFixed(1)}) ne semble pas correspondre à la note détectée sur la photo.\n\nVoulez-vous quand même enregistrer ces modifications?`)) {
                proceedSavingEdits();
            }
        } else {
            proceedSavingEdits();
        }
    } else {
        proceedSavingEdits();
    }
});

// --- Camera Scanner Bindings ---
if (btnStartCamera) {
    btnStartCamera.addEventListener('click', () => {
        stopScanning(false);
        startScanning(cameraStream, cameraScannerView, false);
    });
}
if (btnCloseCamera) {
    btnCloseCamera.addEventListener('click', () => {
        stopScanning(false);
    });
}
if (btnCaptureFrame) {
    btnCaptureFrame.addEventListener('click', () => {
        if (!cameraStream) return;
        const capturedData = captureFrame(cameraStream, false);
        if (capturedData) {
            currentUploadedPhotoBase64 = capturedData;
            document.getElementById('grade-photo-preview').src = capturedData;
            document.getElementById('grade-photo-preview-container').style.display = 'block';
            
            // Trigger OCR immediately
            const ocrStatus = document.getElementById('ocr-loading-status');
            ocrStatus.style.display = 'flex';
            currentOcrText = "";
            isOcrRunning = true;
            
            try {
                if (typeof Tesseract === 'undefined') {
                    throw new Error("Tesseract library is not loaded.");
                }
                Tesseract.recognize(
                    capturedData,
                    'fra+eng',
                    { logger: m => console.log(m) }
                ).then(({ data: { text } }) => {
                    currentOcrText = text;
                    console.log("Add Grade Camera Capture OCR result:", text);
                }).catch(err => {
                    console.error("Add Grade Camera Capture OCR error:", err);
                }).finally(() => {
                    ocrStatus.style.display = 'none';
                    isOcrRunning = false;
                });
            } catch (err) {
                console.warn("OCR failed to initialize:", err);
                ocrStatus.style.display = 'none';
                isOcrRunning = false;
            }
        }
    });
}

// Edit Grade Camera Bindings
if (editBtnStartCamera) {
    editBtnStartCamera.addEventListener('click', () => {
        stopScanning(true);
        startScanning(editCameraStream, editCameraScannerView, true);
    });
}
if (editBtnCloseCamera) {
    editBtnCloseCamera.addEventListener('click', () => {
        stopScanning(true);
    });
}
if (editBtnCaptureFrame) {
    editBtnCaptureFrame.addEventListener('click', () => {
        if (!editCameraStream) return;
        const capturedData = captureFrame(editCameraStream, true);
        if (capturedData) {
            editUploadedPhotoBase64 = capturedData;
            editGradePhotoPreview.src = capturedData;
            editGradePhotoPreviewContainer.style.display = 'block';
            editPhotoDeleted = false;
            
            // Trigger OCR immediately
            const ocrStatus = editOcrLoadingStatus;
            ocrStatus.style.display = 'flex';
            editOcrText = "";
            isEditOcrRunning = true;
            
            try {
                if (typeof Tesseract === 'undefined') {
                    throw new Error("Tesseract library is not loaded.");
                }
                Tesseract.recognize(
                    capturedData,
                    'fra+eng',
                    { logger: m => console.log(m) }
                ).then(({ data: { text } }) => {
                    editOcrText = text;
                    console.log("Edit Grade Camera Capture OCR result:", text);
                }).catch(err => {
                    console.error("Edit Grade Camera Capture OCR error:", err);
                }).finally(() => {
                    ocrStatus.style.display = 'none';
                    isEditOcrRunning = false;
                });
            } catch (err) {
                console.warn("OCR failed to initialize:", err);
                ocrStatus.style.display = 'none';
                isEditOcrRunning = false;
            }
        }
    });
}

// --- Grade Photo Remove Bindings ---
document.getElementById('remove-grade-photo-btn').addEventListener('click', () => {
    document.getElementById('grade-photo-preview').src = "";
    document.getElementById('grade-photo-preview-container').style.display = 'none';
    currentUploadedPhotoBase64 = null;
    currentOcrText = "";
});

document.getElementById('edit-remove-grade-photo-btn').addEventListener('click', () => {
    editGradePhotoPreview.src = "";
    editGradePhotoPreviewContainer.style.display = 'none';
    editUploadedPhotoBase64 = null;
    editOcrText = "";
    editPhotoDeleted = true;
});

// Add Grade form submit - robust try...finally modal closing
document.getElementById('add-grade-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    let value = 4.0;
    try {
        const subId = document.getElementById('grade-subject-id').value;
        const name = document.getElementById('grade-name').value.trim() || 'Évaluation';
        
        const activeGradeBtn = document.querySelector('#grade-chips .chip-btn.active');
        const activeTypeBtn = document.querySelector('#type-chips .chip-btn.active');
        
        value = activeGradeBtn ? parseFloat(activeGradeBtn.getAttribute('data-value')) : 4.0;
        const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-value') : 'TS';

        const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
        const subject = currentSubjects.find(s => s.id === subId);
        if (subject) {
            migrateSubjectGrades(subject);
            const sem = state.currentSemester;
            if (sem === 'annual') return;

            if (subject.role === 'tm') {
                subject.grades.sem1 = [];
                subject.grades.sem2 = [];
            }

            const proceedSaving = () => {
                const dateVal = document.getElementById('grade-date').value;
                const commentVal = document.getElementById('grade-comment').value.trim() || null;
                const gradeId = 'grade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

                const newGrade = {
                    id: gradeId,
                    name,
                    value,
                    type,
                    date: dateVal ? new Date(dateVal).toISOString() : null,
                    comment: commentVal,
                    hasPhoto: !!currentUploadedPhotoBase64
                };

                subject.grades[sem].push(newGrade);

                // If there is a photo, save it to IndexedDB
                const savePromise = currentUploadedPhotoBase64 ? storePhoto(gradeId, currentUploadedPhotoBase64) : Promise.resolve();

                savePromise.finally(() => {
                    saveState();
                    renderSubjects();
                    updateDashboard();

                    // Celebratory effect for perfect grade (=== 6.0) or warning for insufficient grades (< 4.0)
                    if (value === 6.0) {
                        startConfetti();
                        playConfettiSound();
                    } else if (value < 4.0) {
                        playFahSound();
                        if (value < 3.0) {
                            const badGradeMessages = [
                                "t'a revisé ou ...",
                                "bruh",
                                "rappelle toi de ton objective!",
                                "bye."
                            ];
                            const randomMsg = badGradeMessages[Math.floor(Math.random() * badGradeMessages.length)];
                            showSidebarToast(randomMsg);
                        }
                    }

                    // Reset form and variables
                    document.getElementById('add-grade-form').reset();
                    document.getElementById('grade-photo-preview-container').style.display = 'none';
                    currentUploadedPhotoBase64 = null;
                    currentOcrText = "";

                    // Reset active chips to defaults (4.0 and TS)
                    document.querySelectorAll('#grade-chips .chip-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-value') === '4.0');
                    });
                    document.querySelectorAll('#type-chips .chip-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-value') === 'TS');
                    });

                    if (submitBtn) submitBtn.disabled = false;
                    closeModal(addGradeModal);
                });
            };

            // OCR Mismatch Check
            if (currentUploadedPhotoBase64 && isOcrRunning) {
                if (confirm("L'analyse de l'image est en cours. Voulez-vous enregistrer la note sans vérification ?")) {
                    proceedSaving();
                } else {
                    if (submitBtn) submitBtn.disabled = false;
                }
            } else if (currentUploadedPhotoBase64 && currentOcrText) {
                const isMatch = verifyGradeInText(currentOcrText, value);
                if (!isMatch) {
                    if (confirm(`Alerte : La note saisie (${value.toFixed(1)}) ne semble pas correspondre à la note détectée sur la photo.\n\nVoulez-vous quand même enregistrer cette note?`)) {
                        proceedSaving();
                    } else {
                        if (submitBtn) submitBtn.disabled = false;
                    }
                } else {
                    proceedSaving();
                }
            } else {
                proceedSaving();
            }
        } else {
            if (submitBtn) submitBtn.disabled = false;
            closeModal(addGradeModal);
        }
    } catch (err) {
        console.error("Error adding grade:", err);
        if (submitBtn) submitBtn.disabled = false;
        closeModal(addGradeModal);
    }
});

// --- 13. Data Import / Export logic (Removed) ---

// --- 14. App Initializer & View Router ---
const viewLanding = document.getElementById('view-landing');
const viewGuide = document.getElementById('view-guide');
const viewDashboard = document.getElementById('view-dashboard');

function switchView(viewId) {
    // Stop any active camera scanner before leaving views
    stopScanning(false);
    stopScanning(true);
    
    // Hide all top-level page views
    if (viewLanding) viewLanding.style.display = 'none';
    if (viewGuide) viewGuide.style.display = 'none';
    if (viewDashboard) viewDashboard.style.display = 'none';
    
    // Show selected view
    const selectedView = document.getElementById(viewId);
    if (selectedView) {
        if (viewId === 'view-landing' || viewId === 'view-guide') {
            selectedView.style.display = 'flex';
        } else {
            selectedView.style.display = 'block';
        }
    }
    
    // Update top navigation active tabs class
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });
    
    animateCards = true;
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function init() {
    loadState();
    initBackgroundBoxes();
    
    animateCards = true;
    // View Router toggle on startup
    if (state.hasSeenOnboarding) {
        switchView('view-dashboard');
    } else {
        switchView('view-landing');
    }
    
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        themeSelector.value = state.theme || 'navy';
        themeSelector.addEventListener('change', (e) => {
            state.theme = e.target.value;
            saveState();
            applyTheme();
        });
    }
    
    const interfaceSelector = document.getElementById('interface-selector');
    if (interfaceSelector) {
        interfaceSelector.value = state.promoViewMode || 'visual';
        interfaceSelector.addEventListener('change', (e) => {
            state.promoViewMode = e.target.value;
            saveState();
            renderSubjects();
            updateDashboard();
        });
    }
    applyTheme();

    // Set Year selector active button on startup
    document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-year')) === state.currentYear);
    });

    // Set Semester selector active button on startup
    document.querySelectorAll('.semester-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sem') === state.currentSemester);
    });

    updateTabVisibility();
    if (state.currentYear !== 4) {
        renderSubjects();
        updateDashboard();
    }

    // Onboarding Enter App Buttons
    const enterButtons = ['btn-enter-app', 'btn-enter-app-bottom'];
    enterButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                state.hasSeenOnboarding = true;
                saveState();
                switchView('view-dashboard');
            });
        }
    });

    // Bind Top Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            
            // If they click dashboard or guide, they implicitly accept onboarding
            if (targetView === 'view-dashboard' || targetView === 'view-guide') {
                state.hasSeenOnboarding = true;
                saveState();
            }
            switchView(targetView);
        });
    });

    // Brand logo returns to landing page
    const navBrand = document.getElementById('brand-logo-link') || document.querySelector('.top-nav-brand');
    if (navBrand) {
        navBrand.addEventListener('click', () => {
            switchView('view-landing');
        });
    }

    // Custom gemstone delete delegator
    subjectsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-gem')) {
            e.stopPropagation();
            const subId = e.target.getAttribute('data-id');
            const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
            const subject = currentSubjects.find(s => s.id === subId);
            if (subject) {
                if (confirm(`Voulez-vous vraiment supprimer la branche "${subject.name}"?`)) {
                    if (state.currentYear === 3) {
                        state.subjectsYear3 = state.subjectsYear3.filter(s => s.id !== subId);
                    } else if (state.currentYear === 2) {
                        state.subjectsYear2 = state.subjectsYear2.filter(s => s.id !== subId);
                    } else {
                        state.subjectsYear1 = state.subjectsYear1.filter(s => s.id !== subId);
                    }
                    saveState();
                    renderSubjects();
                    updateDashboard();
                }
            }
        }
    });
}

function compressAndResizeImage(dataUrl, maxWidth = 800, maxHeight = 800, quality = 0.75) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

// --- File Upload Fallback Bindings ---
setTimeout(() => {
    const btnUploadFile = document.getElementById('btn-upload-file');
    const gradePhotoFile = document.getElementById('grade-photo-file');
    if (btnUploadFile && gradePhotoFile) {
        btnUploadFile.addEventListener('click', () => gradePhotoFile.click());
        gradePhotoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const compressedDataUrl = await compressAndResizeImage(event.target.result, 800, 800, 0.75);
                currentUploadedPhotoBase64 = compressedDataUrl;
                document.getElementById('grade-photo-preview').src = compressedDataUrl;
                document.getElementById('grade-photo-preview-container').style.display = 'block';
                
                const ocrStatus = document.getElementById('ocr-loading-status');
                if (ocrStatus) ocrStatus.style.display = 'flex';
                currentOcrText = "";
                isOcrRunning = true;
                
                try {
                    Tesseract.recognize(compressedDataUrl, 'fra+eng').then(({ data: { text } }) => {
                        currentOcrText = text;
                        console.log("Add Grade File OCR:", text);
                    }).finally(() => {
                        if (ocrStatus) ocrStatus.style.display = 'none';
                        isOcrRunning = false;
                    });
                } catch(err) {
                    if (ocrStatus) ocrStatus.style.display = 'none';
                    isOcrRunning = false;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const editBtnUploadFile = document.getElementById('edit-btn-upload-file');
    const editGradePhotoFile = document.getElementById('edit-grade-photo-file');
    if (editBtnUploadFile && editGradePhotoFile) {
        editBtnUploadFile.addEventListener('click', () => editGradePhotoFile.click());
        editGradePhotoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const compressedDataUrl = await compressAndResizeImage(event.target.result, 800, 800, 0.75);
                editUploadedPhotoBase64 = compressedDataUrl;
                editGradePhotoPreview.src = compressedDataUrl;
                editGradePhotoPreviewContainer.style.display = 'block';
                editPhotoDeleted = false;
                
                const ocrStatus = editOcrLoadingStatus;
                if (ocrStatus) ocrStatus.style.display = 'flex';
                editOcrText = "";
                isEditOcrRunning = true;
                
                try {
                    Tesseract.recognize(compressedDataUrl, 'fra+eng').then(({ data: { text } }) => {
                        editOcrText = text;
                        console.log("Edit Grade File OCR:", text);
                    }).finally(() => {
                        if (ocrStatus) ocrStatus.style.display = 'none';
                        isOcrRunning = false;
                    });
                } catch(err) {
                    if (ocrStatus) ocrStatus.style.display = 'none';
                    isOcrRunning = false;
                }
            };
            reader.readAsDataURL(file);
        });
    }
}, 500);

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

window.onload = init;
