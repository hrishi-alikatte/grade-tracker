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

/**
 * Calculates subject averages supporting both semesters and annual combinations
 */
function calculateSubjectData(subject, semester) {
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
    { id: 'y3_phys_chimie_y2', name: 'Physique & Chimie (Y2)', role: 'phys_chimie_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } }
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

function loadState() {
    const saved = localStorage.getItem('gymnase_vaud_state_v5');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.studentName) state.studentName = 'Étudiant';
            if (!state.currentYear) state.currentYear = 1;
            if (!state.currentSemester) state.currentSemester = 'sem1';
            
            if (!state.subjectsYear1 || state.subjectsYear1.length === 0) {
                state.subjectsYear1 = JSON.parse(JSON.stringify(defaultSubjectsYear1));
            }
            if (!state.subjectsYear2 || state.subjectsYear2.length === 0) {
                state.subjectsYear2 = JSON.parse(JSON.stringify(defaultSubjectsYear2));
            }
            if (!state.subjectsYear3 || state.subjectsYear3.length === 0) {
                state.subjectsYear3 = JSON.parse(JSON.stringify(defaultSubjectsYear3));
            }
            
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
            const physAvg = formatYear2SubjectAvg('physique');
            const chimAvg = formatYear2SubjectAvg('chimie');
            lanesHTML = `
                <div class="grade-lanes-container" style="grid-template-columns: 1fr 1fr;">
                    <div class="grade-lane">
                        <div class="lane-title">
                            <span>Physique (Y2)</span>
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: white; padding: 0.25rem 0;">
                            ${physAvg}
                        </div>
                    </div>
                    <div class="grade-lane">
                        <div class="lane-title">
                            <span>Chimie (Y2)</span>
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: white; padding: 0.25rem 0;">
                            ${chimAvg}
                        </div>
                    </div>
                </div>
            `;
            footerHTML = `
                <div class="subject-footer">
                    ${targetStatusHTML}
                    <span style="font-size: 0.75rem; color: var(--color-text-secondary); font-style: italic;">Moyennes verrouillées de la 2ème année.</span>
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

            footerHTML = `
                <div class="subject-footer">
                    ${targetStatusHTML}
                    <span style="font-size: 0.75rem; color: var(--color-text-secondary); font-style: italic;">Notes éditables en mode Semestre uniquement.</span>
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
        renderSubjects();
        updateDashboard();
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
                        if (!state.subjectsYear3 || state.subjectsYear3.length === 0) {
                            state.subjectsYear3 = JSON.parse(JSON.stringify(defaultSubjectsYear3));
                        }
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

                    renderSubjects();
                    updateDashboard();
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

    renderSubjects();
    updateDashboard();
}

window.onload = init;
