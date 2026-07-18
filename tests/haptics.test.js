import { describe, it, expect, beforeEach, vi } from 'vitest';

// haptics.js defers every import to call time, so these mocks intercept the
// dynamic imports it makes when a helper actually fires.
const platform = vi.hoisted(() => ({ isNative: true }));
const mockState = vi.hoisted(() => ({ settings: { haptics: true } }));

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => platform.isNative }
}));

vi.mock('../src/state/store.js', () => ({ state: mockState }));

vi.mock('@capacitor/haptics', () => ({
    Haptics: {
        impact: vi.fn().mockResolvedValue(undefined),
        notification: vi.fn().mockResolvedValue(undefined),
        selectionStart: vi.fn().mockResolvedValue(undefined),
        selectionChanged: vi.fn().mockResolvedValue(undefined),
        selectionEnd: vi.fn().mockResolvedValue(undefined)
    },
    ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
    NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' }
}));

import { Haptics } from '@capacitor/haptics';
// This static import runs the module under plain Node (vitest default env, no
// DOM): resolving it without error IS the import-safety guarantee.
import { hapticImpact, hapticNotification, hapticSelection } from '../src/features/haptics.js';

describe('haptics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        platform.isNative = true;
        mockState.settings = { haptics: true };
    });

    it('imports cleanly in Node and exposes the three helpers', () => {
        expect(typeof hapticImpact).toBe('function');
        expect(typeof hapticNotification).toBe('function');
        expect(typeof hapticSelection).toBe('function');
    });

    describe('no-op guards', () => {
        it('does nothing on web (non-native platform)', async () => {
            platform.isNative = false;
            await hapticImpact('heavy');
            await hapticNotification('error');
            await hapticSelection();
            expect(Haptics.impact).not.toHaveBeenCalled();
            expect(Haptics.notification).not.toHaveBeenCalled();
            expect(Haptics.selectionStart).not.toHaveBeenCalled();
        });

        it('does nothing when settings.haptics is false', async () => {
            mockState.settings.haptics = false;
            await hapticImpact();
            await hapticNotification();
            await hapticSelection();
            expect(Haptics.impact).not.toHaveBeenCalled();
            expect(Haptics.notification).not.toHaveBeenCalled();
            expect(Haptics.selectionChanged).not.toHaveBeenCalled();
        });

        it('fires when settings are missing (haptics default to on)', async () => {
            mockState.settings = undefined;
            await hapticImpact();
            expect(Haptics.impact).toHaveBeenCalledTimes(1);
        });
    });

    describe('hapticImpact', () => {
        it('maps style names to ImpactStyle values', async () => {
            await hapticImpact('heavy');
            expect(Haptics.impact).toHaveBeenLastCalledWith({ style: 'HEAVY' });
            await hapticImpact('medium');
            expect(Haptics.impact).toHaveBeenLastCalledWith({ style: 'MEDIUM' });
            await hapticImpact('light');
            expect(Haptics.impact).toHaveBeenLastCalledWith({ style: 'LIGHT' });
        });

        it('defaults to light, including for unknown styles', async () => {
            await hapticImpact();
            expect(Haptics.impact).toHaveBeenLastCalledWith({ style: 'LIGHT' });
            await hapticImpact('nuclear');
            expect(Haptics.impact).toHaveBeenLastCalledWith({ style: 'LIGHT' });
        });
    });

    describe('hapticNotification', () => {
        it('maps type names to NotificationType values', async () => {
            await hapticNotification('success');
            expect(Haptics.notification).toHaveBeenLastCalledWith({ type: 'SUCCESS' });
            await hapticNotification('warning');
            expect(Haptics.notification).toHaveBeenLastCalledWith({ type: 'WARNING' });
            await hapticNotification('error');
            expect(Haptics.notification).toHaveBeenLastCalledWith({ type: 'ERROR' });
        });

        it('defaults to success, including for unknown types', async () => {
            await hapticNotification();
            expect(Haptics.notification).toHaveBeenLastCalledWith({ type: 'SUCCESS' });
            await hapticNotification('mystery');
            expect(Haptics.notification).toHaveBeenLastCalledWith({ type: 'SUCCESS' });
        });
    });

    describe('hapticSelection', () => {
        it('runs the start → changed → end sequence', async () => {
            await hapticSelection();
            expect(Haptics.selectionStart).toHaveBeenCalledTimes(1);
            expect(Haptics.selectionChanged).toHaveBeenCalledTimes(1);
            expect(Haptics.selectionEnd).toHaveBeenCalledTimes(1);
        });
    });

    describe('fire-and-forget safety', () => {
        it('resolves instead of rejecting when the plugin throws', async () => {
            Haptics.impact.mockRejectedValueOnce(new Error('native bridge down'));
            await expect(hapticImpact('medium')).resolves.toBeUndefined();
            Haptics.notification.mockRejectedValueOnce(new Error('native bridge down'));
            await expect(hapticNotification('error')).resolves.toBeUndefined();
            Haptics.selectionStart.mockRejectedValueOnce(new Error('native bridge down'));
            await expect(hapticSelection()).resolves.toBeUndefined();
        });
    });
});
