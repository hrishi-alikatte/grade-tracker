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

- [x] **Phase 0 — Plan & lock** — decisions locked
- [x] **Phase 1 — Integrate & build** — COMPLETE
  - [x] Integration branch `feat/ios-appstore-notare` off `pranathi/main`, merge feat, resolve 6-file conflict (commit `5dffefc`)
  - [x] Build passes (`vite build`), 68/68 tests pass
  - [x] Rebrand: Notare / `ch.notare.app` (capacitor.config, Info.plist, pbxproj, widget App Group) — commit `e2a23e4`
  - [x] `npx cap sync ios` (4 plugins via SPM)
  - [x] Xcode 26.6 installed, iOS 26.5 sim
  - [x] **`xcodebuild` BUILD SUCCEEDED** (simulator), app runs — Notare renders, bottom tab bar working
- [x] **Phase 2 — QA** (browser, mobile viewport) — 0 JS errors, landing/dashboard/subjects/promotion-bilan render, Supabase auth wired, add-branch write-path + Capacitor Preferences mirror verified, 68/68 unit tests. No bugs. (Native notifications/widget/OCR need real-device pass.)
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
