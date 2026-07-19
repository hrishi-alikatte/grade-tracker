import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }));
vi.mock('../src/features/supabaseClient.js', () => ({
    getSupabase: getSupabaseMock,
    isSupabaseConfigured: () => true,
}));

import { deleteAccount } from '../src/features/auth.js';

beforeEach(() => {
    getSupabaseMock.mockReset();
});

describe('deleteAccount — RPC delete_my_account', () => {
    it('appelle la RPC et résout en cas de succès', async () => {
        const rpc = vi.fn().mockResolvedValue({ error: null });
        getSupabaseMock.mockResolvedValue({ rpc });

        await expect(deleteAccount()).resolves.toBeUndefined();
        expect(rpc).toHaveBeenCalledWith('delete_my_account');
    });

    it('propage l\'erreur RPC (aucun effacement local ne doit suivre)', async () => {
        const rpc = vi.fn().mockResolvedValue({ error: { message: 'permission denied' } });
        getSupabaseMock.mockResolvedValue({ rpc });

        await expect(deleteAccount()).rejects.toMatchObject({ message: 'permission denied' });
    });

    it('échoue proprement quand Supabase n\'est pas configuré', async () => {
        getSupabaseMock.mockResolvedValue(null);

        await expect(deleteAccount()).rejects.toThrow();
    });
});
