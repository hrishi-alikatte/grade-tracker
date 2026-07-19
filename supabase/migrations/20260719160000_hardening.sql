-- Notare — durcissement backend (appliqué au projet live le 2026-07-19).
--
-- Contenu :
--   1. FKs manquantes subjects/grades.user_id → auth.users (cascade compte).
--   2. Index couvrant la FK grades.subject_id (advisor performance).
--   3. Triggers updated_at sur subjects/grades (parité profiles/user_state).
--   4. LWW : user_state.updated_at redevient l'horodatage d'édition fourni par
--      le client — le trigger serveur l'écrasait à chaque push, ce qui cassait
--      la comparaison « dernière écriture gagnante » côté client (horloge
--      serveur comparée à une horloge d'appareil).
--   5. search_path épinglé sur set_updated_at (advisor sécurité).
--   6. handle_new_user réservé au trigger — plus d'exécution via l'API REST
--      (advisor sécurité).
--   7. Politiques RLS recréées avec (select auth.uid()) — initplan unique par
--      requête au lieu d'une évaluation par ligne (advisor performance).
--   8. delete_my_account() : suppression de compte en libre-service, exigence
--      App Store 5.1.1(v). SECURITY DEFINER, search_path épinglé, réservée au
--      rôle authenticated ; la cascade auth.users nettoie toutes les données.

-- 1. Intégrité référentielle vers auth.users -------------------------------
alter table public.subjects
    add constraint subjects_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.grades
    add constraint grades_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- 2. Index FK (advisor performance) ----------------------------------------
create index if not exists grades_subject_id_idx on public.grades (subject_id);

-- 3. updated_at automatique sur les tables normalisées ---------------------
create trigger subjects_set_updated_at
    before update on public.subjects
    for each row execute function public.set_updated_at();

create trigger grades_set_updated_at
    before update on public.grades
    for each row execute function public.set_updated_at();

-- 4. user_state : le client est l'autorité sur updated_at (LWW) ------------
drop trigger if exists user_state_set_updated_at on public.user_state;

-- 5. search_path épinglé (advisor sécurité) --------------------------------
alter function public.set_updated_at() set search_path = '';

-- 6. handle_new_user : exécution réservée au trigger auth ------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 7. RLS : auth.uid() en initplan (advisor performance) --------------------
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select using ((select auth.uid()) = id);
drop policy "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
    for insert with check ((select auth.uid()) = id);
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy "user_state_select_own" on public.user_state;
create policy "user_state_select_own" on public.user_state
    for select using ((select auth.uid()) = user_id);
drop policy "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own" on public.user_state
    for insert with check ((select auth.uid()) = user_id);
drop policy "user_state_update_own" on public.user_state;
create policy "user_state_update_own" on public.user_state
    for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.subjects;
create policy "own rows" on public.subjects
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.grades;
create policy "own rows" on public.grades
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 8. Suppression de compte en libre-service (App Store 5.1.1(v)) -----------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'delete_my_account: utilisateur non authentifié';
    end if;
    -- Les FKs ON DELETE CASCADE (profiles, user_state, subjects, grades)
    -- suppriment toutes les données applicatives avec le compte.
    delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 9. La ligne user_state pré-créée à l'inscription est horodatée à l'époque
--    UNIX (= « jamais poussé »). Avec now(), la ligne vide était plus récente
--    que toute édition locale antérieure à l'inscription : la poussée gardée
--    du client était refusée et les données locales ne montaient jamais.
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

    insert into public.user_state (user_id, updated_at)
    values (new.id, to_timestamp(0))
    on conflict (user_id) do nothing;

    return new;
end;
$$;
