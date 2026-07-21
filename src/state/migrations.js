// --- State migrations & normalization ---
// Two distinct mechanisms, don't mix them up:
//
// 1. normalizeState(state)  — idempotent repairs that run on EVERY load
//    (fill missing lists/fields, convert legacy grade arrays, sync names).
//
// 2. MIGRATIONS             — one-shot, version-gated upgrades. The version
//    lives INSIDE the blob (state.schemaVersion); the localStorage key
//    stays 'gymnase_vaud_state_v5' forever — renaming keys loses data.

import { defaultSubjectsYear1, defaultSubjectsYear2, defaultSubjectsYear3 } from './defaults.js';

export const CURRENT_SCHEMA_VERSION = 7;

export const DEFAULT_SETTINGS = {
    sounds: true,
    roasts: true,
    haptics: true,
    confetti: true
};

export function migrateSubjectGrades(subject) {
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

function allSubjectLists(state) {
    return [
        state.subjectsYear1, state.subjectsYear2, state.subjectsYear3,
        state.subjectsYear1_rep, state.subjectsYear2_rep, state.subjectsYear3_rep
    ].filter(Boolean);
}

/** Idempotent normalization, runs on every load. */
export function normalizeState(state) {
    if (state.studentName == null) state.studentName = '';
    if (!state.studentEmail) state.studentEmail = '';
    if (!state.studentMobile) state.studentMobile = '';
    if (state.isLoggedIn === undefined) state.isLoggedIn = false;
    if (!state.currentYear) state.currentYear = 1;
    if (!state.currentSemester) state.currentSemester = 'sem1';
    if (!state.theme) state.theme = 'navy';
    if (state.hasSeenOnboarding === undefined) state.hasSeenOnboarding = false;
    if (!state.promoViewMode) state.promoViewMode = 'visual';
    if (state.isLightTheme === undefined) state.isLightTheme = true;
    if (state.showAllYears === undefined) state.showAllYears = (Math.floor(state.currentYear) === 3);
    if (!state.repeatingYears) {
        state.repeatingYears = { 1: false, 2: false, 3: false };
    }
    if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (state.settings[key] === undefined) state.settings[key] = DEFAULT_SETTINGS[key];
    }
    if (!state.badGradeMessages) {
        state.badGradeMessages = [
            "t'a revisé ou ...",
            "bruh",
            "rappelle toi de ton objective!",
            "bye."
        ];
    }

    if (!state.subjectsYear1 || state.subjectsYear1.length === 0) {
        state.subjectsYear1 = JSON.parse(JSON.stringify(defaultSubjectsYear1));
    }
    if (!state.subjectsYear2 || state.subjectsYear2.length === 0) {
        state.subjectsYear2 = JSON.parse(JSON.stringify(defaultSubjectsYear2));
    }
    if (!state.subjectsYear3 || state.subjectsYear3.length === 0) {
        state.subjectsYear3 = JSON.parse(JSON.stringify(defaultSubjectsYear3));
    } else {
        // Split the retired combined phys+chimie carry-over into two subjects
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

    if (!state.subjectsYear1_rep) state.subjectsYear1_rep = JSON.parse(JSON.stringify(defaultSubjectsYear1));
    if (!state.subjectsYear2_rep) state.subjectsYear2_rep = JSON.parse(JSON.stringify(defaultSubjectsYear2));
    if (!state.subjectsYear3_rep) state.subjectsYear3_rep = JSON.parse(JSON.stringify(defaultSubjectsYear3));

    allSubjectLists(state).forEach(list => list.forEach(migrateSubjectGrades));

    // Sync the Year 3 Art name from the Year 2 choice
    const y3Art = state.subjectsYear3.find(s => s.role === 'art_y2');
    const y2Art = state.subjectsYear2.find(s => s.role === 'art');
    if (y2Art && y3Art) {
        y3Art.name = `${y2Art.name} (Y2)`;
    }

    return state;
}

/**
 * v6: stamp the schema version, seed the settings object and backfill
 * grade.createdAt from the timestamp embedded in legacy grade ids
 * ('grade_<Date.now()>_<rand>') — the streak feature needs it.
 */
function upgradeToV6(state) {
    if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
    allSubjectLists(state).forEach(list => list.forEach(subject => {
        migrateSubjectGrades(subject);
        for (const sem of ['sem1', 'sem2']) {
            subject.grades[sem].forEach(grade => {
                if (!grade.createdAt) {
                    const match = /^grade_(\d{12,14})(_|$)/.exec(grade.id || '');
                    if (match) {
                        grade.createdAt = new Date(Number(match[1])).toISOString();
                    } else if (grade.date) {
                        grade.createdAt = new Date(grade.date).toISOString();
                    }
                    // No id timestamp and no date: leave undefined rather than lie.
                }
            });
        }
    }));
}

/**
 * v7: add studentDob, studentEmail, studentMobile, and isLoggedIn for sign-in.
 */
function upgradeToV7(state) {
    state.studentEmail = state.studentEmail || '';
    state.studentMobile = state.studentMobile || '';
    if (state.isLoggedIn === undefined) state.isLoggedIn = false;
}

const MIGRATIONS = [
    { to: 6, up: upgradeToV6 },
    { to: 7, up: upgradeToV7 }
];

/** Applies pending one-shot migrations. Blobs without a version are v5. */
export function runMigrations(state) {
    const from = state.schemaVersion || 5;
    for (const migration of MIGRATIONS) {
        if (migration.to > from) migration.up(state);
    }
    state.schemaVersion = CURRENT_SCHEMA_VERSION;
    return state;
}

/**
 * Cheap structural sanity check before trusting a parsed blob.
 * Deliberately lenient — normalizeState repairs missing pieces; this only
 * rejects blobs that are not even the right kind of object.
 */
export function isValidStateShape(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    for (const key of ['subjectsYear1', 'subjectsYear2', 'subjectsYear3']) {
        if (parsed[key] !== undefined && !Array.isArray(parsed[key])) return false;
    }
    return true;
}
