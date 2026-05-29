# StreekMart Mobile

Thin native shell around the live web app. The shell loads
`https://streekmart.online` in a `react-native-webview` and adds iOS-style
chrome — splash, status bar, pull-to-refresh, offline screen, deep linking,
native share-out.

## Why this design

Every Next.js deploy ships to mobile users automatically because the app
loads the URL at runtime. There is no bundled HTML/JS — the splash hides,
the WebView paints the current build of the site, and that's the app. Site
design changes, new features, bug fixes — all instant. The shell only ships
when we change the native chrome itself, which is rare.

## Setup

```sh
cd mobile
npm install
npx expo login                  # one-time, your Expo account
npm install -g eas-cli          # one-time, build CLI
eas login
eas init                        # creates the EAS project id; paste it into
                                # app.json under expo.extra.eas.projectId
```

## Run locally (Expo Go on your phone)

```sh
npm start
```

Scan the QR with the Expo Go app (iOS/Android). The WebView opens the live
site immediately — useful for verifying the shell against staging/prod.

## Build the Android APK (the file the website serves)

```sh
npm run build:android-apk
```

EAS builds in the cloud (~10 min), then prints a download URL. Download the
`.apk` and drop it at `public/streekmart.apk` in this repo. The Android
download button on the homepage CTA serves it directly:

```
<a href="/streekmart.apk" download>Android APK</a>
```

Bump `expo.android.versionCode` in `app.json` for each new APK so existing
installs update cleanly.

## Build for the Play Store

```sh
npm run build:android-store
```

Produces a signed `.aab` (App Bundle). Upload at
[Play Console](https://play.google.com/console). First-time submissions need:

- Privacy policy URL — point at `/privacy-policy` on the site.
- Content rating questionnaire.
- App icon (uses `assets/icon.png` automatically).
- Feature graphic 1024×500 (create from the brand logo).

## Build for the App Store

```sh
npm run build:ios
```

Apple charges $99/yr for a developer account; you'll need that before
submission. The build produces an `.ipa`. Submit with:

```sh
npm run submit:ios
```

First-time iOS submission needs:

- Apple Developer account enrolled.
- App ID created at developer.apple.com matching `com.streekmart.app`.
- App Store Connect listing (screenshots @ 6.7", 5.5"; description; keywords).

## Updating the app — both kinds are live

There are three layers, each with its own update path:

| Layer                            | Reflects in app via      | Rebuild needed?       |
| -------------------------------- | ------------------------ | --------------------- |
| Web app (most of the product)    | WebView fetches live URL | No — instant          |
| Shell JS (App.tsx, splash logic) | `expo-updates` OTA       | No — `npm run update` |
| Native code (permissions, plugins, native libs) | New EAS build + store submission | Yes |

### Layer 1 — Web app changes (instant, automatic)

Every deploy to your Vercel/Render reflects in the app on the next page
load. No action needed. This is most product work.

### Layer 2 — Shell JS changes (OTA, ~30 sec)

For tweaks to `App.tsx` — offline screen, deep-link routing, notification
handler, the injected CSS that hides the footer, etc. — ship over-the-air:

```sh
cd mobile
npm run update -- "tweak: hide footer in app shell"
```

EAS publishes the JS bundle to `u.expo.dev/<project-id>`. The next time a
user opens the app, `expo-updates` checks for a new bundle (governed by
`updates.checkAutomatically: "ON_LOAD"` in `app.json`) and downloads it in
the background. On the *next* launch after that, the new shell runs. No
App Store review, no version bump, no APK redistribution.

### Layer 3 — Native rebuilds (rare, requires resubmission)

Only needed when you change:

- Permissions in `app.json` (e.g. add location access)
- The Expo SDK version
- A native library (`expo install <something>`)
- The bundle identifier or app name

Then: bump `expo.version` (user-visible), bump `expo.android.versionCode` /
`expo.ios.buildNumber` (machine-readable), `npm run build:android-store` /
`npm run build:ios`, and resubmit.

### One-time setup for OTA

The first time you use OTA, run:

```sh
eas update:configure
```

This adds the bundle-identifier metadata the OTA channel needs. After that
the `npm run update -- "message"` flow above is all you need.

## File layout

```
mobile/
├── App.tsx              # WebView shell — the entire app
├── app.json             # Expo config: bundle ID, icon, splash, permissions
├── eas.json             # EAS build profiles (preview = APK, production = AAB)
├── package.json
├── babel.config.js
├── tsconfig.json
└── assets/
    ├── icon.png            # 1024×1024 app icon (copied from web /public)
    ├── splash.png          # Splash image (same as icon)
    ├── adaptive-icon.png   # Android adaptive icon foreground
    └── favicon.png         # Web-fallback favicon for `expo start --web`
```

## What lives in the shell (vs. the web app)

| Concern               | Lives in     | Notes                                                              |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| Page routes & layouts | Web app      | Next.js App Router — unchanged                                     |
| Auth / sessions       | Web app      | The WebView shares the site's cookies                              |
| Product browsing      | Web app      | Same React components rendered in the WebView                      |
| Splash / launch logo  | Mobile shell | `app.json` `splash` + native preventAutoHide                       |
| Pull-to-refresh       | Mobile shell | `RefreshControl` on the outer ScrollView                           |
| Offline screen        | Mobile shell | Custom view shown when `expo-network` reports no connectivity      |
| Deep linking          | Mobile shell | `streekmart://path` and universal `https://streekmart.online/path` |
| Push notifications    | Mobile shell | (TODO) `expo-notifications` + a server-side `/api/push/register`   |
| Native share          | Mobile shell | `Linking.openURL` from the postMessage channel                     |

## Push notifications

Wired up. The flow:

1. On first launch, the shell asks for notification permission (no-op on
   subsequent launches once granted/denied).
2. On grant, the shell fetches the Expo push token and POSTs it to
   `/api/push/register` on the site. The WebView's session cookie
   authenticates the call so the token lands on the right user row.
3. The server stores tokens in the `PushToken` table (many-to-one to User).
4. On notable events — order placed, new chat message, verification
   decision, tier change, admin broadcast — the server calls `sendPush`
   from `src/lib/notifications.ts`, which POSTs to Expo's push API. Expo
   proxies to APNs / FCM.
5. Tapping a notification routes the WebView to the `link` payload
   (`/account/orders/<id>`, `/messages/<chatId>`, etc.) — feels like
   native deep-linking.

Server-side details:

- Endpoint: `POST /api/push/register { token, platform }` — upserts by
  token, so re-registering an existing device is a no-op.
- Sign-out: `DELETE /api/push/register?token=...` so the device stops
  getting pushes after the user signs out. Hook it up to the LogoutButton
  on the web side if you want sign-out to retire the mobile install too.
- Invalid token cleanup happens automatically. When Expo's send API
  returns `DeviceNotRegistered` for a token (app uninstalled, token
  expired), the row is hard-deleted so we don't keep trying.
- Higher rate limits: set `EXPO_ACCESS_TOKEN` in the server env if you
  outgrow the unauthenticated tier (~600 req/min).

iOS-specific:

- The first build needs an APNs key uploaded to your Expo account. EAS
  prompts for one during `eas build -p ios` — generate it at
  developer.apple.com → Certificates → Keys.
- `aps-environment: production` is baked into `app.json` under
  `ios.entitlements`. Development builds get the development APNs
  environment automatically.

Android-specific:

- `expo-notifications` registers an FCM project for you on first build.
- The "default" notification channel is created at app launch
  (see `Notifications.setNotificationChannelAsync` in `App.tsx`).
- Users can mute the app via system settings; we don't ship custom
  channels.
