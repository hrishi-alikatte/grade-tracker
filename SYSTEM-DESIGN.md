# System Design: GradeVibe Cloud Sync (Supabase)

Scope: add accounts + multi-device sync to the existing vanilla-JS PWA, keeping it offline-first.
Priorities: low cost, fast to ship, room to scale. Target: one school, ~1k users.

## 1. Requirements

**Functional**
- Sign in (email OTP / magic link — no passwords to manage)
- Sync subjects, grades, settings across devices; grade photos included
- Works fully offline; syncs when back online
- One-time migration of existing `localStorage` data on first login
- Anonymous/local-only mode keeps working (no forced accounts)

**Non-functional**
- Cost: free tier for as long as possible
- Ship: no custom server, no build step change — `supabase-js` via CDN
- Scale: 1k users comfortably; path to 10k without redesign
- Privacy: student grades are sensitive — strict per-user isolation, EU region hosting

**Constraints**
- Solo developer, vanilla JS codebase (app.js ~4.2k lines), no framework
- Current persistence: `localStorage['gymnase_vaud_state_v5']` + photos in IndexedDB

## 2. High-Level Architecture

```
┌────────────── Browser (PWA) ──────────────┐
│  UI (app.js)                              │
│    │ reads/writes (unchanged)             │
│  local store: localStorage + IndexedDB    │
│    │                                      │
│  sync.js (new, ~300 lines)                │
│   ├─ outbox queue (IndexedDB)             │
│   ├─ pull on start/login (updated_at >)   │
│   └─ push on mutation + 'online' event    │
└──────┬────────────────────────────────────┘
       │ supabase-js (HTTPS, JWT)
┌──────▼──── Supabase (EU region) ──────────┐
│  Auth (email OTP)                         │
│  Postgres + RLS  (subjects, grades,       │
│                   user_settings)          │
│  Storage bucket: grade-photos (RLS)       │
└───────────────────────────────────────────┘
```

No custom API server. The Supabase client talks straight to Postgres through PostgREST; Row-Level Security is the authorization layer.

## 3. Data Model

```sql
-- profiles: 1 row per auth user
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  student_name text default 'Étudiant',
  settings jsonb default '{}',        -- theme, isLightTheme, displayMode
  updated_at timestamptz default now()
);

create table subjects (
  id uuid primary key,                -- client-generated (keeps offline creation simple)
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  target numeric(2,1) default 4.5 check (target between 1 and 6),
  mode text default 'dual' check (mode in ('dual','standard')),
  year smallint not null check (year between 1 and 3),
  grade_group smallint check (grade_group in (1,2)),
  deleted boolean default false,      -- soft delete (sync-friendly)
  updated_at timestamptz default now()
);

create table grades (
  id uuid primary key,                -- client-generated
  subject_id uuid not null references subjects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  semester text not null check (semester in ('sem1','sem2')),
  name text,
  value numeric(2,1) not null check (value between 1 and 6),
  type text check (type in ('TS','TA')),
  comment text,
  exam_date date,
  photo_path text,                    -- storage path, null if none
  deleted boolean default false,
  updated_at timestamptz default now()
);

create index on subjects (user_id, updated_at);
create index on grades (user_id, updated_at);
```

**RLS (identical pattern on all three tables):**
```sql
alter table grades enable row level security;
create policy "own rows" on grades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Storage**: bucket `grade-photos`, private. Path convention `{user_id}/{grade_id}.webp`; policy allows read/write only where the first path segment equals `auth.uid()`. Client compresses camera captures to WebP ≤200KB before upload (canvas re-encode — already has a canvas pipeline for OCR).

## 4. Sync Design

Offline-first, localStorage stays the UI's source of truth. The sync layer is additive — app.js render code doesn't change.

- **Write path**: every `saveState()` also appends changed rows to an **outbox** (IndexedDB). A flusher upserts outbox rows to Supabase on: mutation (debounced 2s), `online` event, and app start.
- **Read path**: on start/login, pull rows `where updated_at > last_sync_cursor`, merge into local state, re-render.
- **Conflict resolution**: last-write-wins per row on `updated_at`. Acceptable because a single student edits their own data; cross-device races are rare and low-stakes.
- **Deletes**: soft-delete flag (`deleted = true`) so deletions propagate; purge job optional later.
- **IDs**: client-generated UUIDs (`crypto.randomUUID()`) so offline creation needs no server round-trip. Replaces current `Date.now()`-style ids during migration.
- **Migration**: on first login, if `gymnase_vaud_state_v5` exists → transform blob to rows, bulk upsert, upload IndexedDB photos, then mark migrated. Keep the local blob as cache.

## 5. Load & Cost Estimation

| Metric | Estimate |
|--------|----------|
| Users | 1,000 |
| Rows | ~12 subjects × 3 years × ~10 grades ≈ 400 rows/user → ~400k rows total (tiny for Postgres) |
| DB size | « 500MB free-tier limit |
| Photos | The real constraint: at 200KB × ~50 photos/user × 1k users ≈ 10GB worst case |
| Traffic | Peak after exam results: ~200 concurrent, a few requests each — trivial |

**Cost**: Free tier ($0) covers DB/auth/API for 1k users. Photo storage exceeds the 1GB free limit if adoption of photos is high → Supabase Pro at $25/mo (100GB storage) is the single expected cost. Mitigation if staying free matters: cap photos per user or compress harder (~80KB).

## 6. Trade-offs

| Decision | Chosen | Trade-off |
|----------|--------|-----------|
| No custom server (RLS as auth layer) | ✅ | Fastest to ship, zero ops; business rules live client-side — fine since users can only corrupt their own data |
| Last-write-wins sync | ✅ | Simple; loses concurrent edits across devices (rare, single-owner data). CRDTs not justified |
| Client-generated UUIDs | ✅ | Offline-safe; must validate format server-side (Postgres uuid type does) |
| Soft deletes | ✅ | Sync-correct; table grows — add periodic purge if needed |
| Email OTP only | ✅ | No password resets to support; requires email access at school |
| Skip Supabase Realtime in v1 | ✅ | One student rarely uses two devices simultaneously; add later for teacher-sharing features |

## 7. Revisit When Growing

- **10k+ users / canton-wide**: move photo uploads behind signed URLs with size enforcement via Edge Function; add rate limiting; consider per-school tenancy (`school_id` column + RLS by membership).
- **Teacher/parent sharing**: introduce `share_grants` table + RLS `exists` policies — schema above already supports it (that's why `user_id` is on `grades`, not just `subjects`).
- **Analytics** (class averages): Postgres views or a nightly materialized view; never client-side aggregation across users.

## 8. Ship Plan (order of work)

1. Supabase project (EU), run schema + RLS migration, create storage bucket
2. `sync.js`: outbox + pull/merge + auth UI (one modal, magic-link)
3. Migration path from localStorage/IndexedDB
4. QA: airplane-mode test matrix (create/edit/delete offline → reconnect)
5. Keep `test_calculator.js` green — calculation logic is untouched by all of this
