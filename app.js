/**
 * GradeVibe Vaud - PWA App Logic & Customizations v3
 */

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
    const requiredCompensation = 2 * pointsManquants;
    const isPromoted = activeSubjectsCount > 0 && 
                       overallAverage >= 4.0 && 
                       insuffisances <= 4 && 
                       pointsEnPlus >= requiredCompensation &&
                       pointsManquants <= 3.0 &&
                       coreSumPassed;

    return {
        overallAverage: overallAverage !== null ? Math.round(overallAverage * 100) / 100 : null,
        activeSubjectsCount,
        insuffisances,
        pointsManquants: Math.round(pointsManquants * 100) / 100,
        pointsEnPlus: Math.round(pointsEnPlus * 100) / 100,
        requiredCompensation,
        isPromoted,
        g1Sum,
        coreSumPassed
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
    subjectsYear3: []
};

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
}

function loadState() {
    const saved = localStorage.getItem('gymnase_vaud_state_v5');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.studentName) state.studentName = 'Étudiant';
            if (!state.currentYear) state.currentYear = 1;
            if (!state.currentSemester) state.currentSemester = 'sem1';
            
            runStateMigrations();
            
            state.subjectsYear1.forEach(migrateSubjectGrades);
            state.subjectsYear2.forEach(migrateSubjectGrades);
            state.subjectsYear3.forEach(migrateSubjectGrades);
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
        subjectsYear3: JSON.parse(JSON.stringify(defaultSubjectsYear3))
    };
    saveState();
}

function saveState() {
    localStorage.setItem('gymnase_vaud_state_v5', JSON.stringify(state));
}

// --- 7. DOM Elements ---
const subjectsContainer = document.getElementById('subjects-container');
const promoTitle = document.getElementById('promo-title');
const promoSubtitle = document.getElementById('promo-subtitle');
const promoStatusBadge = document.getElementById('promo-status-badge');

