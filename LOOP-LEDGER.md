# LOOP-LEDGER — Notare iOS golden-state loop

Single source of truth. Read first, update last, every iteration.
Operating manual: `LOOP-PROMPT.md`.

## Checklist scoreboard

| # | Item | Status |
|---|------|--------|
| 1 | Haptics + juice (celebration, view transition, chip fix, reduced-motion, toggle) | DONE (iter 1, `5131732`) — pending real-device haptic feel check at ship gate |
| 2 | De-slop UI (design-review 0 findings, contrast AA, tokens, breakpoints) | TODO |
| 3 | Backend hardened (schema reconcile, LWW, account deletion, site_url, advisors, sync test) | TODO |
| 4 | Perf/a11y/ship (60fps, Release build, QA, screenshots, verify) | TODO |
| 5 | Ledger evidence complete | TODO |

## Access + environment (verified 2026-07-18, session ace167fa)

- Supabase PAT + DB password + Vercel token ALL verified live. No MCP reconnect needed —
  Management API SQL via curl works (evidence: `information_schema` query HTTP 201; psql
  via pooler connects as postgres/PG 17.6). Creds: session scratchpad `notare-secrets.env`.
- Live DB pristine: profiles/user_state/grades/subjects, 0 rows, 0 auth users.
  Schema DRIFT vs repo migration 0001 (live has normalized grades/subjects).
  Auth: email-confirm ON, `site_url=http://localhost:3000` (BUG → fix to notare-swiss.ch).
- Xcode 26.6 installed; iOS 26.5 sim (iPhone 17 Pro / Pro Max).
- Baseline 2026-07-18 19:06: `npm run build` OK (sw precache 31 entries),
  `npm test` 68/68 pass (387ms).

## Iteration log

### Iteration 1 — 2026-07-18 (in progress)
- REASON: ledger created. All items red. Highest leverage = item 1 (haptics+juice):
  biggest "not native" gap, prerequisite for design-review polish gate, needs plugin
  install (serial prereq) before native build.
- Ground truth verified by grep: switchView app.js:3163 (5 call sites: 3562/3764/3829/3837),
  isPromoted app.js:344, will-change style.css:1074+4364, chip scale(1.18) style.css:1088,
  dead haptics setting migrations.js:18, confetti engine + confetti.mp3/fah.mp3 in
  src/ui/effects.js (playFah consumer app.js:3088), reduced-motion block style.css:4842.
  File sizes: app.js 3974 L, style.css 5237 L, index.html 1230 L.
- ACT: installed @capacitor/haptics@8.0.2 + cap sync; Workflow `haptics-juice`
  (wf_1a52232e-f86): 3 recon → 3 builders (file-partitioned) → 3 adversarial
  skeptics (11 confirmed findings) → fix pass (all 11 applied, incl. enter-only
  view transition, haptic-grammar unification, celebration/save haptic priority
  chain, non-native toggle hiding).
- OBSERVE (all green): vite build OK; vitest 78/78 (was 68 — +10 haptics tests);
  `xcodebuild` iphonesimulator BUILD SUCCEEDED; iPhone 17 Pro sim fresh-install
  renders landing (evidence: scratchpad/iter1-sim-fresh.png); seeded native
  Preferences v5 state (upgrade path) renders dark landing
  (iter1-sim-seeded.png); browse QA 390x844: 0 console errors (only known
  WidgetSyncPlugin web warning), onboard→dashboard, dark theme, Guide↔Mes Notes
  round-trip (view opacity settles 1, no stuck classes), reload-with-state boots
  clean (iter1-web-dark.png, iter1-web-dark-landing.png).
- INCIDENT during observe: first sim launch showed empty void (dark bg + tab bar
  only). Root-caused: stale app data from the pre-update Phase-2 install; same
  binary renders fine on fresh install AND with realistic seeded v5 state.
  Bootstrap guards (shape validation + corrupt-blob quarantine) cover bad blobs.
  Not a code regression; no band-aid applied.
- COMMIT: `5131732` feat(ios): haptics engine + native-feel motion pass.
- Known residual risks (from fix agent): year-selector show-all still fires
  hapticImpact('light') (kept deliberately); lastDashboardCelebrated only valid
  synchronously after updateDashboard; real-device haptic feel unverified until
  TestFlight.
- Blockers: none.

### Iteration 2 — next
- REASON candidates: item 2 (de-slop UI: design-review gate, contrast AA, token
  migration, breakpoints, gradient remnant) is highest leverage — item 1 polish
  gate (/design-review 0 findings) overlaps it; run them together. Item 3
  (backend) independent — can pair if capacity.
- Note: vite preview server still running on :4179 (background task bmdyjyed5);
  browse daemon warm.

## Blockers

(none)
