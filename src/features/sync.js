// Synchronisation de l'état Notare avec le cloud (table user_state).
// Stratégie : offline-first. Le localStorage reste le cache de travail ; ce
// module pousse/tire un snapshot jsonb et résout les conflits en « dernière
// écriture gagnante » (LWW) via state.updatedAt vs user_state.updated_at.
//
// Inerte si Supabase n'est pas configuré (getSupabase() renvoie null).

import { getSupabase } from './supabaseClient.js';
import { state, replaceState } from '../state/store.js';

const PENDING_KEY = 'notare_sync_pending';
let pushTimer = null;
let syncing = false;

function markPending() {
    try { localStorage.setItem(PENDING_KEY, '1'); } catch (e) { /* quota */ }
}
function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
}

async function currentUser(sb) {
    const { data } = await sb.auth.getUser();
    return data && data.user;
}

// Pousse l'état local vers le cloud (upsert). Marque « en attente » si hors
// ligne ou en cas d'erreur, pour un flush ultérieur.
export async function pushState() {
    const sb = await getSupabase();
    if (!sb) return;
    const user = await currentUser(sb);
    if (!user) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        markPending();
        return;
    }
    const updatedAt = state.updatedAt || Date.now();
    const { error } = await sb.from('user_state').upsert({
        user_id: user.id,
        state,
        updated_at: new Date(updatedAt).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) {
        markPending();
        console.warn('Sync push a échoué, réessai plus tard.', error.message);
    } else {
        clearPending();
    }
}

// Anti-rebond : regroupe les sauvegardes rapprochées en une seule poussée.
export function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushState(); }, 2000);
}

// À la connexion : récupère l'état cloud et fusionne (LWW). Si le cloud est plus
// récent, on adopte l'état distant localement ; sinon on pousse le local.
export async function pullAndMerge({ onReplaced } = {}) {
    const sb = await getSupabase();
    if (!sb) return;
    const user = await currentUser(sb);
    if (!user) return;
    if (syncing) return;
    syncing = true;
    try {
        const { data, error } = await sb
            .from('user_state')
            .select('state, updated_at')
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            // Pas encore de ligne (ou lecture impossible) : on envoie le local.
            await pushState();
            return;
        }

        const remoteUpdated = data.updated_at ? Date.parse(data.updated_at) : 0;
        const localUpdated = state.updatedAt || 0;
        const remoteState = data.state;
        const remoteHasData = remoteState && typeof remoteState === 'object'
            && Object.keys(remoteState).length > 0;

        if (remoteHasData && remoteUpdated > localUpdated) {
            replaceState(remoteState);
            if (typeof onReplaced === 'function') onReplaced();
        } else {
            await pushState();
        }
    } finally {
        syncing = false;
    }
}

// Branche les déclencheurs de synchronisation. À appeler une fois, après login.
export function initSyncListeners() {
    if (initSyncListeners._done) return;
    initSyncListeners._done = true;

    // Pousse (débonce) à chaque sauvegarde locale.
    window.addEventListener('notare:state-saved', () => schedulePush());

    // Flush à la reconnexion réseau.
    window.addEventListener('online', () => {
        if (localStorage.getItem(PENDING_KEY)) pushState();
    });
}
