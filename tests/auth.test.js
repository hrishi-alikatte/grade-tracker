import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser dependencies before importing store
vi.mock('../src/ui/theme.js', () => ({
    applyTheme: vi.fn()
}));
vi.mock('../src/ui/effects.js', () => ({
    showSidebarToast: vi.fn(),
    playConfettiSound: vi.fn(),
    playFahSound: vi.fn(),
    startConfetti: vi.fn(),
    initBackgroundBoxes: vi.fn()
}));

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = String(value);
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        }
    };
})();

global.localStorage = localStorageMock;

// Import store modules
import { state, resetStateToDefault, saveState, replaceState } from '../src/state/store.js';
import { CURRENT_SCHEMA_VERSION } from '../src/state/migrations.js';

describe('Student Authentication State', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStateToDefault();
    });

    it('initializes default state with empty profile and logged out status', () => {
        expect(state.isLoggedIn).toBe(false);
        expect(state.studentName).toBe('');
        expect(state.studentEmail).toBe('');
        expect(state.studentMobile).toBe('');
    });

    it('successfully updates state on login/registration simulation', () => {
        state.studentName = 'Pranathi Alikatte';
        state.studentEmail = 'pranathi@example.com';
        state.studentMobile = '+41 79 111 22 33';
        state.isLoggedIn = true;

        saveState();

        const stored = JSON.parse(localStorage.getItem('gymnase_vaud_state_v5'));
        expect(stored.isLoggedIn).toBe(true);
        expect(stored.studentName).toBe('Pranathi Alikatte');
        expect(stored.studentEmail).toBe('pranathi@example.com');
        expect(stored.studentMobile).toBe('+41 79 111 22 33');
    });

    it('correctly clears profile and resets on logout', () => {
        // Log in first
        state.studentName = 'Pranathi Alikatte';
        state.studentEmail = 'pranathi@example.com';
        state.studentMobile = '+41 79 111 22 33';
        state.isLoggedIn = true;
        saveState();

        // Logout resets state
        resetStateToDefault();

        expect(state.isLoggedIn).toBe(false);
        expect(state.studentName).toBe('');
        expect(state.studentEmail).toBe('');
        expect(state.studentMobile).toBe('');
    });

    it('syncs state to simulated database when isLoggedIn is true', () => {
        const REG_STUDENTS_KEY = 'notare_registered_students';

        // Set up mock registered student container in simulated DB
        const mockDb = [
            {
                name: 'Pranathi Alikatte',
                email: 'pranathi@example.com',
                mobile: '+41 79 111 22 33',
                state: {}
            }
        ];
        localStorage.setItem(REG_STUDENTS_KEY, JSON.stringify(mockDb));

        // Sync local changes to state
        state.studentName = 'Pranathi Alikatte';
        state.studentEmail = 'pranathi@example.com';
        state.studentMobile = '+41 79 111 22 33';
        state.isLoggedIn = true;
        state.theme = 'green'; // change theme to test state sync

        saveState();

        const db = JSON.parse(localStorage.getItem(REG_STUDENTS_KEY));
        expect(db).toHaveLength(1);
        expect(db[0].state.theme).toBe('green');
        expect(db[0].state.studentName).toBe('Pranathi Alikatte');
    });
});
