-- Notare — schéma initial (baseline du projet live).
-- Reconstruit le 2026-07-19 depuis le catalogue Postgres du projet de
-- production (migration live `20260716145842 init_schema`), afin que le dépôt
-- reproduise exactement l'état déployé. Remplace l'ancien brouillon
-- `0001_profiles_and_state.sql` (profiles + user_state uniquement).
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
    constraint profiles_nom_non_vide    check (length(btrim(nom))    > 0),
    constraint profiles_prenom_non_vide check (length(btrim(prenom)) > 0)
);

comment on table public.profiles is 'Profils utilisateurs Notare (PII — protégé par RLS).';

-- ---------------------------------------------------------------------------
-- 2. État applicatif par utilisateur (snapshot jsonb, LWW côté client).
-- ---------------------------------------------------------------------------
create table if not exists public.user_state (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    state       jsonb not null default '{}'::jsonb,
    version     integer not null default 1,
    updated_at  timestamptz not null default now()
);

comment on table public.user_state is 'Snapshot de l''état Notare (gymnase_vaud_state) par utilisateur.';

-- ---------------------------------------------------------------------------
-- 3. Branches et notes normalisées (modèle cible ; non consommé par le client
--    v1, qui synchronise le snapshot user_state).
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
    id          uuid primary key,
    user_id     uuid not null,
    name        text not null,
    target      numeric default 4.5,
    mode        text default 'dual',
    year        smallint not null,
    grade_group smallint,
    deleted     boolean default false,
    updated_at  timestamptz default now(),
    constraint subjects_target_check      check (target >= 1 and target <= 6),
    constraint subjects_mode_check        check (mode in ('dual', 'standard')),
    constraint subjects_year_check        check (year >= 1 and year <= 3),
    constraint subjects_grade_group_check check (grade_group in (1, 2))
);

create table if not exists public.grades (
    id         uuid primary key,
    subject_id uuid not null references public.subjects(id) on delete cascade,
    user_id    uuid not null,
    semester   text not null,
    name       text,
    value      numeric not null,
    type       text,
    comment    text,
    exam_date  date,
    photo_path text,
    deleted    boolean default false,
    updated_at timestamptz default now(),
    constraint grades_semester_check check (semester in ('sem1', 'sem2')),
    constraint grades_value_check    check (value >= 1 and value <= 6),
    constraint grades_type_check     check (type in ('TS', 'TA'))
);

create index if not exists subjects_user_id_updated_at_idx on public.subjects (user_id, updated_at);
create index if not exists grades_user_id_updated_at_idx   on public.grades (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security — chaque utilisateur ne voit/écrit QUE ses lignes.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_state enable row level security;
alter table public.subjects   enable row level security;
alter table public.grades     enable row level security;

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

create policy "own rows" on public.subjects
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.grades
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Horodatage automatique de updated_at.
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
-- 6. Création automatique du profil à l'inscription.
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
