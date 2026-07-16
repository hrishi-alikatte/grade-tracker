-- Notare — schéma initial (profils + état applicatif par utilisateur).
-- Conçu pour Supabase (Postgres 17). NON APPLIQUÉ automatiquement : à exécuter
-- via `apply_migration` sur le projet Supabase choisi, après validation.
--
-- Champs profil :
--   Obligatoires (à l'inscription, NOT NULL) : nom, prenom, email (unique).
--   Optionnels (page « Profil ») : canton, nom_ecole, telephone, date_naissance.

-- ---------------------------------------------------------------------------
-- 1. Table des profils, liée 1:1 à auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id             uuid primary key references auth.users(id) on delete cascade,
    nom            text not null,
    prenom         text not null,
    email          text not null unique,
    canton         text,
    nom_ecole      text,
    telephone      text,
    date_naissance date,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    -- Garde-fous : les champs obligatoires ne peuvent pas être vides.
    constraint profiles_nom_non_vide    check (length(btrim(nom))    > 0),
    constraint profiles_prenom_non_vide check (length(btrim(prenom)) > 0)
);

comment on table public.profiles is 'Profils utilisateurs Notare (PII — protégé par RLS).';

-- ---------------------------------------------------------------------------
-- 2. État applicatif par utilisateur (synchronisation cloud du localStorage).
--    Snapshot jsonb + horodatage pour une résolution de conflit « dernière
--    écriture gagnante » (LWW) côté client. localStorage reste le cache hors
--    ligne ; ce blob est la source de vérité en ligne.
-- ---------------------------------------------------------------------------
create table if not exists public.user_state (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    state       jsonb not null default '{}'::jsonb,
    version     integer not null default 1,
    updated_at  timestamptz not null default now()
);

comment on table public.user_state is 'Snapshot de l''état Notare (gymnase_vaud_state) par utilisateur.';

-- ---------------------------------------------------------------------------
-- 3. Row Level Security — chaque utilisateur ne voit/écrit QUE sa ligne.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_state enable row level security;

create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
    for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);
-- Pas de policy DELETE : la suppression passe par la cascade auth.users.

create policy "user_state_select_own" on public.user_state
    for select using (auth.uid() = user_id);
create policy "user_state_insert_own" on public.user_state
    for insert with check (auth.uid() = user_id);
create policy "user_state_update_own" on public.user_state
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Horodatage automatique de updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger user_state_set_updated_at
    before update on public.user_state
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Création automatique du profil à l'inscription.
--    nom/prenom proviennent des métadonnées d'inscription (options.data),
--    email de auth.users. security definer pour écrire malgré la RLS.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, nom, prenom, email)
    values (
        new.id,
        btrim(coalesce(new.raw_user_meta_data->>'nom', 'Utilisateur')),
        btrim(coalesce(new.raw_user_meta_data->>'prenom', 'Notare')),
        new.email
    )
    on conflict (id) do nothing;

    insert into public.user_state (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
