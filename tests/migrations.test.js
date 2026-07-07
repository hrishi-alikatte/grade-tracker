import { describe, it, expect } from 'vitest';
import {
    normalizeState,
    runMigrations,
    isValidStateShape,
    migrateSubjectGrades,
    CURRENT_SCHEMA_VERSION,
    DEFAULT_SETTINGS
} from '../src/state/migrations.js';

// A realistic pre-v6 blob, as the live app wrote it (no schemaVersion,
// no settings, legacy grade ids carrying their creation timestamp).
function legacyV5Blob() {
    return {
        studentName: 'Pranathi',
        currentYear: 2,
        currentSemester: 'sem1',
        theme: 'pink',
        isLightTheme: true,
        hasSeenOnboarding: true,
        showAllYears: false,
        repeatingYears: { 1: false, 2: false, 3: false },
        subjectsYear1: [
            {
                id: 'y1_maths', name: 'Maths', role: 'math', target: 4.5, evaluationMode: 'dual',
                grades: {
                    sem1: [{ id: 'grade_1719840000000_ab12', name: 'Test 1', value: 4.5, type: 'TS', date: null, comment: null, hasPhoto: false }],
                    sem2: []
                }
            }
        ],
        subjectsYear2: [
            // Legacy array-form grades (pre-semester split)
            { id: 'y2_maths', name: 'Maths', role: 'math', target: 4.5, evaluationMode: 'dual', grades: [{ id: 'grade_1719840000001_cd34', name: 'Old', value: 5.0, type: 'TS' }] }
        ],
        subjectsYear3: [
            { id: 'y3_phys_chimie_y2', name: 'Phys+Chimie (Y2)', role: 'phys_chimie_y2', target: 4.0, evaluationMode: 'locked', grades: { sem1: [], sem2: [] } }
        ]
        // note: no _rep lists, no settings, no schemaVersion
    };
}

describe('migrateSubjectGrades', () => {
    it('converts legacy array grades to {sem1, sem2}', () => {
        const s = { grades: [{ value: 5.0 }] };
        migrateSubjectGrades(s);
        expect(s.grades.sem1).toHaveLength(1);
        expect(s.grades.sem2).toEqual([]);
    });

    it('creates empty structure when grades are missing', () => {
        const s = {};
        migrateSubjectGrades(s);
        expect(s.grades).toEqual({ sem1: [], sem2: [] });
    });
});

describe('runMigrations (v5 → v6)', () => {
    it('stamps the schema version', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('seeds default settings', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        expect(s.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('backfills grade.createdAt from the id timestamp', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        const grade = s.subjectsYear1[0].grades.sem1[0];
        expect(grade.createdAt).toBe(new Date(1719840000000).toISOString());
    });

    it('backfills from grade.date when the id has no timestamp', () => {
        const s = legacyV5Blob();
        s.subjectsYear1[0].grades.sem1[0].id = 'weird_id';
        s.subjectsYear1[0].grades.sem1[0].date = '2026-05-01';
        runMigrations(s);
        expect(s.subjectsYear1[0].grades.sem1[0].createdAt).toBe(new Date('2026-05-01').toISOString());
    });

    it('is idempotent: running twice changes nothing', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        normalizeState(s);
        const snapshot = JSON.stringify(s);
        runMigrations(s);
        normalizeState(s);
        expect(JSON.stringify(s)).toBe(snapshot);
    });

    it('does not overwrite an existing createdAt', () => {
        const s = legacyV5Blob();
        s.subjectsYear1[0].grades.sem1[0].createdAt = '2020-01-01T00:00:00.000Z';
        runMigrations(s);
        expect(s.subjectsYear1[0].grades.sem1[0].createdAt).toBe('2020-01-01T00:00:00.000Z');
    });
});

describe('normalizeState', () => {
    it('fills missing _rep lists and default fields', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        normalizeState(s);
        expect(Array.isArray(s.subjectsYear1_rep)).toBe(true);
        expect(s.subjectsYear1_rep.length).toBeGreaterThan(0);
        expect(s.promoViewMode).toBe('visual');
    });

    it('splits the retired combined phys+chimie carry-over', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        normalizeState(s);
        expect(s.subjectsYear3.some(x => x.id === 'y3_phys_chimie_y2')).toBe(false);
        expect(s.subjectsYear3.some(x => x.id === 'y3_physique_y2')).toBe(true);
        expect(s.subjectsYear3.some(x => x.id === 'y3_chimie_y2')).toBe(true);
        expect(s.subjectsYear3.some(x => x.id === 'y3_art_y2')).toBe(true);
    });

    it('converts legacy array grades everywhere', () => {
        const s = legacyV5Blob();
        runMigrations(s);
        normalizeState(s);
        expect(Array.isArray(s.subjectsYear2[0].grades)).toBe(false);
        expect(s.subjectsYear2[0].grades.sem1).toHaveLength(1);
    });

    it('keeps existing settings values while filling missing keys', () => {
        const s = legacyV5Blob();
        s.settings = { sounds: false };
        normalizeState(s);
        expect(s.settings.sounds).toBe(false);
        expect(s.settings.roasts).toBe(true);
    });
});

describe('isValidStateShape', () => {
    it('accepts a legit blob and a minimal object', () => {
        expect(isValidStateShape(legacyV5Blob())).toBe(true);
        expect(isValidStateShape({ hasSeenOnboarding: true })).toBe(true);
    });

    it('rejects non-objects and mistyped subject lists', () => {
        expect(isValidStateShape(null)).toBe(false);
        expect(isValidStateShape('hello')).toBe(false);
        expect(isValidStateShape([1, 2])).toBe(false);
        expect(isValidStateShape({ subjectsYear1: 'nope' })).toBe(false);
    });
});
