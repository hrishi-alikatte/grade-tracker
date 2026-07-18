# LOOP-LEDGER — Notare iOS golden-state loop

Single source of truth. Read first, update last, every iteration.
Operating manual: `LOOP-PROMPT.md`.

## Checklist scoreboard

| # | Item | Status |
|---|------|--------|
| 1 | Haptics + juice (celebration, view transition, chip fix, reduced-motion, toggle) | IN PROGRESS (iter 1) |
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
- ACT: install @capacitor/haptics + cap sync; Workflow `haptics-juice` fan-out
  (recon 3 → build 3 file-partitioned → adversarial verify 3 → fix).
- OBSERVE: pending workflow completion.
- Blockers: none.

## Blockers

(none)
