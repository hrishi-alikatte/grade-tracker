# Notare — De-Slop Remediation Plan (grounded)

Source: `IOS-DESLOP-AUDIT.md` + 8-agent grounding (workflow `wa7lmgh0c`). No calculation logic changes.

## Progress
- [x] **A · Regressions** — settings-card theme token, maximized-chart top-align, landing safe-area inset. Green.
- [x] **B · Typography** — `.evo-chart-title`/`.landing-hero-lede`→sans; light serif block narrowed to display headings only. Green.
- [x] **D · Copy** — "Rox/roasts"→"Messages de motivation"; slang roast defaults→professional vous (×3). Green. Slop sweep clean.
- [x] **C · Components** — shadow blanket scoped to primary+modal only; guide/feature cards flattened (no blur/shadow, hairline, radius-md); restrained border hover (no -8px lift); bare 28px feature icons; section heads left-aligned. Green.
- [x] **E · Color/themes** — 10→5 curated French (Marine/Forêt/Prune/Ambre/Grenat, values unchanged); migration alias for retired values; 5 dead `[data-theme]` blocks deleted; subject palette 13→6 curated desaturated. Green.
- [x] **F · Website/landing** — value-prop hero ("Suivez vos notes. Sachez si vous passez." + Vaud subhead); killed browser-chrome mockups (dots+address bar); removed idle animations (logoPulse, scroll bounce, CTA glow); benefit-led section headers; credible dev note. Green.
- [x] **QA** — gstack browse iPhone-15 both themes: hero value-prop ✓, settings cards themed (light #fcfbf9 / dark #0f172a, regression fixed) ✓, maximized chart no overlap (title 129 < label 184) ✓ + sans title + 6-hue desaturated chips ✓, theme "Marine" ✓, "Messages de motivation" + vous copy ✓, no JS errors ✓. Landing safe-area proven (element test 0.5rem+59px=67px; env=0 headless, device confirms).
- [x] **Ship (code)** — commit `9b39372`, pushed, **PR #1 updated**. `npx cap sync ios`. Device build **SUCCEEDED** + signed.
- [ ] **Device install** — PENDING: iPhone 15 went "unavailable" (locked/asleep). Signed `.app` ready at `ios/build/Build/Products/Debug-iphoneos/App.app`. Retry `devicectl install` when phone reconnects (or Run in open Xcode).

**ALL 6 DE-SLOP PHASES SHIPPED. Device install pending phone reconnect.**

## Build order

### Phase A — Regressions (P1, visible bugs)
1. **Settings cards theme** — `style.css:4986` `.settings-box { background: rgba(255,255,255,0.02) }` hardcoded white → `var(--color-bg-base)`; add `body.theme-light .settings-box` override. (Fixes white-on-white light + washed dark.)
2. **Chart-modal overlap** — add `.subject-card.is-maximized .evo-graph-wrapper { justify-content:flex-start; flex:1 1 auto; min-height:0 }` + `.subject-card.is-maximized .evo-chart-head { flex-shrink:0 }` (after style.css:3499). Root cause: centered flex wrapper overflows upward under the header.
3. **Landing safe-area** — `style.css:2404` `.landing-page-container` `padding-top:0.5rem !important` → `calc(0.5rem + var(--safe-top)) !important` (single-owner; verify no double-count with sticky nav in QA).

### Phase B — Typography discipline (P1, also fixes #2 collision)
4. `.evo-chart-title` (4223) serif→**sans**; `.landing-hero-lede` (4640) serif→**sans**; remove `.guide-card-title, .subject-name, .creator-word-box h3, .bilan-section h2` from the light-theme serif `!important` block (3058-3070). Serif reserved for: hero title, landing title, app wordmark h1, page H1. Numbers stay mono.

### Phase C — Components + layout (P1)
5. 2-tier cards: keep `.subject-card` + `.promo-dashboard-container` raised; demote `.guide-card`, `.landing-feature-card`, `.settings-box`, `.bilan-card` to flat (no blur/shadow, `--radius-md`, hairline border). **Delete the `!important` shadow blanket (2884-2890).** Left-align `.landing-section-head` (4560). Drop `.feature-icon` tinted badge + `translateY(-8px)` hover-lift (1816). Standardize card padding to space scale.

### Phase D — Copy (P2)
6. `index.html:1102` "Rox/roasts…" → **"Messages de motivation"**. Roast defaults → professional vous, in **all 3** spots (app.js:3113-3116, app.js:3573-3577, migrations.js:68-72): `"Un petit creux, ça arrive. La prochaine sera meilleure."`, `"Rappelez-vous de votre objectif."`, `"On se ressaisit au prochain examen."`, `"Gardez le cap sur votre moyenne."`. `objective`→`objectif` (comment app.js:2662).

### Phase E — Color + themes (P2)
7. Themes 10→**5 curated French** (index.html:1049-1060), values unchanged: Marine, Forêt, Prune, Ambre, Grenat. Add theme alias migration (migrations.js:55): `{mint:'green',teal:'green',cozy:'green',skyblue:'navy',pink:'crimson'}`. Delete dead `[data-theme]` CSS blocks (pink/cozy/skyblue/mint/teal). Subject palette 13→**6 curated desaturated** (app.js:987-1015), stable hue order, luminance-shifted per theme.

### Phase F — Website / landing (P1)
8. Hero: replace dictionary gag (index.html:90-98) with real value prop H1 + subhead. Kill browser-chrome mockups (dots+address bar, index.html:133-168 + style.css:4405-4478 mock-* rules). Remove animations: `logoPulse` (1741), `bounce` (1772), CTA glow (index.html:289). Left-align section heads. Brand casing consistent. Replace flippant developer quote (index.html:276). Concrete benefit-led section headers (121, 229).

## Gates
- `npm run build` clean + `npm test` (91) green each phase.
- QA (gstack browse, iPhone-15, both themes): landing scroll clears status bar · maximized chart no overlap · settings cards themed · serif only on display · flat vs raised cards · 5 themes · new copy.
- Ship: cap sync ios → install to iPhone 15 (UDID `00008120-001170D43EA2201E`) → commit + push + update PR #1.
