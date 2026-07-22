# Notare — Post-Redesign Review + AI-Slop Audit (round 2)

**Reviewed:** 6 on-device screenshots, iPhone 15, after the design-remediation build shipped + installed.
**Mandate:** fix new regressions + **de-AI-slop the whole app AND website**.

The redesign held on device (nav split, filled chips, name, vous copy all correct). Re-testing surfaced 3 regressions and confirmed the AI-slop to remove.

## 🔴 Regressions (introduced / newly visible)

### 1. Landing page collides with the status bar (P1)
`#19 #20 #21` — "Interface Intelligente" renders under the clock/5G/battery on every landing screen. The earlier safe-area fix covered the **app** body; the **landing/marketing view** (`#view-landing`) has its own layout that never consumes `env(safe-area-inset-top)`.

### 2. Chart-modal text overlap (P1)
`#18` — In the expanded "Évolution par branche" view, the serif title **overlaps** the "Sélectionnez les branches à afficher :" label and the subtitle. Two text blocks on the same coordinates in the maximized card.

### 3. Settings cards in dark theme (P1)
`#16 #17` — White cards with dark gaps → looks like light-theme cards inside dark theme, or an inconsistent modal treatment. Needs live both-theme verification; likely a settings card using a hardcoded light bg instead of `var(--color-bg-surface)`.

## 🟡 AI-slop to remove (the main ask)

### 4. Copy slop (P2)
- `Rox/roasts pour notes insuffisantes` — meaningless label (index.html:1102).
- `objective` anglicism → **objectif** (app.js:3115/3576, migrations.js:71).
- `rappelle toi` → **rappelle-toi** (missing hyphen).
- `bruh`, `t'a revisé ou …` — trying-too-hard slang defaults.

### 5. Theme-naming slop (P2)
10 themes named in mixed FR/EN + twee: `Navy · Rose · Vert · Violet · Sage Cozy · Miel · Sky Blue · Crimson · Menthe · Teal` (index.html:1050-1059). Reads machine-generated. → pick one language (French), drop twee, curate the set.

### 6. Typography (P2)
Playfair Display used broadly (headings + card titles), the "safe AI serif"; wraps/collides at small sizes (#18). → reserve serif for a few display headings, sans for all UI.

### 7. Color noise (P2)
10 themes × ~17 per-subject colors = rainbow with no restraint (#18). → curated categorical palette, not 17 random hues.

### 8. Generic-card + centered-everything (P2)
Rounded white cards + soft shadow everywhere, centered hero/settings/section-heads, decorative icon markers, browser-chrome mockups on the landing. The "AI generated any product" look. → deliberate hierarchy, selective left-alignment, real screenshots over fake browser chrome.

---

_Grounded file:line + concrete fixes + the de-slop design/copy spec are produced by the 8-agent audit workflow (`wa7lmgh0c`) and folded into the plan next._
