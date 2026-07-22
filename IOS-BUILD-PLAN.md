# Notare iOS — Remediation Plan (grounded)

Source: `IOS-DESIGN-AUDIT.md` + 7-agent code-grounding pass (`app.js`, `index.html`, `style.css`, `src/state/*`).
Principle: **no calculation logic changes** — CSS, copy, DOM structure, and one chart-render bug only. Every change below cites a real line.

### Build progress
- [x] **1 · Safe-area top** (P0) — folded into #2: restored sticky top bar owns `env(safe-area-inset-top)` (the intended architecture). `--safe-*` tokens added. Green.
- [x] **2 · Bottom-nav split** (P1, L) — CSS-only: `.top-nav-bar` sticky top (brand + 3 action icons); `.nav-tabs` fixed bottom tab bar (icon-over-label); `--bottom-nav-h` token reserves scroll space; deleted conflicting ≤600px block; dead `.nav-tabs-wrapper` gone. No JS change. Green.
- [x] **5 · French register → vous** — `app.js:488/538`, `index.html:1117`. Green.
- [x] **6 · Brand casing + Mode label** — prose/alt `notare`→`Notare` ×6, `Mode Gemmes`→`Mode Visuel (Gemmes)`. Hero logotype (index.html:91) left as deliberate design decision. Green.
- [x] **4 · Charts gap+clip+size** (P1, M) — real bug fixed: per-year slots always present, X by real index, line breaks across gaps, hollow "—" marker for empty years, canvas 640×260, theme-visible grid, `promo-limit-line`/`-text` classes for both-theme visibility. Splice via line-range. Green.
- [x] **3 · Chip selector** (P1, M) — CSS `--pill-color` state model (filled active / outline unselected), uniform 40px, native `.chart-filter-btn` actions, left-aligned wrap, light-theme fill-text `#fff`. Listeners/IDs preserved. Green.
- [x] **7 · Card tokens + Groupe wrap** (P2, M) — stuck light `.subject-card:hover` black-border bug fixed (was `var(--color-text-primary)`), unified `--card-*` tokens both themes, `.bilan-card-title` nowrap + theme-aware color (was hardcoded `white`), grade badges routed through `--color-avg-*`. Green.
- [x] **6b · Name placeholder** — `studentName` default `''` (store.js/migrations.js), blur→'', `#student-name:empty::before` italic "votre prénom" placeholder, profile tooltip "Espace personnel". Updated 2 auth tests to assert `''` (match "empty profile" intent). Green.

**BUILD COMPLETE — 7/7 clusters, 91/91 tests, build clean.**

- [x] **QA** — gstack browse, iPhone-15 393×852, both themes. Verified live: safe-area top clearance, bottom tab bar (no clipping — semester tabs now fully visible), sticky top action bar, chip filled/outline + native action buttons, **evolution chart shows all 3 year slots** (2ème année empty→dashed "—" marker + gap connector, was collapsing to 2 points), no stuck-black card borders, name placeholder (empty→"votre prénom", set→"Pranathi"), Notare casing, Mode Visuel (Gemmes). No JS errors.
  - **QA-found bug FIXED:** `.top-nav-bar` `backdrop-filter` made it the containing block for its `position:fixed` child → the "bottom" tab bar anchored to the top bar. Fix: drop backdrop-filter on the mobile top bar (opaque bg). Re-verified: tab bar now at viewport bottom (y=794).
- [x] **Review** — gstack `/review` + focused adversarial pass on logic diff: **no real defects**. Removed one dead `hexToRgb`. Build+tests green.
- [x] **Ship** — `npx cap sync ios` (web assets → iOS project); committed `2983c38`; pushed `feat/ios-appstore-notare`; opened **PR #1 → main** (no merge). https://github.com/hrishi-alikatte/grade-tracker/pull/1

**PIPELINE COMPLETE: review → plan → build → review → qa → ship. 8 clusters + 1 QA bug fixed, 91/91 tests, verified live both themes, PR open awaiting sign-off.**

## Sequencing (dependency-aware)

