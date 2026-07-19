# LOOP-LEDGER — Notare iOS golden-state loop

Single source of truth. Read first, update last, every iteration.
Operating manual: `LOOP-PROMPT.md`.

## Checklist scoreboard

| # | Item | Status |
|---|------|--------|
| 1 | Haptics + juice (celebration, view transition, chip fix, reduced-motion, toggle) | DONE (iter 1, `5131732`) — pending real-device haptic feel check at ship gate |
| 2 | De-slop UI (design-review 0 findings, contrast AA, tokens, breakpoints) | DONE (iter 2, `efb5eab`) — residuals noted in iteration log |
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

### Iteration 2 — 2026-07-19 (de-slop UI) — DONE
- HISTORY: original workflow (wf_328cbcdf-774, session ace167fa) killed twice by
  usage limits + once by macOS TCC revocation. 4/9 agents finished (3 audits +
  app.js builder); style.css/index.html builders died mid-write leaving app.js
  referencing ~90 classes that didn't exist yet. TCC fixed 2026-07-19 ~13:55.
- RESUME: cross-session workflow cache unavailable → cached audit specs extracted
  from journal.jsonl to scratchpad files; hand-authored continuation workflow
  (wf_e91ac254-30b, session c59f2942): 2 reconcile-builders (style.css+theme.js /
  index.html) → build+test+class-contract gate → 2 adversarial skeptics → fix.
  6 agents, 0 errors, ~800k tokens.
- ACT highlights: ~420 inline-style sites migrated to ~90 semantic token-scale
  classes; killed-builder partial state reconciled (deletion work kept, missing
  class extractions + half-applied breakpoint merges repaired); per-theme muted/
  secondary contrast retune ≥4.5:1 hue-preserving; theme-color meta + guarded
  native StatusBar sync in applyTheme(); French elision (de/d') for student-name.
- VERIFY: gate green; skeptics confirmed 11 findings (2 critical: dead mobile
  grid override from breakpoint merge; light-theme guide status colors AA fail).
  Fix agent applied all 11 root-cause, incl. app.js updateTabVisibility inline
  display:flex pin that defeated mobile grid rules (found beyond spec). Deviation:
  navy failing-red #fa8b8b not proposed #f87171 (#f87171 = 4.13:1 on formula-box
  #273a5a; #fa8b8b = 4.96 there, 6.16–8.64 elsewhere).
- OBSERVE (all green): vite build OK (33 precache); vitest 78/78; cap sync OK;
  xcodebuild -project App.xcodeproj sim iPhone 17 Pro exit 0, 0 errors (NOTE:
  App.xcworkspace does not exist — SPM/CapApp-SPM project, use -project);
  browse QA 390x844 both themes: landing/dashboard/guide screenshots clean
  (scratchpad iter2-*.png, session c59f2942), elision renders "d'Étudiant",
  dynamic theme-color #fcfbf9 light, scrollWidth 390 (no overflow), console
  clean except known WidgetSyncPlugin web warning.
- COMMIT: `efb5eab` refactor(ui): de-slop pass.
- Known residuals (from builders/fix agents): StatusBar hook dormant until
  @capacitor/status-bar installed + cap-synced; muted-token lift slightly
  lightens a few non-text var(--color-text-muted) uses (slider bg ~style.css:3904);
  elision regex treats aspirated-h names as eliding (d'Hugo — rare, acceptable);
  hover-affordance fixes + ::placeholder-adjacent audit items §3.4/§2/§5/§6
  partially deferred as outside census mandate; safe-area env() = 0 in headless —
  eyeball notch padding once on simulator at ship gate.

### Iteration 3 — next
- REASON: item 3 (backend hardening) — schema reconcile repo↔live, LWW timestamp
  clobber fix, account-deletion RPC + "Supprimer mon compte" UI, auth
  site_url=localhost→notare-swiss.ch, advisors pass, sync integration test.
  Management API via curl + PAT (creds: session-ace167fa scratchpad
  notare-secrets.env, chmod 600, verified 2026-07-18).
- Item 4 (perf/a11y/ship) after; then item 5 ledger close-out.

## Blockers

(none)
