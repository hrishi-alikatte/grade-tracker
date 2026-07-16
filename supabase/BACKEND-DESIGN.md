# Notare — conception backend (Supabase)

Statut : **conçu, non appliqué.** Le schéma vit dans `migrations/0001_profiles_and_state.sql`.
Rien n'est écrit sur Supabase ni déployé tant que l'utilisateur n'a pas validé
le projet cible et fourni les clés.

## Schéma
- `public.profiles` (1:1 avec `auth.users`) — nom/prenom/email obligatoires ;
  canton/nom_ecole/telephone/date_naissance optionnels. Contraintes `check`
  contre les valeurs vides sur les champs obligatoires.
- `public.user_state` — snapshot `jsonb` de l'état Notare (`gymnase_vaud_state`)
  par utilisateur + `version` + `updated_at` pour LWW.
- RLS activée sur les deux tables : chaque utilisateur ne lit/écrit que sa ligne
  (`auth.uid() = id` / `= user_id`).
- Triggers : `updated_at` auto ; `handle_new_user` crée profil + user_state à
  l'inscription (nom/prenom depuis `options.data`).

## Auth (email + mot de passe)
- **Inscription** : email, mot de passe, nom, prenom (obligatoires). nom/prenom
  passés dans `supabase.auth.signUp({ options: { data: { nom, prenom } } })`.
- **Connexion** : `signInWithPassword`.
- Confirmation e-mail : à décider (activée = plus sûr ; désactivée = onboarding
  sans friction). Recommandé : activée en prod.

## Intégration client (app vanilla)
- Dép : `@supabase/supabase-js` (importé dynamiquement pour ne pas peser sur le
  premier rendu — cohérent avec le budget perf de la Phase 1).
- `src/features/auth.js` : wrapper (signUp / signIn / signOut / session).
- `src/features/sync.js` : synchro état.
  - Au login : télécharger `user_state`, fusionner avec le localStorage local
    par `updated_at` (LWW), écrire le gagnant des deux côtés.
  - À chaque `saveState()` : debounce ~2 s puis upsert `user_state` si en ligne.
  - Hors ligne : localStorage seul ; flush à la reconnexion (`online` event).
- Vues FR : modales « Inscription » / « Connexion » ; page « Profil » (champs
  optionnels) ; « Se déconnecter ».

## Variables d'environnement (Vite)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
(anon key uniquement côté client — jamais la service_role. RLS protège les données.)

## À valider par l'utilisateur avant application
1. Projet Supabase cible (aucun projet « notare » n'existe aujourd'hui).
2. Autorisation d'exécuter la migration (`apply_migration`).
3. Fourniture / génération des clés + ajout aux env Vercel.
4. Confirmation e-mail activée ou non.
