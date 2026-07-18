# Notare — App Store Submission Guide

Everything is prepped up to the archive. You do the Xcode signing + upload (your Apple account). Path: **TestFlight first**, then App Store review.

- **App name:** Notare
- **Bundle ID:** `ch.notare.app`
- **Version / build:** 1.0 (1)
- **Icon + splash:** Notare gradient cap (done)
- **Camera usage string + export compliance:** in Info.plist (done)

---

## Step 1 — Archive + upload to TestFlight (Xcode GUI)

```bash
npx cap open ios            # opens ios/App/App.xcodeproj in Xcode
```

In Xcode:
1. Select the **App** target → **Signing & Capabilities** tab.
2. Check **Automatically manage signing**, pick your **Team** (the enrolled Apple Developer account). Xcode creates the cert + provisioning profile for `ch.notare.app`.
3. Top device selector → choose **Any iOS Device (arm64)** (not a simulator — archive needs a device target).
4. Menu: **Product → Archive**. Wait for the build.
5. In the Organizer window that opens → **Distribute App** → **TestFlight & App Store** (or **App Store Connect**) → **Upload**. Xcode signs + uploads.
6. Build appears in **App Store Connect → your app → TestFlight** after ~5-15 min processing.

**First time only:** you must create the app record in App Store Connect first — see Step 2. Do that before uploading, or the upload has nowhere to land.

If Archive is greyed out: the device selector is still on a simulator. Switch to "Any iOS Device".

## Step 2 — Create the app record (App Store Connect)

https://appstoreconnect.apple.com → **Apps → +** → **New App**:
- Platform: iOS
- Name: **Notare** (must be globally unique in App Store — if taken, try "Notare - Suivi des notes")
- Primary language: **French**
- Bundle ID: **ch.notare.app** (select from list — appears after you register it via Xcode signing in Step 1.2, or in Certificates/Identifiers)
- SKU: `notare-ios-001` (any unique string)
- User access: Full

## Step 3 — Test on your iPhone via TestFlight

1. Install **TestFlight** app on your iPhone.
2. App Store Connect → TestFlight → add yourself as an **Internal Tester** (no review needed for internal).
3. Open TestFlight on device → install Notare.
4. **Test the native paths that the simulator can't fully verify:**
   - Camera OCR scanner (grade proof photo) — permission prompt should show the French string
   - Local notifications (reminders) — permission + delivery
   - Clipboard import
   - Widget sync (currently references App Group `group.ch.notare.app` — needs the capability added, see Open Questions)
   - Offline use + relaunch (Capacitor Preferences persistence)
   - Supabase login/signup + cloud sync

## Step 4 — Submit for App Store review

Needs the metadata + screenshots below. Fill in App Store Connect, attach the TestFlight build, submit.

---

## App Store metadata (draft — edit freely)

- **Name:** Notare
- **Subtitle (≤30):** Suivi des notes · Gymnase VD
- **Category:** Education (primary), Productivity (secondary)
- **Age rating:** 4+
- **Keywords (≤100):** notes,gymnase,vaud,moyenne,promotion,école,étudiant,bulletin,suivi,semestre
- **Support URL:** https://notare-swiss.ch
- **Marketing URL:** https://notare-swiss.ch
- **Privacy Policy URL:** https://notare-swiss.ch  ← must resolve to a public privacy page (the in-app legal modal text needs to be reachable at a public URL; confirm the prod site exposes it)

**Description (draft, FR):**
> Notare aide les élèves du gymnase vaudois à suivre leurs notes, calculer leurs moyennes et anticiper leur promotion selon le barème officiel (1 à 6).
>
> • Saisie rapide des notes par branche et par semestre
> • Calcul automatique de la promotion (règles vaudoises, groupes, compensations)
> • Objectifs et simulateur : voyez ce qu'il vous faut pour réussir
> • Preuve photo de vos épreuves (scan intégré)
> • Rappels et suivi de progression sur 3 ans
> • Fonctionne hors ligne — vos données restent sur votre appareil, synchro cloud optionnelle
>
> Conçu pour le gymnase, pensé pour les élèves.

## Screenshots

- Required: **6.9"** (1320×2868). One captured: landing. Capture more after TestFlight (dashboard with real grades, promotion status, guide) — best done on your device with real data.
- Optional but recommended: 6.5" (1284×2778). App Store Connect can scale the 6.9" set.

## Privacy nutrition labels (draft — CONFIRM before submitting)

Based on the code: Supabase auth + optional cloud state sync + local camera photos.

| Data type | Collected? | Linked to identity | Use | Note |
|---|---|---|---|---|
| Email address | Yes | Yes | App functionality (account) | Supabase auth |
| Name | Yes | Yes | App functionality | Signup prénom/nom |
| User content (grades) | **Confirm** | Yes if synced | App functionality | Local always; Supabase sync if logged in |
| Photos (grade proofs) | **Confirm** | Maybe | App functionality | OCR is on-device; are photos uploaded to Supabase state? |
| Usage/analytics | No | — | — | No analytics SDK detected |

**Open question for labels:** does the Supabase state sync include the grade photos and grades? If yes → declare "User Content" + "Photos" as collected + linked. If grades/photos never leave the device → they're not "collected." Confirm what the sync blob contains.

---

## Open questions / follow-ups

1. **Widget App Group** — `WidgetSyncPlugin.swift` uses `group.ch.notare.app`, but there's no `.entitlements` file and no WidgetKit extension target yet. If you want the home-screen widget: add the App Group capability in Xcode (Signing & Capabilities → + App Group → `group.ch.notare.app`) and a WidgetKit extension. Without it, widget sync no-ops (already caught gracefully). **Not blocking** for a first release without the widget.
2. **Privacy policy public URL** — the legal text is an in-app modal; App Store needs a public URL. Confirm notare-swiss.ch serves it.
3. **App name uniqueness** — "Notare" may be taken on the App Store; have a fallback ready.
4. **Do NOT** push branch `feat/ios-appstore-notare` to `pranathi/main` (auto-deploys prod) until you want Supabase auth + French legal live on notare-swiss.ch.