const statInsuffisances = document.getElementById('stat-insuffisances');
const statDeficit = document.getElementById('stat-deficit');
const statSurplus = document.getElementById('stat-surplus');
const statCompensation = document.getElementById('stat-compensation');

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
        promoTitle.textContent = "Aucune note saisie";
        promoSubtitle.textContent = "Saisissez des notes pour voir votre statut de promotion.";
        promoStatusBadge.style.backgroundColor = 'rgba(255,255,255,0.1)';
        promoStatusBadge.style.color = '#fff';
        promoStatusBadge.innerHTML = '<span style="font-size:1.1rem;">⏳</span>';
        
        statInsuffisances.textContent = '0';
        statDeficit.textContent = '0';
        statSurplus.textContent = '0';
        statCompensation.textContent = '0 / 0';
        
        renderEvolutionGraph();
        updateGroupsBilan();
        return;
    }

    // Display counts
    statInsuffisances.textContent = results.insuffisances;
    statDeficit.textContent = results.pointsManquants;
    statSurplus.textContent = results.pointsEnPlus;
    statCompensation.textContent = `${results.pointsEnPlus} / ${results.requiredCompensation}`;

    // Overall Average display
    const roundedOverallAvg = results.overallAverage;
    const branchWord = results.activeSubjectsCount === 1 ? 'branche' : 'branches';
    const periodLabel = state.currentSemester === 'sem1' ? 'du 1er semestre' : state.currentSemester === 'sem2' ? 'du 2ème semestre' : 'annuelle (combinée)';
    promoSubtitle.textContent = `Moyenne générale ${roundedOverallAvg.toFixed(2)} sur ${results.activeSubjectsCount} ${branchWord} ${periodLabel}.`;

    // Status styling
    if (results.isPromoted) {
        promoTitle.textContent = "En route pour réussir l'année 🎉";
        promoStatusBadge.style.backgroundColor = '#10b981'; // Green circle
        promoStatusBadge.style.color = '#fff';
        promoStatusBadge.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else {
        if (!results.coreSumPassed) {
            promoTitle.textContent = "Promotion insuffisante (Groupe 1 < 16 pts) ⚠️";
        } else {
            promoTitle.textContent = "Promotion insuffisante ⚠️";
        }
        promoStatusBadge.style.backgroundColor = '#ef4444'; // Red circle
        promoStatusBadge.style.color = '#fff';
        promoStatusBadge.innerHTML = '<span style="font-size: 1.1rem; font-weight: bold;">!</span>';
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

    g1List.appendChild(createBilanItem('Maths', mathRound));
    g1List.appendChild(createBilanItem('Français', frRound));
    g1List.appendChild(createBilanItem(os ? os.name : 'Option Spécifique (OS)', osRound));
    
    // Core languages name adapts based on L2 setting
    const l2Name = l2 ? l2.name : 'Allemand';
    g1List.appendChild(createBilanItem(`${l2Name} + Anglais ÷ 2`, l2l3AvgRounded));

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
    const promoDashboard = document.getElementById('promo-dashboard');
    const semTabs = document.querySelector('.semester-tabs-container');
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
                    <span>📊 Évolution par Branche</span>
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

function renderMultiSubjectGraph() {
    const wrapper = document.getElementById('multi-subject-graph-wrapper');
    if (!wrapper) return;

    const subjectsToTrack = [
        { label: 'Maths', role: 'math', color: '#ef4444' },
        { label: 'Français', role: 'french', color: '#3b82f6' },
        { label: 'OS', role: 'os', color: '#10b981' },
        { label: 'Anglais', role: 'l3', color: '#f59e0b' },
        { label: 'Langue 2', role: 'l2', color: '#a78bfa' }
    ];

    subjectsToTrack.forEach(track => {
        const foundSub = state.subjectsYear3.find(s => s.role === track.role) ||
                         state.subjectsYear2.find(s => s.role === track.role) ||
                         state.subjectsYear1.find(s => s.role === track.role);
        if (foundSub) {
            track.label = foundSub.name;
        }
    });

    const xCoords = { 1: 100, 2: 300, 3: 500 };
    const mapY = (val) => {
        const clamped = Math.max(1.0, Math.min(6.0, val));
        return 180 - ((clamped - 1.0) / 5.0) * 150;
    };

    const thresholdY = mapY(4.0);

    let pathsHTML = '';
    let markersHTML = '';
    let hasAnyData = false;

    subjectsToTrack.forEach(track => {
        const points = [];
        [1, 2, 3].forEach(y => {
            const avg = getAnnualAverageForSubjectInYear(y, track);
            if (avg !== null && !isNaN(avg)) {
                points.push({ year: y, val: avg, x: xCoords[y], y: mapY(avg) });
                hasAnyData = true;
            }
        });

        if (points.length > 1) {
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            pathsHTML += `<path d="${pathData}" fill="none" stroke="${track.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
        }

        points.forEach(p => {
            markersHTML += `
                <g>
                    <circle cx="${p.x}" cy="${p.y}" r="5" fill="#0f172a" stroke="${track.color}" stroke-width="2" />
                    <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="white">${p.val.toFixed(1)}</text>
                </g>
            `;
        });
    });

    if (!hasAnyData) {
        wrapper.innerHTML = `
            <div class="graph-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary); opacity: 0.4;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <h4>Aucune donnée de moyenne annuelle</h4>
                <p>Saisissez des notes dans les branches principales pour afficher la comparaison.</p>
            </div>
        `;
        return;
    }

    const svgContent = `
        <svg viewBox="0 0 600 220" width="100%" height="220" style="overflow: visible;">
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

            <!-- Tracked paths and circles -->
            ${pathsHTML}
            ${markersHTML}
        </svg>
    `;

    const legendHTML = `
        <div class="chart-legend">
            ${subjectsToTrack.map(track => `
                <div class="legend-item">
                    <span class="legend-pill" style="background-color: ${track.color};"></span>
                    <span>${escapeHTML(track.label)}</span>
                </div>
            `).join('')}
        </div>
    `;

    wrapper.innerHTML = svgContent + legendHTML;
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

function renderSubjects() {
    subjectsContainer.innerHTML = '';
    const currentSubjects = (state.currentYear === 3) ? state.subjectsYear3 : (state.currentYear === 2) ? state.subjectsYear2 : state.subjectsYear1;
    const sem = state.currentSemester;

    currentSubjects.forEach(subject => {
        const data = calculateSubjectData(subject, sem);
        const avgRaw = data.rawAverage;
        const avgRounded = data.roundedAverage;

        // Subject Card container
        const card = document.createElement('div');
        card.className = 'subject-card slide-up';
        card.setAttribute('data-id', subject.id);

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
                targetStatusHTML = '<span class="subject-status">Objectif atteint ✅</span>';
            } else if (avgRounded === 4.0 && subject.target === 4.0) {
                targetStatusHTML = '<span class="subject-status warning">Objectif atteint (limite) ⚠️</span>';
            } else {
                targetStatusHTML = '<span class="subject-status not-reached">Objectif non atteint ❌</span>';
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
                return `
                    <div class="grade-pill ${statusClass}" data-grade-id="${g.id}">
                        <span>${g.value.toFixed(1)}</span>
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
                    <button type="button" class="lang-toggle-btn ${isArts ? 'active' : ''}" data-lang="Arts Visuels">🎨 Arts</button>
                    <button type="button" class="lang-toggle-btn ${isMus ? 'active' : ''}" data-lang="Musique">🎵 Musique</button>
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
            const evoBtnHTML = showEvoBtn ? `<button type="button" class="btn-sub-evo" title="Afficher l'évolution sur 3 ans">📊 Évolution</button>` : '';

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
            const evoBtnHTML = showEvoBtn ? `<button type="button" class="btn-sub-evo" title="Afficher l'évolution sur 3 ans">📊 Évolution</button>` : '';

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
                    ✏️ modifier
                </button>
            `;
        }

        const deleteBtnHTML = (mode === 'locked') ? '' : `<button class="btn-delete-subject" title="Supprimer la branche">&times;</button>`;
        const drawerHTML = (state.currentYear === 3 && sem === 'annual') ? `<div class="sub-evo-drawer"></div>` : '';

        card.innerHTML = `
            ${deleteBtnHTML}
            <div class="subject-header">
                <div class="subject-title-area">
                    <h3 class="subject-name" style="display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap;">
                        ${escapeHTML(subject.name)}
                        ${ocEditHTML}
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

            ${footerHTML}
            ${drawerHTML}
        `;

        subjectsContainer.appendChild(card);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
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

let selectedSubjectIdForDetails = null;
let selectedGradeIdForDetails = null;

function openModal(modal) {
    modal.classList.add('active');
}
function closeModal(modal) {
    modal.classList.remove('active');
}

// Modal headers close actions
document.getElementById('close-subject-modal').addEventListener('click', () => closeModal(addSubjectModal));
document.getElementById('cancel-subject-btn').addEventListener('click', () => closeModal(addSubjectModal));

document.getElementById('close-grade-modal').addEventListener('click', () => closeModal(addGradeModal));
document.getElementById('cancel-grade-btn').addEventListener('click', () => closeModal(addGradeModal));

document.getElementById('close-details-modal').addEventListener('click', () => closeModal(gradeDetailsModal));
document.getElementById('close-details-btn').addEventListener('click', () => closeModal(gradeDetailsModal));

// Header actions
document.getElementById('add-subject-btn').addEventListener('click', () => {
    document.getElementById('add-subject-form').reset();
    openModal(addSubjectModal);
});

// --- 11. Tabs and Selector Bindings ---
document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentYear = parseInt(btn.getAttribute('data-year'));
        saveState();
        updateTabVisibility();
        if (state.currentYear !== 4) {
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
        saveState();
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

// Subject click delegation
subjectsContainer.addEventListener('click', (e) => {
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

    // Toggle L2 Language or Art/Musique inside the card
    const toggleBtn = e.target.closest('.lang-toggle-btn');
    if (toggleBtn) {
        const lang = toggleBtn.getAttribute('data-lang');
        subject.name = lang;
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
                
                const dateStr = gradeObj.date ? new Date(gradeObj.date).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Inconnue';
                detailGradeDate.textContent = dateStr;
                
                openModal(gradeDetailsModal);
            }
        }
    }
});

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

            const newGrade = {
                id: 'grade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name,
                value,
                type,
                date: new Date().toISOString()
            };

            subject.grades[sem].push(newGrade);
            saveState();
            renderSubjects();
            updateDashboard();

            // Celebratory effect for good grades (>= 5.0) or warning for insufficient grades (< 4.0)
            if (value >= 5.0) {
                startConfetti();
                playConfettiSound();
            } else if (value < 4.0) {
                playFahSound();
            }
        }
    } catch (err) {
        console.error("Error adding grade:", err);
    } finally {
        // Guarantee modal close and form state resets
        document.getElementById('add-grade-form').reset();
        
        // Reset active chips to defaults (4.0 and TS)
        document.querySelectorAll('#grade-chips .chip-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-value') === '4.0');
        });
        document.querySelectorAll('#type-chips .chip-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-value') === 'TS');
        });

        if (submitBtn) submitBtn.disabled = false;
        closeModal(addGradeModal);
    }
});

// --- 13. Data Import / Export logic ---
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        
        const timestamp = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("download", `gradevibe_vaud_${timestamp}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });
}

if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed) {
                    if (parsed.subjectsYear1 && parsed.subjectsYear2) {
                        state = parsed;
                    } else if (Array.isArray(parsed.subjects)) {
                        // Upgrade old v4 state to v5
                        state = {
                            studentName: parsed.studentName || 'Étudiant',
                            currentYear: 1,
                            currentSemester: 'sem1',
                            subjectsYear1: parsed.subjects,
                            subjectsYear2: JSON.parse(JSON.stringify(defaultSubjectsYear2)),
                            subjectsYear3: JSON.parse(JSON.stringify(defaultSubjectsYear3))
                        };
                    } else {
                        alert("Format de fichier invalide.");
                        return;
                    }
                    
                    runStateMigrations();
                    
                    state.subjectsYear1.forEach(migrateSubjectGrades);
                    state.subjectsYear2.forEach(migrateSubjectGrades);
                    state.subjectsYear3.forEach(migrateSubjectGrades);
                    
                    saveState();
                    
                    // Sync active UI buttons
                    document.querySelectorAll('#year-selector .lang-toggle-btn').forEach(btn => {
                        btn.classList.toggle('active', parseInt(btn.getAttribute('data-year')) === state.currentYear);
                    });
                    document.querySelectorAll('.semester-tab').forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-sem') === state.currentSemester);
                    });

                    updateTabVisibility();
                    if (state.currentYear !== 4) {
                        renderSubjects();
                        updateDashboard();
                    }
                    alert("Données restaurées avec succès !");
                }
            } catch (err) {
                alert("Erreur lors de la lecture du fichier de sauvegarde.");
                console.error(err);
            }
        };
        reader.readAsText(file);
    });
}

// --- 14. App Initializer ---
function init() {
    loadState();
    
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
}

window.onload = init;
