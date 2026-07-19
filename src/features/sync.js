// Synchronisation de l'état Notare avec le cloud (table user_state).
// Stratégie : offline-first. Le localStorage reste le cache de travail ; ce
// module pousse/tire un snapshot jsonb et résout les conflits en « dernière
// écriture gagnante » (LWW) via state.updatedAt vs user_state.updated_at.
//
// Depuis la migration 20260719160000, user_state.updated_at n'est plus écrasé
// par un trigger serveur : il porte l'horodatage d'édition fourni par le
// client, donc les deux côtés de la comparaison LWW partagent la même
// sémantique. La poussée est GARDÉE : elle ne remplace jamais un instantané
// distant plus récent (limite résiduelle : une horloge d'appareil très en
// avance peut toujours gagner — accepté pour un blob mono-utilisateur).
//
// Inerte si Supabase n'est pas configuré (getSupabase() renvoie null).

import { getSupabase } from './supabaseClient.js';
import { state, replaceState, resetStateToDefault } from '../state/store.js';

const PENDING_KEY = 'notare_sync_pending';
const LAST_USER_KEY = 'notare_last_user';
let pushTimer = null;
let syncing = false;

function markPending() {
    try { localStorage.setItem(PENDING_KEY, '1'); } catch (e) { /* quota */ }
}
function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
}
function recordLastUser(id) {
    try { localStorage.setItem(LAST_USER_KEY, id); } catch (e) { /* quota */ }
}
function lastUser() {
    try { return localStorage.getItem(LAST_USER_KEY); } catch (e) { return null; }
}

async function currentUser(sb) {
    const { data } = await sb.auth.getUser();
    return data && data.user;
}

function remoteLooksUsable(remoteState) {
    return remoteState && typeof remoteState === 'object'
        && Object.keys(remoteState).length > 0;
}

// L'UI écoute cet événement pour se redessiner quand l'état distant est adopté
// en dehors de pullAndMerge (poussée refusée car distant plus récent).
function notifyAdopted() {
    try { window.dispatchEvent(new CustomEvent('notare:remote-adopted')); } catch (e) { /* ignore */ }
}

// Pousse l'état local vers le cloud. GARDÉE : l'UPDATE ne touche la ligne que
// si l'instantané distant n'est pas plus récent ; sinon le distant est adopté
// localement au lieu d'être écrasé. Marque « en attente » si hors ligne ou en
// cas d'erreur, pour un flush ultérieur.
export async function pushState() {
    const sb = await getSupabase();
    if (!sb) return;
    const user = await currentUser(sb);
    if (!user) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        markPending();
        return;
    }
    // Changement d'utilisateur sur cet appareil : l'état local appartient à
    // l'ancien compte — ne jamais le pousser vers le nouveau (pullAndMerge
    // décide quoi en faire).
    const prev = lastUser();
    if (prev && prev !== user.id) return;

    const updatedAt = state.updatedAt || Date.now();
    const iso = new Date(updatedAt).toISOString();
    const { data, error } = await sb.from('user_state')
        .update({ state, updated_at: iso })
        .eq('user_id', user.id)
        .lte('updated_at', iso)
        .select('user_id');
    if (error) {
        markPending();
        console.warn('Sync push a échoué, réessai plus tard.', error.message);
        return;
    }
    if (data && data.length > 0) {
        clearPending();
        recordLastUser(user.id);
        return;
    }

    // Zéro ligne touchée : soit la ligne n'existe pas encore, soit le distant
    // est strictement plus récent. On relit pour trancher.
    const { data: row, error: selErr } = await sb.from('user_state')
        .select('state, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
    if (selErr) {
        markPending();
        return;
    }
    if (!row) {
        const { error: insErr } = await sb.from('user_state')
            .insert({ user_id: user.id, state, updated_at: iso });
        if (insErr) {
            markPending();
            console.warn('Sync push a échoué, réessai plus tard.', insErr.message);
        } else {
            clearPending();
            recordLastUser(user.id);
        }
        return;
    }
    // Distant plus récent : on l'adopte au lieu de l'écraser.
    clearPending();
    if (remoteLooksUsable(row.state)) {
        replaceState(row.state);
        recordLastUser(user.id);
        notifyAdopted();
    }
}

// Anti-rebond : regroupe les sauvegardes rapprochées en une seule poussée.
export function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushState(); }, 2000);
}

// À la déconnexion : oublie la poussée en attente de l'utilisateur sortant.
// LAST_USER_KEY est conservé volontairement : il protège le prochain compte
// connecté sur cet appareil contre l'adoption de données qui ne sont pas les
// siennes.
export function resetSyncState() {
    clearTimeout(pushTimer);
    pushTimer = null;
    clearPending();
}

// À la connexion : récupère l'état cloud et fusionne (LWW). Si le cloud est plus
// récent, on adopte l'état distant localement ; sinon on pousse le local (poussée
// gardée). Si l'utilisateur a changé sur cet appareil, l'état local est réputé
// appartenir à l'ancien compte : cloud = vérité, sinon état vierge.
export async function pullAndMerge({ onReplaced } = {}) {
    const sb = await getSupabase();
    if (!sb) return;
    const user = await currentUser(sb);
    if (!user) return;
    if (syncing) return;
    syncing = true;
    try {
        const userChanged = !!(lastUser() && lastUser() !== user.id);
        const { data, error } = await sb
            .from('user_state')
            .select('state, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            // Lecture impossible : la poussée gardée reste sûre (elle n'écrase
            // jamais plus récent) — sauf si l'utilisateur a changé.
            if (!userChanged) await pushState();
            return;
        }

        const remoteState = data && data.state;
        const remoteHasData = remoteLooksUsable(remoteState);
        const remoteUpdated = data && data.updated_at ? Date.parse(data.updated_at) : 0;
        const localUpdated = state.updatedAt || 0;

        if (userChanged) {
            if (remoteHasData) {
                replaceState(remoteState);
            } else {
                resetStateToDefault();
            }
            recordLastUser(user.id);
            clearPending();
            if (typeof onReplaced === 'function') onReplaced();
            return;
        }

        if (remoteHasData && remoteUpdated > localUpdated) {
            replaceState(remoteState);
            recordLastUser(user.id);
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

    // Flush à la reconnexion réseau — via pullAndMerge pour ne jamais écraser
    // un état distant plus récent sans comparaison.
    window.addEventListener('online', () => {
        if (localStorage.getItem(PENDING_KEY)) pullAndMerge();
    });
}
