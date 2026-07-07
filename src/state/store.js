// --- 6. State Management ---
// The whole app state lives here: one object persisted as a single JSON blob
// in localStorage. UI modules import { state } and mutate its properties,
// then call saveState().
import { defaultSubjectsYear1, defaultSubjectsYear2, defaultSubjectsYear3 } from './defaults.js';
import { applyTheme } from '../ui/theme.js';

export let state = {
    studentName: 'Étudiant',
    currentYear: 1,
    currentSemester: 'sem1',
    subjectsYear1: [],
    subjectsYear2: [],
    subjectsYear3: [],
    theme: 'navy'
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

    // Sync the Year 3 Art name from Year 2 choice
    const y3Art = state.subjectsYear3.find(s => s.role === 'art_y2');
    const y2Art = state.subjectsYear2.find(s => s.role === 'art');
    if (y2Art && y3Art) {
        y3Art.name = `${y2Art.name} (Y2)`;
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
            if (!state.theme) state.theme = 'navy';
            if (state.hasSeenOnboarding === undefined) state.hasSeenOnboarding = false;
            if (!state.promoViewMode) state.promoViewMode = 'visual';
            if (state.isLightTheme === undefined) state.isLightTheme = true;
            if (state.showAllYears === undefined) state.showAllYears = (Math.floor(state.currentYear) === 3 ? true : false);
            if (!state.repeatingYears) {
                state.repeatingYears = { 1: false, 2: false, 3: false };
            }
            if (!state.subjectsYear1_rep) state.subjectsYear1_rep = JSON.parse(JSON.stringify(defaultSubjectsYear1));
            if (!state.subjectsYear2_rep) state.subjectsYear2_rep = JSON.parse(JSON.stringify(defaultSubjectsYear2));
            if (!state.subjectsYear3_rep) state.subjectsYear3_rep = JSON.parse(JSON.stringify(defaultSubjectsYear3));
            
            runStateMigrations();
            
            state.subjectsYear1.forEach(migrateSubjectGrades);
            state.subjectsYear2.forEach(migrateSubjectGrades);
            state.subjectsYear3.forEach(migrateSubjectGrades);
            state.subjectsYear1_rep.forEach(migrateSubjectGrades);
            state.subjectsYear2_rep.forEach(migrateSubjectGrades);
            state.subjectsYear3_rep.forEach(migrateSubjectGrades);
            
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
        subjectsYear1_rep: JSON.parse(JSON.stringify(defaultSubjectsYear1)),
        subjectsYear2_rep: JSON.parse(JSON.stringify(defaultSubjectsYear2)),
        subjectsYear3_rep: JSON.parse(JSON.stringify(defaultSubjectsYear3)),
        repeatingYears: { 1: false, 2: false, 3: false },
        theme: 'navy',
        isLightTheme: true,
        hasSeenOnboarding: false,
        showAllYears: false,
        promoViewMode: 'visual'
    };
    saveState();
    applyTheme();
}

function saveState() {
    localStorage.setItem('gymnase_vaud_state_v5', JSON.stringify(state));
}

function getBaseYear() {
    const cy = state.currentYear;
    if (cy === 1 || cy === 1.5) return 1;
    if (cy === 2 || cy === 2.5) return 2;
    if (cy === 3 || cy === 3.5) return 3;
    return 1;
}

function getCurrentSubjects() {
    const cy = state.currentYear;
    if (cy === 1) return state.subjectsYear1;
    if (cy === 1.5) return state.subjectsYear1_rep;
    if (cy === 2) return state.subjectsYear2;
    if (cy === 2.5) return state.subjectsYear2_rep;
    if (cy === 3) return state.subjectsYear3;
    if (cy === 3.5) return state.subjectsYear3_rep;
    return state.subjectsYear1;
}

function isCurrentYearLocked() {
    const cy = state.currentYear;
    if (cy === 1 && state.repeatingYears && state.repeatingYears[1]) return true;
    if (cy === 2 && state.repeatingYears && state.repeatingYears[2]) return true;
    if (cy === 3 && state.repeatingYears && state.repeatingYears[3]) return true;
    return false;
}

export { migrateSubjectGrades, runStateMigrations, loadState, resetStateToDefault, saveState, getBaseYear, getCurrentSubjects, isCurrentYearLocked };
