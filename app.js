/**
 * GradeVibe Vaud - PWA App Logic & Customizations v3
 */

import { state, loadState, saveState, resetStateToDefault, migrateSubjectGrades, getBaseYear, getCurrentSubjects, isCurrentYearLocked } from './src/state/store.js';
import { defaultSubjectsYear1, defaultSubjectsYear2, defaultSubjectsYear3 } from './src/state/defaults.js';
import { storePhoto, getPhoto, deletePhoto } from './src/state/photos.js';
import { applyTheme } from './src/ui/theme.js';
import { escapeHTML } from './src/ui/dom.js';
import { playConfettiSound, playFahSound, showSidebarToast, startConfetti, initBackgroundBoxes } from './src/ui/effects.js';
import { initScrollReveal } from './src/ui/reveal.js';
import { isSupabaseConfigured, signUp, signIn, signOut, getSession, getProfile, updateProfile, onAuthStateChange } from './src/features/auth.js';
import { pullAndMerge, initSyncListeners } from './src/features/sync.js';
import { PRIVACY_TITLE, PRIVACY_HTML, TERMS_TITLE, TERMS_HTML } from './src/features/legal.js';
import { verifyGradeInText, compressAndResizeImage, ensureTesseract } from './src/features/ocr.js';
import { initBackupUI } from './src/features/backup.js';
import './src/features/pwa.js';

// --- OCR and Photo Temporary State ---
let currentUploadedPhotoBase64 = null;
let currentOcrText = "";
let isOcrRunning = false;

let editUploadedPhotoBase64 = null;
let editOcrText = "";
let isEditOcrRunning = false;
let editPhotoDeleted = false;


// --- 4. Swiss Vaud Gymnase Calculations ---
// The math itself now lives in src/logic/calculator.js (pure + unit-tested).
// The wrappers below feed it the current app state so call sites stay unchanged.
import * as calculator from './src/logic/calculator.js';

function calcCtx() {
    return {
        baseYear: getBaseYear(),
        currentYear: state.currentYear,
        subjectsYear2: state.subjectsYear2,
        subjectsYear2Rep: state.subjectsYear2_rep,
        repeatingYear2: !!(state.repeatingYears && state.repeatingYears[2])
    };
}

const roundToHalfPoint = calculator.roundToHalfPoint;
const calculateSubjectDataForSem = calculator.calculateSubjectDataForSem;
const calculateRequiredGrade = calculator.calculateRequiredGrade;
const getStatusClass = calculator.getStatusClass;

function calculateSubjectData(subject, semester) {
    return calculator.calculateSubjectData(subject, semester || state.currentSemester, calcCtx());
}

function checkVaudPromotion(subjects, semester) {
    return calculator.checkVaudPromotion(subjects, semester || state.currentSemester, calcCtx());
}

function getSubjectExamConfig(subject) {
    return calculator.getSubjectExamConfig(subject, calcCtx());
}

function getYear2SubjectAverage(nameSub) {
    return calculator.getYear2SubjectAverage(nameSub, calcCtx());
}

function getYear2ArtAverage() {
    return calculator.getYear2ArtAverage(calcCtx());
}


function formatYear2SubjectAvg(nameSub) {
    if (!state.subjectsYear2) return '—';
    const sub = state.subjectsYear2.find(s => s.name.toLowerCase().includes(nameSub));
    if (!sub) return '—';
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? `${data.roundedAverage.toFixed(1)} (moy: ${data.rawAverage.toFixed(2)})` : '—';
}

function formatYear2ArtAvg() {
    const list = (state.repeatingYears && state.repeatingYears[2]) ? state.subjectsYear2_rep : state.subjectsYear2;
    if (!list) return '—';
    const sub = list.find(s => s.role === 'art');
    if (!sub) return '—';
    const data = calculateSubjectData(sub, 'annual');
    return data.rawAverage !== null ? `${data.roundedAverage.toFixed(1)} (moy: ${data.rawAverage.toFixed(2)})` : '—';
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


// --- 6. UI Render State ---
let activeSubjectFilters = null;
let animateCards = false;

function renderYearSelector() {
    const container = document.getElementById('year-tabs-container');
    if (!container) return;

    let buttonsHTML = '';
    const toggleBtnHTML = state.showAllYears 
        ? `<button type="button" id="btn-toggle-show-all" class="lang-toggle-btn" style="flex: 0 0 auto; min-width: auto; padding: 6px 10px; font-size: 0.75rem; background: rgba(255,255,255,0.05); border: 1px dashed var(--color-border-subtle); color: var(--color-text-secondary); border-radius: var(--radius-sm); margin-left: 0.5rem;" title="Masquer les autres années">− Concentrer</button>`
        : `<button type="button" id="btn-toggle-show-all" class="lang-toggle-btn" style="flex: 0 0 auto; min-width: auto; padding: 6px 10px; font-size: 0.75rem; background: rgba(255,255,255,0.05); border: 1px dashed var(--color-border-subtle); color: var(--color-text-secondary); border-radius: var(--radius-sm); margin-left: 0.5rem;" title="Afficher toutes les années">+ Tout afficher</button>`;

    if (state.showAllYears) {
        // Year 1
        buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 1 ? 'active' : ''}" data-year="1" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">1ère année ${state.currentYear === 1 ? '▴' : ''}</button>`;
        if (state.repeatingYears && state.repeatingYears[1]) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 1.5 ? 'active' : ''}" data-year="1.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">1ère (Rép.) ${state.currentYear === 1.5 ? '▴' : ''}</button>`;
        }
        
        // Year 2
        buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 2 ? 'active' : ''}" data-year="2" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">2ème année ${state.currentYear === 2 ? '▴' : ''}</button>`;
        if (state.repeatingYears && state.repeatingYears[2]) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 2.5 ? 'active' : ''}" data-year="2.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">2ème (Rép.) ${state.currentYear === 2.5 ? '▴' : ''}</button>`;
        }
        
        // Year 3
        buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 3 ? 'active' : ''}" data-year="3" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">3ème année ${state.currentYear === 3 ? '▴' : ''}</button>`;
        if (state.repeatingYears && state.repeatingYears[3]) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 3.5 ? 'active' : ''}" data-year="3.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">3ème (Rép.) ${state.currentYear === 3.5 ? '▴' : ''}</button>`;
        }
        
        // Year 4 / Evolution
        buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 4 ? 'active' : ''}" data-year="4" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">Évolution</button>`;
    } else {
        const baseYear = Math.floor(state.currentYear);
        if (baseYear === 1) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 1 ? 'active' : ''}" data-year="1" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">1ère année ▾</button>`;
            if (state.repeatingYears && state.repeatingYears[1]) {
                buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 1.5 ? 'active' : ''}" data-year="1.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">1ère (Rép.) ▾</button>`;
            }
        } else if (baseYear === 2) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 2 ? 'active' : ''}" data-year="2" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">2ème année ▾</button>`;
            if (state.repeatingYears && state.repeatingYears[2]) {
                buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 2.5 ? 'active' : ''}" data-year="2.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">2ème (Rép.) ▾</button>`;
            }
        } else if (baseYear === 3) {
            buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 3 ? 'active' : ''}" data-year="3" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">3ème année ▾</button>`;
            if (state.repeatingYears && state.repeatingYears[3]) {
                buttonsHTML += `<button type="button" class="lang-toggle-btn ${state.currentYear === 3.5 ? 'active' : ''}" data-year="3.5" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">3ème (Rép.) ▾</button>`;
            }
        } else {
            buttonsHTML += `<button type="button" class="lang-toggle-btn active" data-year="4" style="flex: 1; text-align: center; font-size: 0.8rem; padding: 6px 4px;">Évolution</button>`;
        }
    }

    // When collapsed to a single year, keep the pill compact and centred
    // instead of stretching into a heavy full-width bar.
    const containerStyle = state.showAllYears
        ? 'margin: 0; padding: 4px; width: 100%; display: flex; max-width: 650px; justify-content: space-between; gap: 4px; align-items: center;'
        : 'margin: 0 auto; padding: 4px; width: fit-content; display: inline-flex; justify-content: center; gap: 6px; align-items: center;';
    container.innerHTML = `
        <div class="lang-toggle-container" style="${containerStyle}">
            ${buttonsHTML}
            ${toggleBtnHTML}
        </div>
    `;

    // Rebind event listeners to the new buttons
    container.querySelectorAll('.lang-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.id === 'btn-toggle-show-all') {
                state.showAllYears = !state.showAllYears;
                saveState();
                renderYearSelector();
                return;
            }

            const rawYear = btn.getAttribute('data-year');
            const targetYear = rawYear.includes('.') ? parseFloat(rawYear) : parseInt(rawYear);
            
            // If they click on the tab they ALREADY have active:
            if (state.currentYear === targetYear) {
                // Toggle showAllYears!
                state.showAllYears = !state.showAllYears;
                saveState();
                renderYearSelector();
                return;
            }

            container.querySelectorAll('.lang-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            state.currentYear = targetYear;

            closeModal(document.getElementById('subject-details-modal'));
            activeDetailsSubjectId = null;

            updateTabVisibility();

            // Instant swap — no card-slide/fade replay; persist after paint.
            if (state.currentYear !== 4) {
                renderSubjects();
                updateDashboard();
            } else {
                renderDedicatedEvolutionSlide();
            }
            requestAnimationFrame(saveState);
        });
    });
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
    const currentSubjects = getCurrentSubjects();
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
        if (getBaseYear() === 3) {
            promoSubtitle.textContent = `Félicitations, vous remplissez toutes les conditions de promotion avec une moyenne générale arithmétique de ${results.overallAverage.toFixed(2)} (${periodLabel}) !`;
        } else {
            promoSubtitle.textContent = `Félicitations, vous remplissez toutes les conditions de promotion (${periodLabel}) !`;
        }
    } else {
        if (promoDashboard) promoDashboard.className = 'promo-dashboard-container status-failing';
        promoTitle.textContent = "Promotion insuffisante";
        
        const reasons = [];
        if (results.g2Sum < results.g2Min) {
            const diff = (results.g2Min - results.g2Sum).toFixed(1);
            if (getBaseYear() === 3) {
                reasons.push(`Votre moyenne générale arithmétique (${results.overallAverage.toFixed(2)}) est inférieure à 4.0 (il vous manque ${diff} point(s) pour atteindre les ${results.g2Min.toFixed(1)} points requis dans le Groupe 2)`);
            } else {
                reasons.push(`Il vous manque ${diff} point(s) pour atteindre les ${results.g2Min.toFixed(1)} points requis dans le Groupe 2 (toutes les disciplines)`);
            }
        }
        if (!results.coreSumPassed) {
            const diff = (16.0 - results.g1Sum).toFixed(1);
            reasons.push(`Il vous manque ${diff} point(s) pour atteindre les 16.0 points requis dans le Groupe 1 (disciplines fondamentales)`);
        }
        if (results.insuffisances > 4) {
            reasons.push(`Vous avez ${results.insuffisances} branches insuffisantes (maximum 4 autorisées)`);
        }
        if (getBaseYear() === 3) {
            if (results.pointsManquants > 3.0) {
                const diff = (results.pointsManquants - 3.0).toFixed(1);
                reasons.push(`Votre déficit total de branches insuffisantes (${results.pointsManquants.toFixed(1)}) dépasse de ${diff} point(s) la limite autorisée (3.0)`);
            }
            if (results.pointsEnPlus < results.requiredCompensation) {
                const diff = (results.requiredCompensation - results.pointsEnPlus).toFixed(1);
                reasons.push(`Il vous manque ${diff} point(s) de compensation (le surplus au-dessus de 4.0 doit combler le double du déficit)`);
            }
        }
        
        if (reasons.length > 0) {
            promoSubtitle.innerHTML = `<ul style="margin: 0.5rem auto 0 auto; display: inline-flex; flex-direction: column; gap: 0.35rem; list-style-type: disc; text-align: left; max-width: max-content; padding-left: 1.25rem;">
                ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>`;
        } else {
            promoSubtitle.textContent = "";
        }
    }

    // Update Bilan lists
    updateGroupsBilan();
    renderEvolutionGraph();
}

