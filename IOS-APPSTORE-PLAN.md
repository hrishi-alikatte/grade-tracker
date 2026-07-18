# Notare — iOS App Store Ship Plan

Native iOS via **Capacitor 8** wrapping the Vite web PWA. Target: App Store.

## Locked decisions (2026-07-18)

| Decision | Choice |
|---|---|
| **Branch base** | `pranathi/main` (Capacitor iOS ready) + merge `feat/v6-perf-mobile-upgrades` |
| **Apple account** | Enrolled, App Store Connect ready |
| **App identity** | Display name **Notare**, bundle **`ch.notare.app`** |
| **Scope** | iOS only (Android scaffolding untouched this round) |

## Phase roadmap

- [ ] **Phase 0 — Plan & lock** — this doc; decisions locked
- [ ] **Phase 1 — Integrate & build**
  - [ ] Integration branch off `pranathi/main`, merge feat, resolve conflicts
  - [ ] Rebrand: appName → Notare, appId → `ch.notare.app` (capacitor.config, Xcode, Info.plist)
  - [ ] `npm i` → `vite build` → `npx cap sync ios`
  - [ ] Open Xcode, set signing team, build to simulator + device
- [ ] **Phase 2 — Device QA** (`/ios-qa`) — grades, promotion calc, OCR scanner, local notifications, widget sync, offline/Preferences
- [ ] **Phase 3 — Design polish** (`/ios-design-review`) — safe areas, notch, touch targets, app icon, splash
- [ ] **Phase 4 — Release + ship** (`/ship` + App Store Connect) — version, icons, screenshots, privacy nutrition labels, archive, TestFlight
- [ ] **Phase 5 — Canary** (`/canary`) — post-release / TestFlight feedback monitor

## Key facts

- appId (current): `com.gradevibe.vaud` → change to `ch.notare.app`
- webDir: `dist` (Vite output)
- Native plugins: `@capacitor/{app,clipboard,local-notifications,preferences}` + custom `WidgetSyncPlugin.swift`
- Prod site `notare-swiss.ch` = pranathi Vercel auto-deploy from pranathi/main. **Do NOT push integration branch to pranathi/main until QA passes** (would deploy Supabase auth + French legal to prod).

## Risks

- Merge conflicts: hero/clock, `app.js` (174KB), landing sections
- Bundle ID change = fresh App Store Connect record
- Supabase auth is inert without env keys (dormant) — confirm it stays inert on device
