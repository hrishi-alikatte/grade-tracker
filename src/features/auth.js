// Authentification (email + mot de passe) via Supabase Auth.
// Toutes les fonctions dégradent proprement si Supabase n'est pas configuré :
// elles lèvent une erreur explicite (pour les actions) ou renvoient null (pour
// les lectures), afin que l'UI puisse rester désactivée.

import { getSupabase, isSupabaseConfigured } from './supabaseClient.js';

export { isSupabaseConfigured };

const NON_CONFIG = "Le mode connecté n'est pas encore configuré.";

// Inscription : nom + prénom obligatoires, transmis dans les métadonnées pour
// que le trigger `handle_new_user` crée le profil. Email de confirmation activé
// côté projet Supabase (l'utilisateur devra valider son adresse).
export async function signUp({ email, password, nom, prenom }) {
    const sb = await getSupabase();
    if (!sb) throw new Error(NON_CONFIG);
    return sb.auth.signUp({
        email,
        password,
        options: { data: { nom, prenom } },
    });
}

export async function signIn({ email, password }) {
    const sb = await getSupabase();
    if (!sb) throw new Error(NON_CONFIG);
    return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
    const sb = await getSupabase();
    if (!sb) return;
    return sb.auth.signOut();
}

export async function getSession() {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
}

export async function getProfile() {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data: userData } = await sb.auth.getUser();
    const user = userData && userData.user;
    if (!user) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) return null;
    return data;
}

// Met à jour les champs optionnels du profil (page Profil).
export async function updateProfile(fields) {
    const sb = await getSupabase();
    if (!sb) throw new Error(NON_CONFIG);
    const { data: userData } = await sb.auth.getUser();
    const user = userData && userData.user;
    if (!user) throw new Error('Non connecté.');
    return sb.from('profiles').update(fields).eq('id', user.id);
}

// Abonnement aux changements de session. Renvoie une fonction de désabonnement.
export async function onAuthStateChange(callback) {
    const sb = await getSupabase();
    if (!sb) return () => {};
    const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
}
