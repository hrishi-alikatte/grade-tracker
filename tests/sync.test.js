import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks hissés avant l'import de sync.js
const { mockStore, getSupabaseMock } = vi.hoisted(() => ({
    mockStore: {
        state: { updatedAt: 0 },
        replaceState: vi.fn(),
        resetStateToDefault: vi.fn(),
    },
    getSupabaseMock: vi.fn(),
}));

vi.mock('../src/state/store.js', () => mockStore);
vi.mock('../src/features/supabaseClient.js', () => ({
    getSupabase: getSupabaseMock,
}));

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        key: (i) => Object.keys(store)[i] || null,
        get length() { return Object.keys(store).length; },
    };
})();
global.localStorage = localStorageMock;

import { pushState, pullAndMerge } from '../src/features/sync.js';

// Fabrique un client Supabase factice. Chaque from() rend un builder chaînable ;
// update…select résout updateResult, select…maybeSingle résout selectResult,
// insert résout { error: insertError }.
function makeSb({ updateResult, selectResult, insertError = null, user = { id: 'u1' } } = {}) {
    const calls = { updates: [], lte: [], inserts: [], froms: 0 };
    const sb = {
        auth: { getUser: async () => ({ data: { user } }) },
        from: () => {
            calls.froms += 1;
            const b = { _mode: null };
            b.update = (payload) => { b._mode = 'update'; calls.updates.push(payload); return b; };
            b.eq = () => b;
            b.lte = (col, val) => { calls.lte.push([col, val]); return b; };
            b.select = () => {
                if (b._mode === 'update') return Promise.resolve(updateResult);
                b._mode = 'select';
                return b;
            };
            b.maybeSingle = () => Promise.resolve(selectResult);
            b.insert = (payload) => { calls.inserts.push(payload); return Promise.resolve({ error: insertError }); };
            return b;
        },
    };
    return { sb, calls };
}

beforeEach(() => {
    localStorage.clear();
    mockStore.state.updatedAt = 1000;
    mockStore.replaceState.mockClear();
    mockStore.resetStateToDefault.mockClear();
    getSupabaseMock.mockReset();
});

describe('pushState — poussée gardée (LWW)', () => {
    it('pousse quand le distant n\'est pas plus récent, avec garde lte sur updated_at', async () => {
        const { sb, calls } = makeSb({
            updateResult: { data: [{ user_id: 'u1' }], error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);
        localStorage.setItem('notare_sync_pending', '1');

        await pushState();

        expect(calls.updates).toHaveLength(1);
        expect(calls.lte).toEqual([['updated_at', new Date(1000).toISOString()]]);
        expect(calls.inserts).toHaveLength(0);
        expect(localStorage.getItem('notare_sync_pending')).toBeNull();
        expect(localStorage.getItem('notare_last_user')).toBe('u1');
        expect(mockStore.replaceState).not.toHaveBeenCalled();
    });

    it('adopte le distant au lieu de l\'écraser quand il est plus récent', async () => {
        const remote = { grades: 'plus récentes' };
        const { sb, calls } = makeSb({
            updateResult: { data: [], error: null },
            selectResult: { data: { state: remote, updated_at: new Date(5000).toISOString() }, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);

        await pushState();

        expect(calls.inserts).toHaveLength(0);
        expect(mockStore.replaceState).toHaveBeenCalledWith(remote);
        expect(localStorage.getItem('notare_last_user')).toBe('u1');
    });

    it('insère la ligne quand elle n\'existe pas encore', async () => {
        const { sb, calls } = makeSb({
            updateResult: { data: [], error: null },
            selectResult: { data: null, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);

        await pushState();

        expect(calls.inserts).toHaveLength(1);
        expect(calls.inserts[0].user_id).toBe('u1');
        expect(mockStore.replaceState).not.toHaveBeenCalled();
    });

    it('marque « en attente » hors ligne sans appeler le réseau', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const { sb, calls } = makeSb({});
        getSupabaseMock.mockResolvedValue(sb);

        await pushState();

        expect(calls.froms).toBe(0);
        expect(localStorage.getItem('notare_sync_pending')).toBe('1');
        vi.unstubAllGlobals();
    });

    it('ne pousse jamais l\'état local d\'un autre utilisateur', async () => {
        localStorage.setItem('notare_last_user', 'ancien-utilisateur');
        const { sb, calls } = makeSb({});
        getSupabaseMock.mockResolvedValue(sb);

        await pushState();

        expect(calls.froms).toBe(0);
        expect(calls.updates).toHaveLength(0);
    });

    it('marque « en attente » quand la poussée échoue', async () => {
        const { sb } = makeSb({
            updateResult: { data: null, error: { message: 'réseau' } },
        });
        getSupabaseMock.mockResolvedValue(sb);

        await pushState();

        expect(localStorage.getItem('notare_sync_pending')).toBe('1');
    });
});

describe('pullAndMerge — fusion LWW', () => {
    it('adopte le distant plus récent et notifie onReplaced', async () => {
        const remote = { grades: 'cloud' };
        const { sb, calls } = makeSb({
            selectResult: { data: { state: remote, updated_at: new Date(9000).toISOString() }, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);
        const onReplaced = vi.fn();

        await pullAndMerge({ onReplaced });

        expect(mockStore.replaceState).toHaveBeenCalledWith(remote);
        expect(onReplaced).toHaveBeenCalled();
        expect(calls.updates).toHaveLength(0);
        expect(localStorage.getItem('notare_last_user')).toBe('u1');
    });

    it('pousse le local (gardé) quand le distant est plus ancien', async () => {
        mockStore.state.updatedAt = 9000;
        const { sb, calls } = makeSb({
            updateResult: { data: [{ user_id: 'u1' }], error: null },
            selectResult: { data: { state: { vieux: true }, updated_at: new Date(1000).toISOString() }, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);

        await pullAndMerge();

        expect(mockStore.replaceState).not.toHaveBeenCalled();
        expect(calls.updates).toHaveLength(1);
        expect(calls.lte).toEqual([['updated_at', new Date(9000).toISOString()]]);
    });

    it('changement d\'utilisateur : adopte le cloud sans jamais pousser le local', async () => {
        localStorage.setItem('notare_last_user', 'ancien-utilisateur');
        const remote = { grades: 'du nouveau compte' };
        const { sb, calls } = makeSb({
            selectResult: { data: { state: remote, updated_at: new Date(1).toISOString() }, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);
        const onReplaced = vi.fn();

        await pullAndMerge({ onReplaced });

        expect(mockStore.replaceState).toHaveBeenCalledWith(remote);
        expect(calls.updates).toHaveLength(0);
        expect(onReplaced).toHaveBeenCalled();
        expect(localStorage.getItem('notare_last_user')).toBe('u1');
    });

    it('changement d\'utilisateur + cloud vide : repart d\'un état vierge', async () => {
        localStorage.setItem('notare_last_user', 'ancien-utilisateur');
        const { sb, calls } = makeSb({
            selectResult: { data: { state: {}, updated_at: null }, error: null },
        });
        getSupabaseMock.mockResolvedValue(sb);

        await pullAndMerge();

        expect(mockStore.resetStateToDefault).toHaveBeenCalled();
        expect(mockStore.replaceState).not.toHaveBeenCalled();
        expect(calls.updates).toHaveLength(0);
        expect(localStorage.getItem('notare_last_user')).toBe('u1');
    });
});
