# Notare iOS — Golden-State Build Loop (operating manual)

Autonomous self-paced /loop on branch `feat/ios-appstore-notare`. Drive the app to
production-grade quality using ReAct + gstack skill methods + Workflow fan-out.
Iterate until the EXIT CHECKLIST is 100% green, then stop the loop (ScheduleWakeup{stop})
and post a final report.

**STATE:** `LOOP-LEDGER.md` at repo root is the single source of truth. Read it FIRST each
iteration, update it LAST (done items + evidence, next item, blockers).

## Each iteration = one ReAct cycle

1. **REASON** — read `LOOP-LEDGER.md` + `git log --oneline -15`. Score state vs EXIT
   CHECKLIST. Pick the ONE highest-leverage incomplete item. Finding without root cause →
   /investigate method first. No band-aids, no whack-a-mole.
2. **ACT** — launch ONE Workflow fanning out parallel subagents for that workstream, each
   following the named gstack skill method. Partition by file to avoid conflicts (worktree
   isolation only if same-file concurrent edits unavoidable). Always an adversarial verify
   stage + a synthesize/fix stage.
3. **OBSERVE** — `npm run build` + `npm test` (68+ must pass), then real surface:
   webview QA (viewport 390x844, 0 console errors) AND
   `npx cap sync ios` + `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO build`
   + launch on sim + screenshot. Not done until observed working.
4. **COMMIT** — atomic Conventional Commit to `feat/ios-appstore-notare`. **NEVER push**
   (esp. never pranathi/main = prod). Update `LOOP-LEDGER.md` with evidence.
5. **PACE** — ScheduleWakeup (prompt: `/loop` + pointer to this file). Long fallback
   (1200–1800s) when a Workflow/notification is the real wake signal.
   `ScheduleWakeup{stop}` ONLY when EXIT CHECKLIST fully green.

## Workstreams

- **FRONTEND/HAPTICS** — `@capacitor/haptics` wired at all interaction points (grade save,
  add subject, switchView, chips, slider, gem tap, toggles, modals, promotion reveal);
  promotion-success celebration (confetti + success haptic + sound, fires on transition
  into promoted state, not every render) on `results.isPromoted` (app.js:344);
  switchView (app.js:3163) display hard-swap → reduced-motion-aware view transition
  (NO View Transitions API dependency — iPhone 8 = iOS 16.7 max; CSS class-based);
  chip hover scale(1.18) (style.css:1088) → :active pattern; persistent will-change
  removed (style.css:1074, check 4364); dead `haptics: true` setting
  (src/state/migrations.js:18) wired to real French settings toggle. Existing assets:
  confetti engine + confetti.mp3/fah.mp3 in `src/ui/effects.js`; global reduced-motion
  block style.css:4842. Verify: /qa + /verify methods; polish gate /design-review.
- **DE-SLOP UI** — /design-review (anti-slop) method. Migrate worst inline styles
  (298 in index.html, 99 in app.js) to token scale (--space/--radius/--shadow);
  --color-text-muted → ≥4.5:1 AA + contrast AA throughout; consolidate breakpoints;
  remove gradient-text remnant (index.html:98); status-bar theme-color per theme
  (index.html:14/17).
- **BACKEND** — NO Supabase MCP needed. Full access verified 2026-07-18 via Management
  API curl + PAT; creds chmod-600 in session scratchpad `notare-secrets.env`
  (SUPABASE_PAT, SUPABASE_DB_PASSWORD, SUPABASE_URL, VERCEL_TOKEN). SQL:
  `POST https://api.supabase.com/v1/projects/ninnbjsonibeurseztai/database/query`
  (Bearer PAT). Live DB: profiles/user_state/grades/subjects, 0 rows, 0 users (pristine —
  safe to reshape). Repo migration `supabase/migrations/0001` ≠ live `20260716145842
  init_schema` (drift: live has normalized grades/subjects app never uses). Tasks:
  reconcile schema drift; fix LWW bug (client `state.updatedAt` clobbered by
  `now()` trigger, migration:83-85 — compare on client-owned field); account-deletion
  RPC/edge-function + "Supprimer mon compte" UI (App Store 5.1.1(v)); auth `site_url`
  is `http://localhost:3000` → fix to `https://www.notare-swiss.ch`; advisors
  (security+performance) → 0 critical; integration test login→edit→push→pull.
  /review method on every SQL diff.
- **PERF/A11Y/SHIP** — 60fps on iPhone 8 profile (no persistent will-change, cheap
  paints); benchmark web vitals on webview; a11y (≥44pt targets, focus states, aria);
  Release xcodebuild SUCCEEDED; refresh 6.9" screenshots (1320x2868, iPhone 17 Pro Max);
  /verify + /canary methods.

## EXIT CHECKLIST (all green → stop)

- [ ] 1. Haptics wired at all mapped points + promotion celebration + view transition;
        reduced-motion honored; haptics setting toggle live
- [ ] 2. /design-review method returns 0 AI-slop findings; contrast AA throughout;
        worst inline-style offenders tokenized; breakpoints consolidated
- [ ] 3. Supabase: schema reconciled + migration applied; LWW fixed; account deletion
        shipped (RPC + UI); site_url fixed; advisors 0 critical; sync integration test passes
- [ ] 4. 60fps interactions; Release xcodebuild SUCCEEDED; 68+ tests pass; webview QA
        0 console errors; 6.9" screenshots refreshed; /verify green
- [ ] 5. LOOP-LEDGER.md shows every item done WITH evidence (screenshots, test output,
        advisor results, before/after)

## Guardrails

- Root cause before fix (/investigate method); no temporary band-aids.
- No AI slop in code or UI — /design-review + /review methods gate every change.
- **Never push to any remote.** Commit to feat branch only.
- Verify on the real surface before every commit (webview + simulator, not just unit tests).
- Blocked 3× on one item → stop, write blocker to ledger, ask user.
- French UI copy (Swiss Vaud gymnasium app) — new UI strings in French.