function updateGroupsBilan() {
    g1List.innerHTML = '';
    g2List.innerHTML = '';

    const currentSubjects = getCurrentSubjects();
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
            if (val > 4.0) color = 'var(--color-passing-bg)';
            else if (val === 4.0) color = 'var(--color-warning-bg)';
            else color = 'var(--color-failing-bg)';
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

function getAnnualAverageForSubjectInYearKey(yearKey, refSubject) {
    let list = [];
    if (yearKey === 1) list = state.subjectsYear1;
    else if (yearKey === 1.5) list = state.subjectsYear1_rep;
    else if (yearKey === 2) list = state.subjectsYear2;
    else if (yearKey === 2.5) list = state.subjectsYear2_rep;
    else if (yearKey === 3) list = state.subjectsYear3;
    else if (yearKey === 3.5) list = state.subjectsYear3_rep;

    if (yearKey === 3 || yearKey === 3.5) {
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
    const timelineKeys = [];
    timelineKeys.push({ keyVal: 1, label: state.repeatingYears && state.repeatingYears[1] ? "1.1" : "1ère" });
    if (state.repeatingYears && state.repeatingYears[1]) timelineKeys.push({ keyVal: 1.5, label: "Rép." });
    timelineKeys.push({ keyVal: 2, label: state.repeatingYears && state.repeatingYears[2] ? "2.1" : "2ème" });
    if (state.repeatingYears && state.repeatingYears[2]) timelineKeys.push({ keyVal: 2.5, label: "Rép." });
    timelineKeys.push({ keyVal: 3, label: state.repeatingYears && state.repeatingYears[3] ? "3.1" : "3ème" });
    if (state.repeatingYears && state.repeatingYears[3]) timelineKeys.push({ keyVal: 3.5, label: "Rép." });

    const totalSteps = timelineKeys.length;
    const startX = 60;
    const endX = 300;
    
    const xCoords = {};
    timelineKeys.forEach((item, index) => {
        xCoords[item.keyVal] = totalSteps > 1 
            ? startX + (index / (totalSteps - 1)) * (endX - startX)
            : 180;
    });

    const points = [];
    timelineKeys.forEach(tk => {
        const avg = getAnnualAverageForSubjectInYearKey(tk.keyVal, subject);
        if (avg !== null && !isNaN(avg)) {
            const svgY = 85 - (avg - 1.0) * (70 / 5.0);
            points.push({ year: tk.keyVal, avg: avg, x: xCoords[tk.keyVal], y: svgY, label: tk.label });
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
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--color-bg-surface)" stroke="var(--color-primary)" stroke-width="2" />
        <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="var(--color-text-primary)" stroke="var(--color-bg-surface)" stroke-width="3" paint-order="stroke fill">${p.avg.toFixed(1)}</text>
    `).join('');

    const thresholdY = 85 - (4.0 - 1.0) * (70 / 5.0); // 43

    let gridLinesHTML = '';
    let xAxisLabelsHTML = '';
    points.forEach(pt => {
        gridLinesHTML += `<line x1="${pt.x}" y1="15" x2="${pt.x}" y2="85" stroke="rgba(0,0,0,0.05)" stroke-width="1" />`;
        xAxisLabelsHTML += `<text x="${pt.x}" y="98" font-size="8" fill="var(--color-text-muted)" text-anchor="middle">${pt.label}</text>`;
    });

    drawer.innerHTML = `
        <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
            <span>Évolution de ${escapeHTML(subject.name)}</span>
            <span style="font-weight: normal; font-size: 0.75rem; color: var(--color-text-muted);">Seuil de promotion: 4.0</span>
        </div>
        <div style="background: rgba(0,0,0,0.03); border-radius: var(--radius-md); padding: 0.5rem; display: flex; justify-content: center;">
            <svg viewBox="0 0 360 100" width="100%" height="100" style="max-width: 360px; overflow: visible;">
                <!-- Promotion Threshold Line -->
                <line class="promo-limit-line" x1="20" y1="${thresholdY}" x2="340" y2="${thresholdY}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.8" />
                <text class="promo-limit-text" x="15" y="${thresholdY + 3}" font-size="8" fill="#ef4444" font-weight="bold" text-anchor="end">4.0</text>
                
                <!-- X-Axis Labels -->
                ${xAxisLabelsHTML}
 
                <!-- Grid lines for years -->
                ${gridLinesHTML}

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

    // Show/hide Examens tab based on current active year
    const tabExams = document.getElementById('tab-exams');
    if (tabExams) {
        const isYear3 = (getBaseYear() === 3);
        tabExams.style.display = isYear3 ? 'inline-block' : 'none';
        if (!isYear3 && state.currentSemester === 'exams') {
            state.currentSemester = 'annual';
            document.querySelectorAll('.semester-tab').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-sem') === 'annual');
            });
            saveState();
        }
    }

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

function triggerInstantTransition() {
    const targets = document.querySelectorAll('#promo-dashboard, .subjects-section, .bilan-section');
    targets.forEach(t => {
        t.classList.remove('view-fade-in');
        // Force reflow
        void t.offsetWidth;
        t.classList.add('view-fade-in');
    });
}

// Aggregate the year-over-year analytics that power the Evolution KPI cards.
function computeEvolutionKPIs() {
    const years = [
        { key: 1, label: '1ère année', subjects: state.subjectsYear1 },
        { key: 2, label: '2ème année', subjects: state.subjectsYear2 },
        { key: 3, label: '3ème année', subjects: state.subjectsYear3 },
    ];
    const series = years.map(y => {
        const res = checkVaudPromotion(y.subjects, 'annual');
        return {
            label: y.label,
            subjects: y.subjects,
            avg: res.activeSubjectsCount > 0 ? res.overallAverage : null,
            isPromoted: res.isPromoted,
        };
    }).filter(y => y.avg !== null);

    if (series.length === 0) return null;

    const current = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const trend = previous ? (current.avg - previous.avg) : null;

    let best = null, weakest = null;
    current.subjects.forEach(sub => {
        const data = calculateSubjectData(sub, 'annual');
        const avg = data.rawAverage;
        if (avg === null || isNaN(avg)) return;
        if (!best || avg > best.avg) best = { label: sub.name, avg };
        if (!weakest || avg < weakest.avg) weakest = { label: sub.name, avg };
    });

    return { current, previous, trend, best, weakest, series };
}

function buildEvolutionKPIsHTML() {
    const k = computeEvolutionKPIs();
    if (!k) {
        return `
            <div class="evo-kpi-empty">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                <div>
                    <strong>Vos statistiques apparaîtront ici</strong>
                    <span>Saisissez des notes annuelles pour suivre votre progression sur 3 ans.</span>
                </div>
            </div>`;
    }
    const fmt = (v) => v.toFixed(2);
    const promoted = k.current.isPromoted;
    const trendCard = k.trend === null
        ? `<span class="evo-kpi-sub">Première année enregistrée</span>`
        : `<span class="evo-kpi-trend ${k.trend >= 0 ? 'up' : 'down'}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${k.trend >= 0 ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>'}</svg>
               ${k.trend >= 0 ? '+' : ''}${k.trend.toFixed(2)} <span class="evo-kpi-sub">vs an préc.</span>
           </span>`;

    return `
        <div class="evo-kpi-grid">
            <div class="evo-kpi-card">
                <span class="evo-kpi-label">Moyenne générale</span>
                <span class="evo-kpi-value">${fmt(k.current.avg)}</span>
                ${trendCard}
            </div>
            <div class="evo-kpi-card evo-kpi-status ${promoted ? 'ok' : 'warn'}">
                <span class="evo-kpi-label">Statut de promotion</span>
                <span class="evo-kpi-status-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${promoted ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>'}</svg>
                    ${promoted ? 'En bonne voie' : 'À surveiller'}
                </span>
                <span class="evo-kpi-sub">${k.current.label}</span>
            </div>
            <div class="evo-kpi-card">
                <span class="evo-kpi-label">Meilleure branche</span>
                <span class="evo-kpi-value-sm">${k.best ? escapeHTML(k.best.label) : '—'}</span>
                <span class="evo-kpi-sub">${k.best ? 'Moyenne ' + fmt(k.best.avg) : ''}</span>
            </div>
            <div class="evo-kpi-card">
                <span class="evo-kpi-label">Branche à surveiller</span>
                <span class="evo-kpi-value-sm">${k.weakest ? escapeHTML(k.weakest.label) : '—'}</span>
                <span class="evo-kpi-sub">${k.weakest ? 'Moyenne ' + fmt(k.weakest.avg) : ''}</span>
            </div>
        </div>`;
}

function renderDedicatedEvolutionSlide() {
    const container = document.getElementById('evolution-slide-container');
    if (!container) return;

    container.innerHTML = `
        <div class="evo-header">
            <h2 class="evo-title">Évolution</h2>
            <p class="evo-subtitle">Vos moyennes et leur progression sur les trois années du gymnase.</p>
        </div>

        ${buildEvolutionKPIsHTML()}

        <!-- Overall Average Trend Card -->
        <div class="subject-card evo-chart-card">
            <div class="evo-chart-head">
                <h3 class="evo-chart-title">Évolution générale</h3>
                <span class="evo-chart-caption">Moyenne annuelle générale sur 3 ans</span>
            </div>
            <div id="evolution-graph-wrapper" class="evo-graph-wrapper">
                <!-- Dynamically rendered -->
            </div>
        </div>

        <!-- Multi-Subject Comparison Card -->
        <div id="multi-subject-card" class="subject-card evo-chart-card">
            <div class="evo-chart-head">
                <div class="evo-chart-head-main">
                    <h3 class="evo-chart-title">Évolution par branche</h3>
                    <button type="button" id="btn-maximize-multi-graph" class="btn btn-secondary evo-maximize-btn" title="Agrandir / Plein écran">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        <span>Agrandir</span>
                    </button>
                </div>
                <span class="evo-chart-caption">Comparez la trajectoire de chaque branche</span>
            </div>
            <div id="multi-subject-graph-wrapper" class="evo-graph-wrapper" style="min-height: 250px;">
                <!-- Dynamically rendered -->
            </div>
        </div>
    `;

    renderEvolutionGraph();
    renderMultiSubjectGraph();

    const maxBtn = document.getElementById('btn-maximize-multi-graph');
    const backdrop = document.getElementById('graph-maximize-backdrop');
    
    const reduceGraph = () => {
        const card = document.getElementById('multi-subject-card');
        if (card) {
            card.classList.remove('is-maximized');
            if (backdrop) backdrop.classList.remove('active');
            if (maxBtn) maxBtn.style.display = 'inline-flex';
            renderMultiSubjectGraph();
        }
    };

    if (maxBtn) {
        maxBtn.addEventListener('click', () => {
            const card = document.getElementById('multi-subject-card');
            if (card) {
                card.classList.add('is-maximized');
                if (backdrop) backdrop.classList.add('active');
                maxBtn.style.display = 'none';
                renderMultiSubjectGraph();
            }
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', reduceGraph);
    }
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

    const isLightTheme = document.body.classList.contains('theme-light');
    const subjectColors = isLightTheme ? [
        '#b91c1c', // Crimson Red
        '#1d4ed8', // Royal Blue
        '#047857', // Forest Green
        '#b45309', // Dark Amber
        '#7e22ce', // Purple
        '#0f766e', // Dark Teal
        '#be185d', // Pink
        '#c2410c', // Dark Orange
        '#4338ca', // Indigo
        '#9f1239', // Rose
        '#1e3a8a', // Navy
        '#451a03', // Brown
        '#065f46'  // Emerald
    ] : [
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

    const card = document.getElementById('multi-subject-card');
    const isMax = card && card.classList.contains('is-maximized');
    
    const svgWidth = isMax ? 800 : 600;
    const svgHeight = isMax ? 400 : 220;
    
    const timelineKeys = [];
    timelineKeys.push({ keyVal: 1, label: state.repeatingYears && state.repeatingYears[1] ? "1.1" : "1ère année" });
    if (state.repeatingYears && state.repeatingYears[1]) timelineKeys.push({ keyVal: 1.5, label: "1ère (Rép.)" });
    timelineKeys.push({ keyVal: 2, label: state.repeatingYears && state.repeatingYears[2] ? "2.1" : "2ème année" });
    if (state.repeatingYears && state.repeatingYears[2]) timelineKeys.push({ keyVal: 2.5, label: "2ème (Rép.)" });
    timelineKeys.push({ keyVal: 3, label: state.repeatingYears && state.repeatingYears[3] ? "3.1" : "3ème année" });
    if (state.repeatingYears && state.repeatingYears[3]) timelineKeys.push({ keyVal: 3.5, label: "3ème (Rép.)" });

    const totalSteps = timelineKeys.length;
    const startX = isMax ? 100 : 80;
    const endX = isMax ? svgWidth - 100 : svgWidth - 80;
    
    const xCoords = {};
    timelineKeys.forEach((item, index) => {
        xCoords[item.keyVal] = totalSteps > 1 
            ? startX + (index / (totalSteps - 1)) * (endX - startX)
            : svgWidth / 2;
    });
        
    const mapY = (val) => {
        const clamped = Math.max(1.0, Math.min(6.0, val));
        const chartTop = 30;
        const chartBottom = svgHeight - 40;
        const chartHeight = chartBottom - chartTop;
        return chartBottom - ((clamped - 1.0) / 5.0) * chartHeight;
    };

    const thresholdY = mapY(4.0);

    let graphGroupsHTML = '';
    let hasAnyDataToPlot = false;

    allSubjects.forEach(sub => {
        if (!activeSubjectFilters.has(sub.key)) return;

        const points = [];
        timelineKeys.forEach(tk => {
            const avg = getAnnualAverageForSubjectInYearKey(tk.keyVal, sub);
            if (avg !== null && !isNaN(avg)) {
                points.push({ year: tk.keyVal, val: avg, x: xCoords[tk.keyVal], y: mapY(avg) });
                hasAnyDataToPlot = true;
            }
        });

        if (points.length === 0) return;

        let pathHTML = '';
        if (points.length > 1) {
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            pathHTML = `
                <path d="${pathData}" fill="none" stroke="${sub.color}" stroke-width="${isMax ? '3.5' : '2.5'}" stroke-linecap="round" stroke-linejoin="round" />
                <path class="graph-hover-helper" d="${pathData}" fill="none" stroke="transparent" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer;" />
            `;
        }

        let markersHTML = points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="${isMax ? '7' : '5'}" fill="var(--color-bg-surface)" stroke="${sub.color}" stroke-width="2" />
            <text class="node-text" x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="${isMax ? '11' : '9.5'}" font-weight="bold" fill="var(--color-text-primary)" stroke="var(--color-bg-surface)" stroke-width="3" paint-order="stroke fill">${p.val.toFixed(1)}</text>
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
            <svg id="multi-subject-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="${svgHeight}" style="overflow: visible; cursor: crosshair;">
                <!-- Grid horizontal lines -->
                <line x1="50" y1="${mapY(6.0)}" x2="${svgWidth - 50}" y2="${mapY(6.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(5.0)}" x2="${svgWidth - 50}" y2="${mapY(5.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(3.0)}" x2="${svgWidth - 50}" y2="${mapY(3.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                <line x1="50" y1="${mapY(2.0)}" x2="${svgWidth - 50}" y2="${mapY(2.0)}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

                <!-- Promotion Limit Line (4.0) -->
                <line class="promo-limit-line" x1="50" y1="${thresholdY}" x2="${svgWidth - 50}" y2="${thresholdY}" stroke="#ef4444" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.8"/>
                <text class="promo-limit-text" x="${svgWidth - 45}" y="${thresholdY + 3}" fill="#ef4444" font-family="var(--font-family-sans)" font-size="10" font-weight="700">4.0</text>

                <!-- X-Axis Labels -->
                ${timelineKeys.map(tk => `
                    <text x="${xCoords[tk.keyVal]}" y="${svgHeight - 8}" font-size="11" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">${tk.label}</text>
                `).join('')}

                <!-- Vertical grid lines -->
                ${timelineKeys.map(tk => `
                    <line x1="${xCoords[tk.keyVal]}" y1="20" x2="${xCoords[tk.keyVal]}" y2="${svgHeight - 30}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                `).join('')}

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

    const timeline = [];
    
    // Y1 attempt 1
    const resultsY1 = checkVaudPromotion(state.subjectsYear1, 'annual');
    const avgY1 = resultsY1.activeSubjectsCount > 0 ? resultsY1.overallAverage : null;
    if (avgY1 !== null) {
        timeline.push({ val: avgY1, label: state.repeatingYears && state.repeatingYears[1] ? "1ère (1.1)" : "1ère année" });
    }
    // Y1 repeated
    if (state.repeatingYears && state.repeatingYears[1]) {
        const resultsY1Rep = checkVaudPromotion(state.subjectsYear1_rep, 'annual');
        const avgY1Rep = resultsY1Rep.activeSubjectsCount > 0 ? resultsY1Rep.overallAverage : null;
        if (avgY1Rep !== null) {
            timeline.push({ val: avgY1Rep, label: "1ère (Rép.)" });
        }
    }

    // Y2 attempt 1
    const resultsY2 = checkVaudPromotion(state.subjectsYear2, 'annual');
    const avgY2 = resultsY2.activeSubjectsCount > 0 ? resultsY2.overallAverage : null;
    if (avgY2 !== null) {
        timeline.push({ val: avgY2, label: state.repeatingYears && state.repeatingYears[2] ? "2ème (2.1)" : "2ème année" });
    }
    // Y2 repeated
    if (state.repeatingYears && state.repeatingYears[2]) {
        const resultsY2Rep = checkVaudPromotion(state.subjectsYear2_rep, 'annual');
        const avgY2Rep = resultsY2Rep.activeSubjectsCount > 0 ? resultsY2Rep.overallAverage : null;
        if (avgY2Rep !== null) {
            timeline.push({ val: avgY2Rep, label: "2ème (Rép.)" });
        }
    }

    // Y3 attempt 1
    const resultsY3 = checkVaudPromotion(state.subjectsYear3, 'annual');
    const avgY3 = resultsY3.activeSubjectsCount > 0 ? resultsY3.overallAverage : null;
    if (avgY3 !== null) {
        timeline.push({ val: avgY3, label: state.repeatingYears && state.repeatingYears[3] ? "3ème (3.1)" : "3ème année" });
    }
    // Y3 repeated
    if (state.repeatingYears && state.repeatingYears[3]) {
        const resultsY3Rep = checkVaudPromotion(state.subjectsYear3_rep, 'annual');
        const avgY3Rep = resultsY3Rep.activeSubjectsCount > 0 ? resultsY3Rep.overallAverage : null;
        if (avgY3Rep !== null) {
            timeline.push({ val: avgY3Rep, label: "3ème (Rép.)" });
        }
    }

    const points = [];
    const count = timeline.length;
    const startX = 80;
    const endX = 520;
    timeline.forEach((item, index) => {
        const x = count > 1 
            ? startX + (index / (count - 1)) * (endX - startX) 
            : 300;
        points.push({ x: x, val: item.val, label: item.label });
    });

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
                        <text class="node-text" x="${pt.x}" y="${pt.y - 12}" fill="var(--color-text-primary)" stroke="var(--color-bg-surface)" stroke-width="3" paint-order="stroke fill" font-family="var(--font-family-sans)" font-size="11" font-weight="800" text-anchor="middle">
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
        const showEvoBtn = (getBaseYear() === 3 && sem === 'annual');
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
        const avgAnn = data.annualRoundedAverage !== undefined ? data.annualRoundedAverage : data.roundedAverage;
        const avgMaturity = data.roundedAverage;

        const getCompareValClass = (val) => {
            if (val === null || val === undefined) return 'empty';
            if (val < 4.0) return 'failing';
            if (val === 4.0) return 'warning';
            return 'passing';
        };

        const formatVal = (val) => (val !== null && val !== undefined) ? val.toFixed(1) : '—';

        const examConfig = getSubjectExamConfig(subject);

        if (examConfig) {
            lanesHTML = `
                <div class="annual-comparison-grid" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.25rem 0;">
                    <!-- Semester averages row -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; border-bottom: 1px dashed var(--color-border-subtle); padding-bottom: 0.5rem;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: 500;">Semestre 1</span>
                            <span class="comparison-col-val ${getCompareValClass(avgSem1)}" style="font-size: 0.9rem; font-weight: 700;">${formatVal(avgSem1)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: 500;">Semestre 2</span>
                            <span class="comparison-col-val ${getCompareValClass(avgSem2)}" style="font-size: 0.9rem; font-weight: 700;">${formatVal(avgSem2)}</span>
                        </div>
                    </div>
                    
                    <!-- Annual average and exam inputs row -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; align-items: stretch;">
                        <!-- Left Column: Averages -->
                        <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 0.4rem; background: rgba(96, 165, 250, 0.04); border: 1px solid rgba(96, 165, 250, 0.12); padding: 0.5rem 0.6rem; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.7rem; color: var(--color-text-secondary); font-weight: 600;">Sans exam :</span>
                                <span class="comparison-col-val ${getCompareValClass(avgAnn)}" style="font-size: 0.9rem; font-weight: 700;">${formatVal(avgAnn)}</span>
                            </div>
                            <div style="border-top: 1px dashed rgba(96, 165, 250, 0.15); margin: 0.15rem 0; padding-top: 0.25rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.7rem; color: var(--color-primary); font-weight: 700;">Avec exam :</span>
                                <span class="comparison-col-val ${getCompareValClass(avgMaturity)}" style="font-size: 1.05rem; font-weight: 900;">${formatVal(avgMaturity)}</span>
                            </div>
                        </div>
                        
                        <!-- Right Column: Exam inputs -->
                        <div style="display: flex; flex-direction: column; justify-content: center; gap: 0.35rem; border: 1px solid var(--color-border-subtle); padding: 0.5rem 0.6rem; border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.01);">
                            ${examConfig.written ? `
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.25rem;">
                                <span style="font-size: 0.7rem; color: var(--color-text-primary); font-weight: 600;">Écrit :</span>
                                <input type="number" step="0.5" min="1" max="6" inputmode="decimal" enterkeyhint="done" class="exam-input-field" data-subject-id="${subject.id}" data-exam-type="written" value="${subject.exams && subject.exams.written !== null ? subject.exams.written : ''}" placeholder="—">
                            </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.25rem;">
                                <span style="font-size: 0.7rem; color: var(--color-text-primary); font-weight: 600;">Oral :</span>
                                <input type="number" step="0.5" min="1" max="6" inputmode="decimal" enterkeyhint="done" class="exam-input-field" data-subject-id="${subject.id}" data-exam-type="oral" value="${subject.exams && subject.exams.oral !== null ? subject.exams.oral : ''}" placeholder="—">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
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
        }

        const showEvoBtn = (getBaseYear() === 3);
        const evoBtnHTML = showEvoBtn ? `<button type="button" class="btn-sub-evo" title="Afficher l'évolution sur 3 ans">Évolution</button>` : '';

        footerHTML = `
            <div class="subject-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                ${targetStatusHTML}
                ${evoBtnHTML}
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary); font-style: italic; margin-top: 0.5rem;">
                ${examConfig ? 'Examens de maturité modifiables directement ci-dessus.' : 'Notes éditables en mode Semestre uniquement.'}
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

        const addGradeBtnHTML = isCurrentYearLocked() ? '' : `
            <button class="btn btn-secondary add-grade-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: var(--radius-full);">
                + Ajouter une note
            </button>
        `;

        footerHTML = `
            <div class="subject-footer">
                ${targetStatusHTML}
                ${addGradeBtnHTML}
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
    const drawerHTML = (getBaseYear() === 3 && sem === 'annual') ? `<div class="sub-evo-drawer"></div>` : '';

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
    
    // Hide or show custom subject addition button based on locked status
    const addSubBtn = document.getElementById('add-subject-btn');
    if (addSubBtn) {
        addSubBtn.style.display = isCurrentYearLocked() ? 'none' : 'inline-flex';
    }
    
    if (isCurrentYearLocked()) {
        const lockBanner = document.createElement('div');
        lockBanner.className = 'lock-banner';
        lockBanner.style.padding = '0.75rem 1rem';
        lockBanner.style.marginBottom = '1.25rem';
        lockBanner.style.background = 'rgba(239, 68, 68, 0.08)';
        lockBanner.style.border = '1px solid rgba(239, 68, 68, 0.2)';
        lockBanner.style.borderRadius = 'var(--radius-md)';
        lockBanner.style.color = '#ef4444';
        lockBanner.style.fontSize = '0.8rem';
        lockBanner.style.fontWeight = '600';
        lockBanner.style.display = 'flex';
        lockBanner.style.alignItems = 'center';
        lockBanner.style.gap = '0.5rem';
        lockBanner.style.width = '100%';
        lockBanner.style.gridColumn = '1 / -1'; // Span across all columns in grid layouts
        lockBanner.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Cette tentative est verrouillée car le redoublement est actif. Pour modifier ces notes, décochez l'option de redoublement dans l'onglet Annuel.</span>
        `;
        subjectsContainer.appendChild(lockBanner);
    }

    const currentSubjects = getCurrentSubjects();
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

        // Append gemstone repeating year box
        if (sem === 'annual') {
            const baseYear = getBaseYear();
            const firstAttemptSubjects = baseYear === 3 ? state.subjectsYear3 : baseYear === 2 ? state.subjectsYear2 : state.subjectsYear1;
            const firstAttemptPromo = checkVaudPromotion(firstAttemptSubjects, 'annual');
            const isFirstAttemptPassing = firstAttemptPromo.isPromoted;
            const repeatingActive = state.repeatingYears && state.repeatingYears[baseYear];
            const isRepeatDisabled = isFirstAttemptPassing && !repeatingActive;

            const repeatItem = document.createElement('div');
            repeatItem.className = 'gem-item';
            if (isRepeatDisabled) {
                repeatItem.style.opacity = '0.5';
                repeatItem.style.cursor = 'not-allowed';
            }

            repeatItem.innerHTML = `
                <div class="gem-sphere gem-repeat-status" style="background-color: var(--color-bg-elevated); display: flex; align-items: center; justify-content: center; border: 1px dashed var(--color-border-subtle); ${isRepeatDisabled ? 'cursor: not-allowed;' : 'cursor: pointer;'}" ${isRepeatDisabled ? '' : 'onclick="document.getElementById(\'chk-repeat-year-gem\')?.click();"'}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </div>
                <div class="gem-sphere-shadow"></div>
                <div class="gem-subject-name" style="margin-top: 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary);">Redoublement</div>
                    <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem;">
                        ${isRepeatDisabled ? `
                            <span style="font-size: 0.7rem; color: var(--color-text-muted); font-weight: 600; text-align: center;">Réussite active</span>
                        ` : `
                            <input type="checkbox" id="chk-repeat-year-gem" style="cursor: pointer; width: 14px; height: 14px;" ${repeatingActive ? 'checked' : ''}>
                            <label for="chk-repeat-year-gem" style="cursor: pointer; font-weight: 600; color: var(--color-text-secondary);">Redoubler</label>
                        `}
                    </div>
                </div>
            `;
            subjectsContainer.appendChild(repeatItem);
        }

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

        // Append Repeating status card
        if (sem === 'annual') {
            const baseYear = getBaseYear();
            const firstAttemptSubjects = baseYear === 3 ? state.subjectsYear3 : baseYear === 2 ? state.subjectsYear2 : state.subjectsYear1;
            const firstAttemptPromo = checkVaudPromotion(firstAttemptSubjects, 'annual');
            const isFirstAttemptPassing = firstAttemptPromo.isPromoted;
            const repeatingActive = state.repeatingYears && state.repeatingYears[baseYear];
            const isRepeatDisabled = isFirstAttemptPassing && !repeatingActive;

            const repeatCard = document.createElement('div');
            repeatCard.className = animateCards ? 'subject-card slide-up repeating-card' : 'subject-card repeating-card';
            repeatCard.style.padding = '1.5rem';
            repeatCard.style.display = 'flex';
            repeatCard.style.flexDirection = 'column';
            repeatCard.style.gap = '0.75rem';
            repeatCard.style.border = '1px dashed var(--color-border-subtle)';
            repeatCard.style.justifyContent = 'center';
            repeatCard.style.background = 'rgba(0,0,0,0.01)';
            if (isRepeatDisabled) {
                repeatCard.style.opacity = '0.65';
            }
            
            let repeatControlHTML = '';
            if (isRepeatDisabled) {
                repeatControlHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                        <input type="checkbox" id="chk-repeat-year" style="cursor: not-allowed; width: 16px; height: 16px;" disabled>
                        <label style="font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); cursor: not-allowed; display: flex; flex-direction: column; gap: 0.15rem;">
                            <span>Redoubler l'année (verrouillé)</span>
                            <span style="font-size: 0.72rem; font-weight: 500; color: var(--color-primary);">Cette option est désactivée car vous réussissez actuellement cette tentative.</span>
                        </label>
                    </div>
                `;
            } else {
                repeatControlHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                        <input type="checkbox" id="chk-repeat-year" style="cursor: pointer; width: 16px; height: 16px;" ${repeatingActive ? 'checked' : ''}>
                        <label for="chk-repeat-year" style="font-size: 0.85rem; font-weight: 600; cursor: pointer; color: var(--color-text-primary);">Redoubler l'année</label>
                    </div>
                `;
            }

            repeatCard.innerHTML = `
                <h3 style="font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-primary); margin: 0;">
                    <span>Statut de Redoublement</span>
                </h3>
                <p style="font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4; margin: 0;">
                    Si vous redoublez cette année, activez cette option pour configurer une deuxième tentative de cette même année.
                </p>
                ${repeatControlHTML}
            `;
            subjectsContainer.appendChild(repeatCard);
        }
    }
    animateCards = false;

    // Bind repeating year checkbox events
    const chkGrid = document.getElementById('chk-repeat-year');
    if (chkGrid) {
        chkGrid.addEventListener('change', (e) => {
            const baseYear = getBaseYear();
            const isChecked = e.target.checked;
            state.repeatingYears[baseYear] = isChecked;
            
            if (isChecked) {
                const key = 'subjectsYear' + baseYear + '_rep';
                if (!state[key]) {
                    const defaults = baseYear === 1 ? defaultSubjectsYear1 : baseYear === 2 ? defaultSubjectsYear2 : defaultSubjectsYear3;
                    state[key] = JSON.parse(JSON.stringify(defaults));
                }
            }
            
            saveState();
            renderYearSelector();
            renderSubjects();
            updateDashboard();
        });
    }

    const chkGem = document.getElementById('chk-repeat-year-gem');
    if (chkGem) {
        chkGem.addEventListener('change', (e) => {
            const baseYear = getBaseYear();
            const isChecked = e.target.checked;
            state.repeatingYears[baseYear] = isChecked;
            
            if (isChecked) {
                const key = 'subjectsYear' + baseYear + '_rep';
                if (!state[key]) {
                    const defaults = baseYear === 1 ? defaultSubjectsYear1 : baseYear === 2 ? defaultSubjectsYear2 : defaultSubjectsYear3;
                    state[key] = JSON.parse(JSON.stringify(defaults));
                }
            }
            
            saveState();
            renderYearSelector();
            renderSubjects();
            updateDashboard();
        });
    }
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
                const currentSubjects = getCurrentSubjects();
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
    // Lock the page behind the modal so touch scrolling doesn't bleed through.
    document.body.classList.add('modal-open');
    // On pointer devices, focus the first field for immediate typing. Skipped
    // on touch so the on-screen keyboard doesn't jump the layout on open.
    if (window.matchMedia('(hover: hover)').matches) {
        const firstField = modal.querySelector('input:not([type=hidden]):not([type=file]), select, textarea');
        if (firstField) requestAnimationFrame(() => firstField.focus());
    }
}
function closeModal(modal) {
    modal.classList.remove('active');
    // Release the scroll lock only once no modal remains open.
    if (!document.querySelector('.modal-backdrop.active')) {
        document.body.classList.remove('modal-open');
    }
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

// Dismiss a modal appropriately (the details modal must also stop the camera).
function dismissModal(backdrop) {
    if (backdrop.id === 'grade-details-modal') {
        closeDetailsModalAndReset();
    } else {
        closeModal(backdrop);
    }
}

// Tap-outside-to-close + Escape-to-close for all standard modals. The
// onboarding modal is intentionally excluded (setup should be completed, not
// dismissed by an accidental tap). The graph overlay keeps its own handler.
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    if (backdrop.id === 'onboarding-setup-modal') return;
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) dismissModal(backdrop);
    });
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal-backdrop.active');
    if (open && open.id !== 'onboarding-setup-modal') dismissModal(open);
});

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
document.querySelectorAll('.semester-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetSem = btn.getAttribute('data-sem');
        if (state.currentSemester === targetSem) return;

        document.querySelectorAll('.semester-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentSemester = targetSem;

        // Close details modal on semester switch
        closeModal(document.getElementById('subject-details-modal'));
        activeDetailsSubjectId = null;

        // Instant swap: render synchronously with no card-slide/fade replay so
        // the switch feels zero-latency. Persist after paint (non-blocking).
        renderSubjects();
        updateDashboard();
        requestAnimationFrame(saveState);
    });
});

// --- 12. Grade slider (1.0–6.0, 0.5 steps) + type chip bindings ---
function initGradeSlider(wrap) {
    if (!wrap) return;
    const track = wrap.querySelector('.grade-slider-track');
    const rail = wrap.querySelector('.grade-slider-rail');
    const valueEl = wrap.querySelector('.gs-value');
    const ticksEl = wrap.querySelector('.grade-slider-ticks');
    const scaleEl = wrap.querySelector('.grade-slider-scale');
    const MIN = 1, MAX = 6, STEP = 0.5, STEPS = (MAX - MIN) / STEP; // 10 intervals, 11 stops

    // Build the 11 ticks + integer scale labels (1..6) once.
    if (ticksEl && !ticksEl.childElementCount) {
        for (let i = 0; i <= STEPS; i++) ticksEl.appendChild(document.createElement('span'));
    }
    if (scaleEl && !scaleEl.childElementCount) {
        for (let n = MIN; n <= MAX; n++) {
            const s = document.createElement('span');
            s.textContent = n;
            scaleEl.appendChild(s);
        }
    }

    // Snap to the nearest 0.5 stop and paint instantly (0 latency).
    function setValue(v) {
        const idx = Math.max(0, Math.min(STEPS, Math.round((v - MIN) / STEP)));
        const val = MIN + idx * STEP;
        wrap.style.setProperty('--gs-pct', (idx / STEPS * 100) + '%');
        if (valueEl) valueEl.textContent = val.toFixed(1);
        wrap.dataset.value = val;
        track.setAttribute('aria-valuenow', val);
        track.setAttribute('aria-valuetext', val.toFixed(1));
    }
    wrap._setValue = setValue;

    function valueFromClientX(clientX) {
        const r = rail.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        return MIN + Math.round(ratio * STEPS) * STEP;
    }

    let dragging = false;
    track.addEventListener('pointerdown', (e) => {
        dragging = true;
        track.classList.add('gs-grabbing');
        wrap.classList.add('gs-active');
        try { track.setPointerCapture(e.pointerId); } catch (_) {}
        setValue(valueFromClientX(e.clientX));
        e.preventDefault();
    });
    track.addEventListener('pointermove', (e) => {
        if (dragging) setValue(valueFromClientX(e.clientX));
    });
    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('gs-grabbing');
        wrap.classList.remove('gs-active');
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // Trackpad / mouse wheel nudges by one step.
    track.addEventListener('wheel', (e) => {
        e.preventDefault();
        const dir = (e.deltaY || e.deltaX) > 0 ? -STEP : STEP;
        setValue(parseFloat(wrap.dataset.value) + dir);
    }, { passive: false });

    // Keyboard.
    track.addEventListener('keydown', (e) => {
        const cur = parseFloat(wrap.dataset.value);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setValue(cur - STEP); e.preventDefault(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setValue(cur + STEP); e.preventDefault(); }
        else if (e.key === 'Home') { setValue(MIN); e.preventDefault(); }
        else if (e.key === 'End') { setValue(MAX); e.preventDefault(); }
    });

    setValue(parseFloat(wrap.dataset.value || '4'));
}

const gradeSliderAdd = document.getElementById('grade-slider');
const gradeSliderEdit = document.getElementById('edit-grade-slider');
initGradeSlider(gradeSliderAdd);
initGradeSlider(gradeSliderEdit);

// Optional-details disclosure (date / commentaire / photo) in the add-grade modal.
const gradeExtras = document.getElementById('grade-extras');
const gradeExtrasToggle = document.getElementById('grade-extras-toggle');
function setGradeExtras(open) {
    if (!gradeExtras || !gradeExtrasToggle) return;
    if (open) gradeExtras.removeAttribute('hidden');
    else gradeExtras.setAttribute('hidden', '');
    gradeExtrasToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
if (gradeExtrasToggle) {
    gradeExtrasToggle.addEventListener('click', () => setGradeExtras(gradeExtras.hasAttribute('hidden')));
}

document.querySelectorAll('#type-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#type-chips .chip-btn').forEach(b => b.classList.remove('active'));
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

    const cy = state.currentYear;
    if (cy === 3) state.subjectsYear3.push(newSub);
    else if (cy === 3.5) state.subjectsYear3_rep.push(newSub);
    else if (cy === 2) state.subjectsYear2.push(newSub);
    else if (cy === 2.5) state.subjectsYear2_rep.push(newSub);
    else if (cy === 1) state.subjectsYear1.push(newSub);
    else if (cy === 1.5) state.subjectsYear1_rep.push(newSub);
    
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
    const currentSubjects = getCurrentSubjects();
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
            // '' reverts to the CSS (inline flex layout); 'none' hides it.
            typeGroup.style.display = mode === 'standard' ? 'none' : '';
        }

        // Reset the grade slider to 4.0 and collapse the optional extras.
        if (gradeSliderAdd && gradeSliderAdd._setValue) gradeSliderAdd._setValue(4);
        setGradeExtras(false);

        openModal(addGradeModal);
    }

    // Delete branch
    if (e.target.classList.contains('btn-delete-subject')) {
        if (confirm(`Voulez-vous vraiment supprimer la branche "${subject.name}"?`)) {
            const cy = state.currentYear;
            if (cy === 3) state.subjectsYear3 = state.subjectsYear3.filter(s => s.id !== subId);
            else if (cy === 3.5) state.subjectsYear3_rep = state.subjectsYear3_rep.filter(s => s.id !== subId);
            else if (cy === 2) state.subjectsYear2 = state.subjectsYear2.filter(s => s.id !== subId);
            else if (cy === 2.5) state.subjectsYear2_rep = state.subjectsYear2_rep.filter(s => s.id !== subId);
            else if (cy === 1) state.subjectsYear1 = state.subjectsYear1.filter(s => s.id !== subId);
            else if (cy === 1.5) state.subjectsYear1_rep = state.subjectsYear1_rep.filter(s => s.id !== subId);
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
            state.subjectsYear1_rep.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear2.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear2_rep.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear3.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            state.subjectsYear3_rep.forEach(s => { if (s.role === 'os') s.name = nameVal; });
            
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
        if (subject.role === 'art' && getBaseYear() === 2) {
            const y3List = (state.repeatingYears && state.repeatingYears[3]) ? state.subjectsYear3_rep : state.subjectsYear3;
            const y3Art = y3List ? y3List.find(s => s.role === 'art_y2') : null;
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
                
                // Set the edit slider to this grade's value
                if (gradeSliderEdit && gradeSliderEdit._setValue) gradeSliderEdit._setValue(gradeObj.value);
                document.querySelectorAll('#edit-type-chips .chip-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-value') === gradeObj.type);
                });

                toggleEditMode(false); // Default to view mode
                
                const editBtn = document.getElementById('edit-details-btn');
                if (editBtn) {
                    editBtn.style.display = isCurrentYearLocked() ? 'none' : 'inline-block';
                }
                const delBtn = document.getElementById('delete-detail-grade-btn');
                if (delBtn) {
                    delBtn.style.display = isCurrentYearLocked() ? 'none' : 'inline-block';
                }
                
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
        const currentSubjects = getCurrentSubjects();
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
        if (isCurrentYearLocked()) {
            alert("Cette tentative est verrouillée.");
            return;
        }
        if (selectedSubjectIdForDetails && selectedGradeIdForDetails) {
            const currentSubjects = getCurrentSubjects();
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
    if (isCurrentYearLocked()) {
        alert("Cette tentative est verrouillée.");
        return;
    }
    if (!selectedSubjectIdForDetails || !selectedGradeIdForDetails) return;

    const currentSubjects = getCurrentSubjects();
    const subject = currentSubjects.find(s => s.id === selectedSubjectIdForDetails);
    if (!subject) return;

    const sem = state.currentSemester;
    if (sem === 'annual') return;

    const name = editGradeName.value.trim() || 'Évaluation';
    const dateVal = editGradeDate.value;
    const commentVal = editGradeComment.value.trim() || null;

    const activeTypeBtn = document.querySelector('#edit-type-chips .chip-btn.active');
    const value = gradeSliderEdit ? parseFloat(gradeSliderEdit.dataset.value) : 4.0;
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
            
            ensureTesseract()
                .then(() => Tesseract.recognize(
                    capturedData,
                    'fra+eng',
                    { logger: m => console.log(m) }
                ))
                .then(({ data: { text } }) => {
                    currentOcrText = text;
                    console.log("Add Grade Camera Capture OCR result:", text);
                }).catch(err => {
                    console.error("Add Grade Camera Capture OCR error:", err);
                }).finally(() => {
                    ocrStatus.style.display = 'none';
                    isOcrRunning = false;
                });
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
            
            ensureTesseract()
                .then(() => Tesseract.recognize(
                    capturedData,
                    'fra+eng',
                    { logger: m => console.log(m) }
                ))
                .then(({ data: { text } }) => {
                    editOcrText = text;
                    console.log("Edit Grade Camera Capture OCR result:", text);
                }).catch(err => {
                    console.error("Edit Grade Camera Capture OCR error:", err);
                }).finally(() => {
                    ocrStatus.style.display = 'none';
                    isEditOcrRunning = false;
                });
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
    if (isCurrentYearLocked()) {
        alert("Cette tentative est verrouillée.");
        closeModal(addGradeModal);
        return;
    }
    if (submitBtn) submitBtn.disabled = true;

    let value = 4.0;
    try {
        const subId = document.getElementById('grade-subject-id').value;
        const name = document.getElementById('grade-name').value.trim() || 'Évaluation';
        
        const activeTypeBtn = document.querySelector('#type-chips .chip-btn.active');

        value = gradeSliderAdd ? parseFloat(gradeSliderAdd.dataset.value) : 4.0;
        const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-value') : 'TS';

        const currentSubjects = getCurrentSubjects();
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

    // Arm scroll-reveal the first time the landing page becomes visible
    // (IntersectionObserver needs the elements laid out, not display:none).
    if (viewId === 'view-landing') {
        requestAnimationFrame(() => initScrollReveal());
    }
    
    // Update top navigation active tabs class
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });
    
    animateCards = true;
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
}

// Traduit les messages d'erreur Supabase Auth (anglais) en français.
function translateAuthError(msg) {
    if (!msg) return 'Une erreur est survenue.';
    const m = String(msg).toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
    if (m.includes('email not confirmed')) return "Confirmez votre adresse e-mail avant de vous connecter.";
    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) return 'Cette adresse e-mail est déjà utilisée.';
    if (m.includes('password') && m.includes('short')) return 'Mot de passe trop court (6 caractères minimum).';
    if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    if (m.includes('network') || m.includes('fetch')) return 'Problème de connexion réseau.';
    return 'Une erreur est survenue. Réessayez.';
}

// Documents légaux : ouvre la modale avec le bon contenu. Câblé sur les liens
// du pied de page ET sur la case de consentement du formulaire d'inscription.
function wireLegal() {
    const legalModal = document.getElementById('legal-modal');
    const legalTitle = document.getElementById('legal-modal-title');
    const legalBody = document.getElementById('legal-modal-body');
    if (!legalModal) return;

    const openLegal = (kind) => {
        const isPrivacy = kind === 'privacy';
        legalTitle.textContent = isPrivacy ? PRIVACY_TITLE : TERMS_TITLE;
        legalBody.innerHTML = isPrivacy ? PRIVACY_HTML : TERMS_HTML;
        legalBody.scrollTop = 0;
        openModal(legalModal);
    };

    const bind = (id, kind) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.preventDefault(); openLegal(kind); });
    };
    bind('footer-link-privacy', 'privacy');
    bind('footer-link-terms', 'terms');
    bind('link-privacy', 'privacy');
    bind('link-terms', 'terms');

    const closeBtn = document.getElementById('close-legal-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(legalModal));
}

// Câble l'UI de compte (Connexion / Inscription / Profil) + la synchro cloud.
// Si Supabase n'est pas configuré, ne fait rien : l'app reste 100% locale.
function initAuth() {
    const accountBtn = document.getElementById('btn-account');
    if (!isSupabaseConfigured) {
        if (accountBtn) accountBtn.style.display = 'none';
        return;
    }
    if (accountBtn) accountBtn.style.display = 'inline-flex';

    initSyncListeners();

    const authModal = document.getElementById('auth-modal');
    const profileModal = document.getElementById('profile-modal');
    const authMessage = document.getElementById('auth-message');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabSignup = document.getElementById('auth-tab-signup');
    const authTitle = document.getElementById('auth-modal-title');

    let currentSession = null;

    const reloadUI = () => {
        renderYearSelector();
        if (state.currentYear !== 4) {
            renderSubjects();
            updateDashboard();
        }
        applyTheme();
    };

    function showAuthMessage(text, kind) {
        authMessage.textContent = text;
        authMessage.style.display = 'block';
        authMessage.style.color = kind === 'error' ? '#c0392b' : '#2b6747';
    }
    function clearAuthMessage() {
        authMessage.style.display = 'none';
        authMessage.textContent = '';
    }

    function setMode(mode) {
        const login = mode === 'login';
        tabLogin.classList.toggle('active', login);
        tabSignup.classList.toggle('active', !login);
        loginForm.style.display = login ? 'block' : 'none';
        signupForm.style.display = login ? 'none' : 'block';
        authTitle.textContent = login ? 'Connexion' : 'Inscription';
        clearAuthMessage();
    }
    tabLogin.addEventListener('click', () => setMode('login'));
    tabSignup.addEventListener('click', () => setMode('signup'));

    accountBtn.addEventListener('click', () => {
        if (currentSession) {
            openProfile();
        } else {
            setMode('login');
            openModal(authModal);
        }
    });

    document.getElementById('close-auth-modal').addEventListener('click', () => closeModal(authModal));
    document.getElementById('close-profile-modal').addEventListener('click', () => closeModal(profileModal));

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessage();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
            const { error } = await signIn({ email, password });
            if (error) {
                showAuthMessage(translateAuthError(error.message), 'error');
            } else {
                closeModal(authModal);
                showSidebarToast('Connexion réussie.', 'success');
            }
        } catch (err) {
            showAuthMessage(translateAuthError(err.message), 'error');
        } finally {
            btn.disabled = false;
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthMessage();
        const prenom = document.getElementById('signup-prenom').value.trim();
        const nom = document.getElementById('signup-nom').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const btn = signupForm.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
            const { error } = await signUp({ email, password, nom, prenom });
            if (error) {
                showAuthMessage(translateAuthError(error.message), 'error');
            } else {
                showAuthMessage("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.", 'success');
                signupForm.reset();
            }
        } catch (err) {
            showAuthMessage(translateAuthError(err.message), 'error');
        } finally {
            btn.disabled = false;
        }
    });

    async function openProfile() {
        const profile = await getProfile();
        const email = (profile && profile.email)
            || (currentSession && currentSession.user && currentSession.user.email) || '';
        document.getElementById('profile-prenom').value = (profile && profile.prenom) || '';
        document.getElementById('profile-nom').value = (profile && profile.nom) || '';
        document.getElementById('profile-email').value = email;
        document.getElementById('profile-canton').value = (profile && profile.canton) || '';
        document.getElementById('profile-ecole').value = (profile && profile.nom_ecole) || '';
        document.getElementById('profile-telephone').value = (profile && profile.telephone) || '';
        document.getElementById('profile-naissance').value = (profile && profile.date_naissance) || '';
        openModal(profileModal);
    }

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('profile-message');
        const fields = {
            canton: document.getElementById('profile-canton').value.trim() || null,
            nom_ecole: document.getElementById('profile-ecole').value.trim() || null,
            telephone: document.getElementById('profile-telephone').value.trim() || null,
            date_naissance: document.getElementById('profile-naissance').value || null,
        };
        msg.style.display = 'block';
        try {
            const { error } = await updateProfile(fields);
            if (error) {
                msg.textContent = "Échec de l'enregistrement.";
                msg.style.color = '#c0392b';
            } else {
                msg.textContent = 'Profil enregistré.';
                msg.style.color = '#2b6747';
            }
        } catch (err) {
            msg.textContent = translateAuthError(err.message);
            msg.style.color = '#c0392b';
        }
    });

    document.getElementById('btn-signout').addEventListener('click', async () => {
        await signOut();
        closeModal(profileModal);
        showSidebarToast('Vous êtes déconnecté.', 'success');
    });

    const applySession = (session, doMerge) => {
        currentSession = session;
        accountBtn.title = session ? 'Mon profil' : 'Connexion';
        if (session && doMerge) {
            pullAndMerge({ onReplaced: reloadUI });
        }
    };

    onAuthStateChange((session) => applySession(session, true));
    getSession().then((session) => applySession(session, true));
}

function init() {
    loadState();
    initBackgroundBoxes();
    initBackupUI();
    wireLegal();
    initAuth();
    
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

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            state.isLightTheme = (state.isLightTheme === false) ? true : false;
            saveState();
            applyTheme();
            
            // Redraw graphs so theme-dependent variables (like colors, strokes) take effect
            renderEvolutionGraph();
            renderMultiSubjectGraph();
        });
    }

    // Render and initialize year selector tabs dynamically on startup
    renderYearSelector();

    // Set Semester selector active button on startup
    document.querySelectorAll('.semester-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sem') === state.currentSemester);
    });

    updateTabVisibility();
    if (state.currentYear !== 4) {
        renderSubjects();
        updateDashboard();
    }

    // Onboarding Enter App Buttons (opens customization settings)
    const enterButtons = ['btn-enter-app', 'btn-enter-app-bottom'];
    enterButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const onboardingModal = document.getElementById('onboarding-setup-modal');
                const onboardingTitle = onboardingModal.querySelector('.modal-title');
                const onboardingForm = document.getElementById('onboarding-setup-form');
                const onboardingSubmitBtn = onboardingForm.querySelector('button[type="submit"]');
                
                // Customize modal labels for Setup mode
                onboardingTitle.textContent = "Personnalisez votre espace";
                onboardingSubmitBtn.textContent = "C'est parti !";
                
                // Pre-fill inputs with current state
                const currentBaseYear = Math.floor(state.currentYear);
                onboardingYearBtns.forEach(btn => {
                    const yearVal = parseInt(btn.getAttribute('data-year'));
                    btn.classList.toggle('active', yearVal === currentBaseYear);
                });
                document.getElementById('onboarding-is-repeating').checked = !!state.repeatingYears[currentBaseYear];
                document.getElementById('onboarding-show-all-years').checked = state.showAllYears !== false;
                
                const isLight = state.isLightTheme !== false;
                const obLightBtn = document.getElementById('onboarding-theme-light');
                const obDarkBtn = document.getElementById('onboarding-theme-dark');
                if (obLightBtn && obDarkBtn) {
                    obLightBtn.classList.toggle('active', isLight);
                    obDarkBtn.classList.toggle('active', !isLight);
                }
                const colorThemeGroup = document.getElementById('onboarding-color-theme-group');
                if (colorThemeGroup) {
                    colorThemeGroup.style.display = isLight ? 'none' : 'block';
                }
                
                openModal(onboardingModal);
            });
        }
    });

    // Onboarding modal year selection toggle buttons
    const onboardingYearBtns = document.querySelectorAll('.onboarding-year-btn');
    onboardingYearBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            onboardingYearBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // If year 3 is selected, default to showing other years. Otherwise, only show selected year.
            const selectedYear = parseInt(btn.getAttribute('data-year'));
            const showAllCheckbox = document.getElementById('onboarding-show-all-years');
            if (showAllCheckbox) {
                showAllCheckbox.checked = (selectedYear === 3);
            }
        });
    });

    // Onboarding theme mode buttons listener
    const onboardingThemeLightBtn = document.getElementById('onboarding-theme-light');
    const onboardingThemeDarkBtn = document.getElementById('onboarding-theme-dark');
    const colorThemeGroup = document.getElementById('onboarding-color-theme-group');

    if (onboardingThemeLightBtn && onboardingThemeDarkBtn) {
        onboardingThemeLightBtn.addEventListener('click', () => {
            onboardingThemeLightBtn.classList.add('active');
            onboardingThemeDarkBtn.classList.remove('active');
            if (colorThemeGroup) colorThemeGroup.style.display = 'none';
        });
        
        onboardingThemeDarkBtn.addEventListener('click', () => {
            onboardingThemeDarkBtn.classList.add('active');
            onboardingThemeLightBtn.classList.remove('active');
            if (colorThemeGroup) colorThemeGroup.style.display = 'block';
        });
    }

    // Close onboarding modal button
    const closeOnboardingBtn = document.getElementById('close-onboarding-setup-modal');
    if (closeOnboardingBtn) {
        closeOnboardingBtn.addEventListener('click', () => {
            closeModal(document.getElementById('onboarding-setup-modal'));
        });
    }

    // Submit onboarding/settings form
    const onboardingForm = document.getElementById('onboarding-setup-form');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const activeYearBtn = document.querySelector('.onboarding-year-btn.active');
            const selectedYear = activeYearBtn ? parseInt(activeYearBtn.getAttribute('data-year')) : (Math.floor(state.currentYear) || 1);
            
            const isRepeatingInput = document.getElementById('onboarding-is-repeating');
            const isRepeating = isRepeatingInput ? isRepeatingInput.checked : false;
            
            const showAllInput = document.getElementById('onboarding-show-all-years');
            const showAll = showAllInput ? showAllInput.checked : true;
            
            state.currentYear = isRepeating ? selectedYear + 0.5 : selectedYear;
            state.repeatingYears[selectedYear] = isRepeating;
            state.showAllYears = showAll;
            state.currentSemester = 'annual';
            state.hasSeenOnboarding = true;

            const obLightBtn = document.getElementById('onboarding-theme-light');
            const isLightActive = obLightBtn ? obLightBtn.classList.contains('active') : true;
            state.isLightTheme = isLightActive;
            
            if (!isLightActive) {
                const themeSelector = document.getElementById('theme-selector');
                if (themeSelector) state.theme = themeSelector.value;
            }
            
            saveState();
            applyTheme();
            
            // Sync active semester tab UI state
            document.querySelectorAll('.semester-tab').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-sem') === 'annual');
            });
            
            // Re-render dashboard
            renderYearSelector();
            renderSubjects();
            updateDashboard();
            updateTabVisibility();
            
            closeModal(document.getElementById('onboarding-setup-modal'));
            switchView('view-dashboard');
        });
    }

    // Open/Close settings from Navbar Settings Button
    const settingsBtn = document.getElementById('btn-settings-modal');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const onboardingModal = document.getElementById('onboarding-setup-modal');
            if (!onboardingModal) return;
            
            const onboardingTitle = onboardingModal.querySelector('.modal-title');
            const onboardingFormEl = document.getElementById('onboarding-setup-form');
            if (!onboardingFormEl) return;
            
            const onboardingSubmitBtn = onboardingFormEl.querySelector('button[type="submit"]');
            
            // Populate current preferences
            const currentBaseYear = Math.floor(state.currentYear) || 1;
            const onboardingYearBtnsLocal = document.querySelectorAll('.onboarding-year-btn');
            onboardingYearBtnsLocal.forEach(btn => {
                const yearVal = parseInt(btn.getAttribute('data-year'));
                btn.classList.toggle('active', yearVal === currentBaseYear);
            });
            
            const repeatInput = document.getElementById('onboarding-is-repeating');
            if (repeatInput) repeatInput.checked = !!state.repeatingYears[currentBaseYear];
            
            const showAllInput = document.getElementById('onboarding-show-all-years');
            if (showAllInput) showAllInput.checked = state.showAllYears !== false;

            const isLight = state.isLightTheme !== false;
            const obLightBtn = document.getElementById('onboarding-theme-light');
            const obDarkBtn = document.getElementById('onboarding-theme-dark');
            if (obLightBtn && obDarkBtn) {
                obLightBtn.classList.toggle('active', isLight);
                obDarkBtn.classList.toggle('active', !isLight);
            }
            const colorThemeGroup = document.getElementById('onboarding-color-theme-group');
            if (colorThemeGroup) {
                colorThemeGroup.style.display = isLight ? 'none' : 'block';
            }
            
            // Customize modal labels for Settings mode
            if (onboardingTitle) onboardingTitle.textContent = "Paramètres d'affichage";
            if (onboardingSubmitBtn) onboardingSubmitBtn.textContent = "Enregistrer";
            
            openModal(onboardingModal);
        });
    }

    // Bind Top Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            
            // If they click dashboard or guide, they implicitly accept onboarding
            if (targetView === 'view-dashboard' || targetView === 'view-guide') {
                if (!state.hasSeenOnboarding) {
                    state.showAllYears = (Math.floor(state.currentYear) === 3);
                }
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
            const currentSubjects = getCurrentSubjects();
            const subject = currentSubjects.find(s => s.id === subId);
            if (subject) {
                if (confirm(`Voulez-vous vraiment supprimer la branche "${subject.name}"?`)) {
                    const cy = state.currentYear;
                    if (cy === 3) state.subjectsYear3 = state.subjectsYear3.filter(s => s.id !== subId);
                    else if (cy === 3.5) state.subjectsYear3_rep = state.subjectsYear3_rep.filter(s => s.id !== subId);
                    else if (cy === 2) state.subjectsYear2 = state.subjectsYear2.filter(s => s.id !== subId);
                    else if (cy === 2.5) state.subjectsYear2_rep = state.subjectsYear2_rep.filter(s => s.id !== subId);
                    else if (cy === 1) state.subjectsYear1 = state.subjectsYear1.filter(s => s.id !== subId);
                    else if (cy === 1.5) state.subjectsYear1_rep = state.subjectsYear1_rep.filter(s => s.id !== subId);
                    saveState();
                    renderSubjects();
                    updateDashboard();
                }
            }
        }
    });

    // Listen for changes in exam input fields
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('exam-input-field')) {
            const subId = e.target.getAttribute('data-subject-id');
            const examType = e.target.getAttribute('data-exam-type'); // 'written' or 'oral'
            let rawVal = e.target.value.trim().replace(',', '.');
            let val = parseFloat(rawVal);
            if (isNaN(val) || val < 1.0 || val > 6.0) {
                val = null;
                e.target.value = '';
            } else {
                val = Math.round(val * 10) / 10;
                e.target.value = val.toFixed(1);
            }

            const currentSubjects = getCurrentSubjects();
            const subject = currentSubjects.find(s => s.id === subId);
            if (subject) {
                if (!subject.exams) {
                    subject.exams = { written: null, oral: null };
                }
                subject.exams[examType] = val;
                saveState();
                
                // Re-render subjects and update dashboard
                renderSubjects();
                updateDashboard();
            }
        }
    });

    // Live date and clock updater
    function updateClock() {
        const timeEl = document.getElementById('live-time');
        const dateEl = document.getElementById('live-date');
        if (!timeEl || !dateEl) return;
        const now = new Date();
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekday = weekdays[now.getDay()];
        const month = months[now.getMonth()];
        const date = now.getDate();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${hours}:${minutes}`;
        dateEl.textContent = `${weekday} ${month} ${date}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
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
                
                ensureTesseract()
                    .then(() => Tesseract.recognize(compressedDataUrl, 'fra+eng'))
                    .then(({ data: { text } }) => {
                        currentOcrText = text;
                        console.log("Add Grade File OCR:", text);
                    }).catch(err => {
                        console.error("Add Grade File OCR error:", err);
                    }).finally(() => {
                        if (ocrStatus) ocrStatus.style.display = 'none';
                        isOcrRunning = false;
                    });
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
                
                ensureTesseract()
                    .then(() => Tesseract.recognize(compressedDataUrl, 'fra+eng'))
                    .then(({ data: { text } }) => {
                        editOcrText = text;
                        console.log("Edit Grade File OCR:", text);
                    }).catch(err => {
                        console.error("Edit Grade File OCR error:", err);
                    }).finally(() => {
                        if (ocrStatus) ocrStatus.style.display = 'none';
                        isOcrRunning = false;
                    });
            };
            reader.readAsDataURL(file);
        });
    }
}, 500);


// Les modules ES sont différés : le DOM est déjà prêt quand ce code s'exécute.
init();
