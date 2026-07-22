# Notare — Mobile Performance Plan (grounded)

Source: 6-agent perf audit (`wsu5xyvj9`). Target: **instant-feeling** first paint, **fully offline**, **60fps** scroll. ("0-1ms" is below network physics — real goal is sub-second FCP + instant repeat load.) No calculation logic changes.

## Progress
- [x] **P1 · Self-host fonts** — 6 subset (latin+latin-ext) variable woff2 (164KB) in public/fonts/; inline @font-face in style.css; dropped Google CDN preconnect/preload/noscript; preload 2 critical faces. SW precache 33→39. Offline-ready, no CDN. Build green.
- [x] **P2 · De-blur** — removed backdrop-filter on .subject-card, .top-nav-bar, .promo-dashboard-container, .modal-backdrop, .graph-maximize-backdrop (solid/near-opaque bg). Declarations 36→26. Kept bottom tab-bar frost. Build green.
- [x] **P3 · Images WebP** — 3 previews (1.07MB→57KB) + 12 gems (665KB→74KB) via cwebp; index.html src→webp + LCP eager/fetchpriority/decoding/width-height; style.css gem url()→webp; source PNGs deleted. **SW precache 2665→1098 KiB (~1.5MB cut).** Green.
- [x] **P4a · Boot parallelize** — bootstrap.js: 2 serial `Preferences.get` → `Promise.all` (one native round-trip). Green.
- [~] **P5 · SW precache tighten** — MOOT: WebP already cut precache to 1.1MB (goal achieved); skip runtime-CacheFirst churn.
- [ ] **P4b · Splash + init-defer** — `@capacitor/splash-screen` (launchAutoHide:false, hide on first landing paint) + defer initBackgroundBoxes/getSession/renderSubjects to requestIdleCallback + modulepreload main.js
- [ ] **Sim re-QA** (fonts/scroll/cold-start/offline) · **CSO** · **Ship**

## Phases (impact-ordered)

### P1 — Self-host fonts (HIGH — flagship: offline + FCP + CLS)
Google Fonts CDN (index.html:22-27) → local woff2. Breaks offline in the installed app today.
- Download 3 variable woff2 (latin+latin-ext) → `public/fonts/`: Plus Jakarta Sans (200-800), Playfair Display (400-900), JetBrains Mono (100-800). No italic (unused/synthesized).
- Add local `@font-face` (font-display:swap) at top of style.css; drop the 2 preconnects + preload-onload link + noscript.
- Preload only the 2 first-paint faces (Jakarta + Playfair) in `<head>`.
- SW already globs woff2 (vite.config.js:18) → auto-precache. Gain: 2 fewer CDN RTTs, offline, less swap-CLS.

### P2 — De-blur GPU offenders (HIGH — 60fps scroll, pure CSS)
Remove `backdrop-filter: blur()` on the 4 hot surfaces; raise bg opacity. Keep bottom tab bar + small transient blurs.
- `.subject-card` (606) blur16 — repeated scrolling grid = worst → solid bg.
- `.top-nav-bar` (2234) blur20 sticky — scroll jank → ~97% opaque (mobile already done last loop; fix base for web/tablet).
- `.promo-dashboard-container` (341) blur16 large → ~90% opaque.
- `.modal-backdrop` (897) blur8 + `.graph-maximize-backdrop` (3471) blur4 — full-viewport → drop (dim already hides bg).

### P3 — Images → WebP (HIGH — ~1.2MB saved)
- 3 landing previews PNG→WebP q80 @900px (~1.05MB→~280KB); dashboard preview `loading=eager fetchpriority=high`; add `decoding=async` + width/height to all 3.
- 12 gem textures PNG→WebP q80 (~650KB→~180KB); update style.css url() refs.

### P4 — Critical path + boot + splash (HIGH — perceived launch)
- `@capacitor/splash-screen`: launchAutoHide:false, hide on first `view-landing` paint → kills white cold-start.
- bootstrap.js: `Promise.all` the 2 Preferences.get (remove 1 serial IPC).
- Defer non-critical boot (initBackgroundBoxes, getSession, renderSubjects/updateDashboard) to `requestIdleCallback` after landing paint.
- modulepreload for the 136KB main.js chunk (or collapse bootstrap→static entry).

### P5 — SW precache tighten (MEDIUM)
- Exclude big landing/gem PNGs from install-precache → runtime CacheFirst (cuts ~1.5MB first-install).

## Gates
- `npm run build` + `npm test` (91) green each phase.
- Re-QA in iPhone-17 sim: rebuild+install+screenshot; verify fonts render (self-hosted), smooth scroll, no white cold-start, offline (airplane-mode sim load).
- **CSO** (gstack security pass) → ship (commit+push update PR #1, cap sync, reinstall to iPhone 15 + sim).
