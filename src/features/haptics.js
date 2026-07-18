// --- Haptic Feedback (Capacitor) ---
// Every import is deferred to call time so this module is importable in Node
// (tests) and inert on the web build. All helpers are fire-and-forget: they
// never throw or reject — a failed haptic must never break the UI flow.

/**
 * Resolves the @capacitor/haptics module when haptics should fire, or null
 * when they must stay silent (web platform, or disabled in settings).
 */
async function hapticsIfEnabled() {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { state } = await import('../state/store.js');
    if (state.settings && state.settings.haptics === false) return null;
    return import('@capacitor/haptics');
}

async function hapticImpact(style = 'light') {
    try {
        const haptics = await hapticsIfEnabled();
        if (!haptics) return;
        const { Haptics, ImpactStyle } = haptics;
        const styles = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
        await Haptics.impact({ style: styles[style] || ImpactStyle.Light });
    } catch (e) {}
}

async function hapticNotification(type = 'success') {
    try {
        const haptics = await hapticsIfEnabled();
        if (!haptics) return;
        const { Haptics, NotificationType } = haptics;
        const types = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
        await Haptics.notification({ type: types[type] || NotificationType.Success });
    } catch (e) {}
}

async function hapticSelection() {
    try {
        const haptics = await hapticsIfEnabled();
        if (!haptics) return;
        const { Haptics } = haptics;
        // selectionChanged only produces feedback inside a start/end pair.
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
    } catch (e) {}
}

export { hapticImpact, hapticNotification, hapticSelection };
