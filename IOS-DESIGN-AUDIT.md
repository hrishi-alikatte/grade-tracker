# Notare iOS — Design & UX Audit

**Reviewed:** 9 on-device screenshots, iPhone 15 (iOS, WKWebView / Capacitor 8), build on branch `feat/ios-appstore-notare`.
**Method:** Per-screen visual review + code grounding (`app.js`, `index.html`, `style.css`).
**Verdict:** Strong information design and a genuinely useful promotion engine, undermined by a handful of **systemic, highly visible defects** — chief among them the iOS status bar colliding with content on *every* screen. These read as "web page in a wrapper," not "native app." All are fixable without touching the calculation logic.

Severity: **P0** = blocks a professional release · **P1** = clearly unprofessional, fix before ship · **P2** = polish.

---

## P0 — Release blockers

### 1. Status bar / Dynamic Island collides with content on every screen
**Seen in:** all 9 screenshots. The OS clock (`23:47`), 5G, and battery render *on top of* the app — over "Bilan par groupe", over "Suivi des notes d'Étudiant", over the `Agrandir` button, over scrolled list rows.
**Why it's bad:** It is the single most obvious "this is not a real app" tell. Text is unreadable where they overlap; the Dynamic Island eats tap targets.
**Root cause:** `viewport-fit=cover` is set (index.html:5) so the web view goes edge-to-edge, but `style.css` consumes `env(safe-area-inset-top)` in only **2 of 5,441 lines**. The app shell and scroll containers have no top inset.
**Fix:** Add a top safe-area inset to the app shell / scroll root (`padding-top: env(safe-area-inset-top)` via a `--safe-top` token), and confirm the Capacitor `StatusBar` overlay behaviour. One change, fixes all 9 screens.

---

## P1 — Fix before ship

### 2. Bottom footer is oversized, inconsistent, and clips content
**Seen in:** every screen. A large sticky block stacks the **Notare wordmark + cap logo**, **three floating circle buttons** (profile / gear / dark-mode), and a **`Mes Notes | Guide`** segmented pill.
**Problems:**
- Three unrelated concerns (branding, global actions, primary navigation) crammed into one fixed bar.
- It **clips the content above it** — `Annuel (Combiné)` tab is cut off (Images 7–8); chart bottoms are cut off (Image 3).
- The wordmark's size **changes between screens** (large on Images 1/5/6, smaller elsewhere) — inconsistent.
**Fix:** Split concerns. Primary nav (`Mes Notes` / `Guide`) → a compact bottom tab bar. Brand + profile/settings/theme → a top bar or overflow menu. Add scroll-area bottom padding = footer height + `safe-area-inset-bottom` so nothing is ever clipped.

### 3. Branch-chip selector is visually chaotic
**Seen in:** Images 1 & 3 ("Sélectionnez les branches à afficher"). Chips wrap ragged and center-staggered at wildly different widths. Selected chips (Maths, Français, OS, Anglais, Allemand) get tinted fills + colored borders + colored dots; unselected get gray dots + gray outline — but the two states are **hard to tell apart** and sizes are uneven. `Tout afficher | Effacer` are styled as **underlined web links**, not native controls.
**Fix:** One chip system — uniform height/padding, a clean flex-wrap grid, unmistakable selected (filled) vs unselected (outline) states, and real buttons for `Tout afficher` / `Effacer`.

### 4. Mixed French register (tutoiement vs vouvoiement)
**Seen in:** Images 2 & 6 say **"Min 16 / tes points: 14.5"** (informal *tu*), while Images 7–9 say **"Il vous manque…"** and **"Vos moyennes…"** (formal *vous*). Mixing *tu* and *vous* in one product is unprofessional — especially for a Swiss school tool.
**Grounded:** `app.js:488` and `app.js:538` (`tes points`) vs `app.js:407–414` (`vous`).
**Fix:** Standardise on **vous** everywhere. `tes points` → `vos points`.

---

## P2 — Polish

### 5. Brand casing & placeholder content
- Brand is lowercase **"notare"** in prose/alt text ("Tableau de bord de notare", "À propos de notare") but **"Notare"** in the wordmark/title — pick one (Notare in prose).
- The main title shows **"Suivi des notes d'Étudiant"** — "Étudiant" is an **unset default name** (`app.js:307`). Showing a literal placeholder as a name looks unfinished. Use a first-run name prompt, or a neutral title ("Mes notes") until a name is set.
- **"Mode Gemmes"** (index.html:327) is unexplained gamification jargon — label or tooltip it.

### 6. Inconsistent card treatment & serif heading wrapping
- Cards use **three unrelated borders** with no semantic rule: heavy solid **black** (Évolution générale, Image 4), **amber** (Statut de promotion, Image 9), and near-invisible **gray** (stat cards). Consolidate into one system: default / warning / emphasis variants as tokens.
- The Playfair serif on **"Groupe 1" / "Groupe 2"** wraps the number to a second line (Images 2 & 6) — looks broken. Force no-wrap / inline the number / size down.

### 7. Charts are cramped, clipped, and misleading
- The "Évolution par branche" mini-chart is **clipped by the footer** (Image 3).
- "Évolution générale — sur 3 ans" plots only **two points** — `1ère année` (3.90) and `3ème année` (5.25), **no `2ème année`** (Image 4). A "3-year" chart with a missing middle year reads as broken.
- Charts are small with tiny labels.
**Fix:** Reserve bottom space so the footer never clips charts; render **all** available year points and mark a missing year explicitly rather than omitting it; increase height + label legibility.

---

## What's already good (keep)
- The promotion engine (`Promotion insuffisante` with exact point gaps per group) is genuinely useful and clearly written.
- The Evolution summary cards (moyenne générale, meilleure/à-surveiller branche) are a strong dashboard pattern.
- Green/red grade coding is readable.
- Typographic ambition (Playfair display headings) gives character — it just needs disciplined application.

---

## Fix order (dependency-aware)
1. **P0 safe-area** (one token, unblocks the whole look) →
2. **P1 footer** (depends on safe-area-bottom token) →
3. **P1 chips** + **P1 register** (independent, parallel) →
4. **P2 brand/placeholder**, **cards/typography**, **charts**.

_Grounded per-file fix specs + exact diffs are appended by the code-grounding pass (see the Plan section)._