| # | Cluster | Sev | Effort | Files |
|---|---------|-----|--------|-------|
| 1 | Safe-area top inset | P0 | S | style.css |
| 2 | Bottom nav split + clearance | P1 | L | style.css, index.html |
| 3 | Chip selector system | P1 | M | app.js, style.css |
| 4 | Chart fixes (gap + clip + size) | P1 | M | app.js, style.css |
| 5 | French register → vous | P2 | S | app.js, index.html |
| 6 | Brand casing + name placeholder + Mode Gemmes | P2 | M | index.html, app.js, src/state/* |
| 7 | Card token system + Groupe-N wrap + grade tokens | P2 | M | style.css |

Build order: **1 → 2 → 4 → 3 → 6 → 5 → 7** (safe-area first unblocks visual QA; nav+charts share the bottom-clearance token so do them adjacent; copy/token cleanups last).

---

## 1. Safe-area top (P0 · S)
Add `--safe-*` tokens in `:root`, consume top inset on the mobile scroll root.
- `style.css:3495` (`@media max-width:768px { body }`): top padding `0.75rem` → `calc(0.75rem + env(safe-area-inset-top))`.
- Add `:root { --safe-top: env(safe-area-inset-top); --safe-bottom: env(safe-area-inset-bottom); }` for reuse.
- Capacitor: keep overlaying webview (do NOT `setOverlaysWebView(false)` — would double-count). Optional Info.plist `UIStatusBarStyle` polish only.

## 2. Bottom nav split (P1 · L)
Root: single `.top-nav-bar` (index.html:48-81) carries brand + tabs + icons; on mobile it becomes `fixed;bottom:0` stacked in a column (style.css:2406-2427) and a **second `@media 600px` block (3776-3791)** fights it.
- Add token `--bottom-nav-h: calc(56px + env(safe-area-inset-bottom))`.
- `@media 640px .top-nav-bar`: row layout, `height:var(--bottom-nav-h)`, `justify-content:space-around`.
- In bottom bar show **only** `.nav-tabs`; `display:none` for `.top-nav-brand` + `.nav-icons`; make `.nav-tab-btn` icon-over-label tab items.
- Move brand + 3 icons to a `sticky;top:0` top header on mobile (same IDs, CSS container only — no JS change).
- Reserve space: mobile `body { padding-bottom: calc(var(--bottom-nav-h) + 1rem); scroll-padding-bottom: var(--bottom-nav-h); }`.
- **Delete** the conflicting `@media 600px` bar overrides (3776-3791).

## 3. Chip selector (P1 · M)
Drive state from a single `--pill-color` custom prop; selected = FILLED, unselected = OUTLINE.
- `app.js:1047-1055`: emit `<button class="filter-pill" style="--pill-color:${sub.color}">` + `.pill-dot`; drop inline border/bg.
- `app.js:1039-1045`: replace inline header + literal `|` with `.chart-filters-head` / `.chart-filters-actions` + real buttons.
- `style.css:1310-1343`: uniform `height:40px`; `.active` filled with `var(--pill-color)` + white text/dot; neutral unselected dot; color-hinted hover.
- `style.css:1383-1402` `.btn-chart-control` → `.chart-filter-btn` native pill (kill `text-decoration:underline`).
- `style.css:3812-3818` + `3473-3476`: sync mobile padding; fix light-theme `.active` text to `#fff` (was forced dark → unreadable on fill).
- `.chart-filters` (5406-5413): `justify-content:flex-start` (or grid `auto-fill minmax(120px,1fr)`) to kill the ragged center-stagger.

## 4. Charts (P1 · M)
Fix misleading 2-of-3 gap + footer clip + tiny size.
- `app.js:1229-1285`: build fixed year slots (Y1/Y2/Y3 + repeats) always present, `val=null` when empty; X from slot index over `slots.length` (not filtered count).
- `app.js:1315-1325`: break the connecting line across null gaps (new `M` after a null), optional dashed connector.
- `app.js:1361-1374`: hollow "pas de données" marker + label for null slots; year label under every slot.
- `app.js:1328/1304/1369/1374`: viewBox → `0 0 640 260`, mapY span `30..210`, label fonts 11→13 / 10→12.
- `style.css:4197-4205`: `.evo-graph-wrapper` min-height 200→260.
- Bottom clearance handled by #2's `--bottom-nav-h`.

## 5. French register → vous (P2 · S)
- `app.js:488`: `tes points` → `vos points`.
- `app.js:538`: `tes points` → `vos points`.
- `index.html:1117`: `Exporte tes notes…restaure` → `Exportez vos notes…restaurez`.
- Leave user-editable slangy `badGradeMessages` (app.js:3138/3599) as intentional.

## 6. Brand + placeholder + Mode Gemmes (P2 · M)
- Capitalize prose/alt brand: index.html `140,153,166` (alt), `123`, `280`, `995`, `998` (keep Latin verb *notare* italic-lowercase inside the parenthetical). **Landing hero (index.html:91) lowercase `notare` = deliberate logotype — flag as design decision, not auto-changed.**
- Empty-name state: `src/state/store.js:24,97` default `''`; `src/state/migrations.js:49` drop backfill; `app.js:319` blur → `''`; render `''` as "Suivi de mes notes" (index.html:318 + app.js name-prefix/render paths 308-313/370-371/3333-3334); `app.js:3328` profile tooltip → "Espace personnel".
- `index.html:327`: `Mode Gemmes` → `Mode Visuel (Gemmes)` + explanatory `title`; keep `value="visual"`.

## 7. Cards + typography (P2 · M)
- Add per-theme card tokens (`--card-border`, `--card-border-hover`, `--card-shadow`, `--card-border-warning`, `--card-border-emphasis`) in `:root` (after 86) + light block (after 146).
- `.subject-card` (585-601): border/shadow via tokens; **`:hover` → `--card-border-hover`, NOT `--color-text-primary`** (fixes stuck-black-border-on-tap in WKWebView). Add `.card--warning` / `.card--emphasis`.
- `.promo-dashboard-container` (320-349): same token family for its status borders.
- `.bilan-card-title` (4693-4698): `white-space:nowrap`; parent sizing so long "Min…Max" string wraps/right-aligns instead of squeezing the serif → fixes "Groupe 1" 2-line wrap.
- `.subject-average-badge` (703-716): grade colors via `--color-avg-*` tokens (match `.bilan-points`); drop duplicate light override.

---

## QA gates (per iteration)
- `npm run build` clean (vite).
- `npm test` (vitest) green — calculator/migrations/sync must stay passing (no logic touched).
- Visual: re-check the 9 screens — status bar clear, nav not clipping, chips legible, chart shows 3 slots, one register, one card border rule.

## Ship
- gstack `/review` on the diff → gstack `/ship` (branch `feat/ios-appstore-notare`, PR to main). No merge without confirmation.
