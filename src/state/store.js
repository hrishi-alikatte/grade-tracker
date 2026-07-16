// --- 6. State Management ---
// The whole app state lives here: one object persisted as a single JSON blob
// in localStorage. UI modules import { state } and mutate its properties,
// then call saveState().
//
// Storage keys:
//   gymnase_vaud_state_v5           the live blob (name is historical — the
//                                   real version is state.schemaVersion)
//   gymnase_vaud_state_backup       last-known-good snapshot, refreshed on
//                                   every successful load
//   gymnase_vaud_state_corrupt_<ts> quarantined copies of unreadable blobs —
//                                   never silently destroy a student's data
import { defaultSubjectsYear1, defaultSubjectsYear2, defaultSubjectsYear3 } from './defaults.js';
import { normalizeState, runMigrations, isValidStateShape, migrateSubjectGrades, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from './migrations.js';
import { applyTheme } from '../ui/theme.js';
import { showSidebarToast } from '../ui/effects.js';

export const STORAGE_KEY = 'gymnase_vaud_state_v5';
export const BACKUP_KEY = 'gymnase_vaud_state_backup';

export let state = {
    studentName: 'Étudiant',
    currentYear: 1,
    currentSemester: 'sem1',
    subjectsYear1: [],
    subjectsYear2: [],
    subjectsYear3: [],
    theme: 'navy'
};

function quarantine(raw, reason) {
    try {
        const key = `gymnase_vaud_state_corrupt_${Date.now()}`;
        localStorage.setItem(key, raw);
        console.error(`State unreadable (${reason}); raw blob preserved under ${key}`);
    } catch (e) {
        console.error('Could not quarantine the unreadable state blob', e);
    }
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        resetStateToDefault();
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(saved);
    } catch (e) {
        quarantine(saved, 'parse-error');
        resetStateToDefault();
        showSidebarToast("Données illisibles — une copie a été conservée, l'app repart de zéro.", 'error');
        return;
    }

    if (!isValidStateShape(parsed)) {
        quarantine(saved, 'bad-shape');
        resetStateToDefault();
        showSidebarToast("Données invalides — une copie a été conservée, l'app repart de zéro.", 'error');
        return;
    }

    if ((parsed.schemaVersion || 5) > CURRENT_SCHEMA_VERSION) {
        // Blob written by a NEWER app version: don't touch it, keep a copy,
        // and run on defaults so a later save can't corrupt the newer data.
        quarantine(saved, 'newer-schema');
        resetStateToDefault();
        showSidebarToast("Ces données viennent d'une version plus récente de l'app. Mets à jour pour les retrouver.", 'error');
        return;
    }

    state = parsed;
    runMigrations(state);
    normalizeState(state);
    saveState();

    // Refresh the last-known-good snapshot only after a fully successful load.
    try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
    } catch (e) {
        // Quota exceeded is non-fatal: the live blob still saved fine.
    }

    applyTheme();
}

function resetStateToDefault() {
    state = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
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
        promoViewMode: 'visual',
        settings: { ...DEFAULT_SETTINGS }
    };
    saveState();
    applyTheme();
}

function saveState() {
    // Horodatage pour la synchro cloud (résolution de conflit LWW). Sans effet
    // sur l'app hors ligne : c'est juste un champ de plus dans le blob.
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Signal pour la couche de synchro (inerte si Supabase non configuré).
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('notare:state-saved'));
    }
}

/**
 * Replaces the whole state (used by backup import). The caller is expected
 * to reload the UI afterwards.
 */
function replaceState(newState) {
    state = newState;
    runMigrations(state);
    normalizeState(state);
    saveState();
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

export { migrateSubjectGrades, loadState, resetStateToDefault, saveState, replaceState, getBaseYear, getCurrentSubjects, isCurrentYearLocked };
