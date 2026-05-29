// StreekMart mobile shell.
//
// Architecture: this is a thin native wrapper around the live web app at
// `extra.siteUrl` (see app.json). Every Next.js deploy ships to the app
// automatically because the app loads the URL at runtime — there's no
// bundled HTML/JS to update. That's the "site update reflects in the app"
// requirement, and it's the only way to get it without maintaining two
// codebases.
//
// What this file adds on top of the WebView so it doesn't feel webby:
//   - Native splash that fades into the WebView once the first paint is in.
//   - iOS-style translucent status bar matching the site brand color.
//   - In-app CSS injection that hides the site footer (mobile-app surface
//     uses the bottom nav, the footer is desktop chrome).
//   - Offline overlay with retry — replaces the WebView's ugly default error.
//   - External links (mailto/tel/other origins) open in the system browser
//     instead of inside our shell.
//   - Universal deep links (streekmart:// or https://streekmart.online/*)
//     route into the WebView so notifications + share-sheet opens land on
//     the right screen.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { Onboarding, type OnboardingExit } from "./Onboarding";

// AsyncStorage key tracking onboarding completion. Bump the suffix if you
// ever want to re-run onboarding for every install (e.g. major redesign).
const ONBOARDING_KEY = "streekmart:onboarded:v1";

// Show banners/sounds even when the app is in the foreground. Without this
// iOS swallows incoming notifications silently when the user is already in
// the app — which feels broken since the user has no idea a message
// arrived.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Keep the native splash up until we've handed off to the WebView's first
// paint — otherwise the user sees a white flash between splash and WebView.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden, ignore */
});

const SITE_URL =
  (Constants.expoConfig?.extra as { siteUrl?: string } | undefined)?.siteUrl ??
  "https://streekmart.online";

// Brand color used by the status bar background and splash.
const BRAND = "#7c3aed";

// User-Agent suffix lets the server detect app traffic if it ever wants to
// (e.g. hide a "download our app" banner inside the app itself).
const APP_UA_TAG = "StreekMartApp/1.0 (Mobile)";

// CSS injected into every page to hide chrome that doesn't make sense in
// the mobile shell.
//   - Desktop footer is redundant — the bottom nav + FAB are the app's
//     primary navigation.
//   - Anything with [data-app-hide] is a server-side opt-out. Sections that
//     only make sense on the marketing site (download-the-app CTA, the
//     dashboard-shortcut block, etc.) tag themselves with the attribute and
//     this rule hides them in the app without any conditional rendering.
// The `streekmart-app` class on <html> is also kept around so future
// app-only CSS can target it without needing to inject more rules.
const INJECTED_CSS = `
  document.documentElement.classList.add('streekmart-app');
  var style = document.createElement('style');
  style.setAttribute('data-streekmart-app', '');
  style.textContent = ${JSON.stringify(`
    footer { display: none !important; }
    [data-app-hide] { display: none !important; }
    /* Reclaim the bottom space the footer used to occupy. */
    main { padding-bottom: 6rem !important; }
  `)};
  document.head.appendChild(style);
`;

export default function App() {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(SITE_URL);
  // Onboarding gate. `null` = still reading AsyncStorage (keep splash up),
  // `"needed"` = render Onboarding, `"done"` = render WebView.
  const [onboardingState, setOnboardingState] = useState<"needed" | "done" | null>(null);

  // Check AsyncStorage once on launch to decide whether to show onboarding.
  // Done before any other work because the splash needs to stay up if we
  // route to onboarding (the WebView would otherwise paint first and flash
  // visible behind the onboarding overlay).
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        setOnboardingState(value === "1" ? "done" : "needed");
      })
      .catch(() => {
        // Storage failure → assume already onboarded so we never trap a
        // user in onboarding because of a permission/storage edge case.
        setOnboardingState("done");
      });
  }, []);

  // Hand-off from onboarding: persist the flag, set the WebView's initial
  // URL based on the user's choice, hide the native splash so onboarding
  // dismisses cleanly into the WebView.
  const handleOnboardingFinish = useCallback(async (exit: OnboardingExit) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* non-fatal — worst case we re-show onboarding next launch */
    }
    const targetPath =
      exit === "register" ? "/register" : exit === "login" ? "/login" : "/";
    setCurrentUrl(`${SITE_URL}${targetPath}`);
    setOnboardingState("done");
  }, []);

  // Track connectivity so we can swap in our own offline screen instead of
  // the WebView's default error page (which looks like a browser error).
  useEffect(() => {
    let mounted = true;
    async function probe() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setOffline(!(state.isConnected && state.isInternetReachable !== false));
      } catch {
        /* network module unavailable on this platform — leave online */
      }
    }
    probe();
    const id = setInterval(probe, 8000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Universal/deep links: a notification or share-sheet open hands us a URL
  // — feed it into the WebView so the user lands on the right page rather
  // than the home screen.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const target = resolveDeepLink(url);
      if (target) webRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(target)}; true;`);
    });
    // Handle cold-start case (the app was launched by the deep link itself).
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const target = resolveDeepLink(url);
      if (target) setCurrentUrl(target);
    });
    return () => sub.remove();
  }, []);

  // Push notification wiring:
  //   - Android: create the "default" channel so the OS knows how to render
  //     incoming notifications. Doing this once on launch is idempotent.
  //   - Request permission (no-op if already granted/denied).
  //   - Fetch the Expo push token, POST it to /api/push/register so the
  //     server knows where to send. The WebView's session cookie is used
  //     automatically (cookies are shared between WebView and fetch on iOS
  //     and on Android API 21+).
  //   - Wire two listeners: `received` (fires while app is in foreground —
  //     handler above shows the banner), `response` (fires when user taps
  //     a notification — we read the `link` payload and navigate the
  //     WebView there).
  useEffect(() => {
    let receivedSub: Notifications.Subscription | null = null;
    let responseSub: Notifications.Subscription | null = null;
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: "#7c3aed",
        }).catch(() => {});
      }

      // Simulators / web preview can't receive pushes. expo-device tells us
      // whether we're on real hardware so we skip the permission prompt
      // and the API call in those cases.
      if (!Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let final = existing;
      if (existing !== "granted") {
        const ask = await Notifications.requestPermissionsAsync();
        final = ask.status;
      }
      if (final !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
      // Without a projectId, getExpoPushTokenAsync falls back to the legacy
      // unsigned route — which works in dev but not in standalone builds.
      // We pass projectId explicitly so prod builds get a stable token.
      const tokenResp = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      ).catch((err) => {
        console.warn("[push] getExpoPushTokenAsync failed:", err);
        return null;
      });
      if (!tokenResp?.data) return;

      // Send to the server. The cookie attached to /api/push/register is
      // the same session cookie the WebView already has, so the upsert
      // lands on the right user row.
      try {
        await fetch(`${SITE_URL}/api/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: tokenResp.data,
            platform: Platform.OS === "ios" ? "ios" : "android",
          }),
        });
      } catch (err) {
        console.warn("[push] register POST failed:", err);
      }

      // Tap handler — when the user taps a notification (cold-start or
      // warm), `response.notification.request.content.data.link` is the
      // path the server attached in sendPush. Route the WebView there.
      responseSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as {
            link?: string;
          };
          if (!data?.link) return;
          const target = data.link.startsWith("http")
            ? data.link
            : `${SITE_URL}${data.link.startsWith("/") ? "" : "/"}${data.link}`;
          webRef.current?.injectJavaScript(
            `window.location.href=${JSON.stringify(target)}; true;`,
          );
        },
      );

      // Foreground-received listener — Notifications.setNotificationHandler
      // (top of file) already governs banner display; this hook is here so
      // we can react to in-app receipts (e.g. a future toast component).
      receivedSub = Notifications.addNotificationReceivedListener(() => {
        /* placeholder for in-app toasts */
      });
    })();

    return () => {
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, []);

  const onLoadEnd = useCallback(async () => {
    if (!ready) {
      setReady(true);
      // Give the WebView one frame to actually paint before we drop the
      // splash, so the user doesn't see a white flash.
      await new Promise((r) => setTimeout(r, 60));
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  const onShouldStartLoadWithRequest = useCallback((req: { url: string }) => {
    // Anything outside our origin opens in the system browser. That keeps
    // OAuth pop-ups, mailto:, tel:, app-store links, etc. behaving like a
    // user would expect in a native app.
    if (isExternal(req.url)) {
      Linking.openURL(req.url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    // Reserved channel for site-side `window.ReactNativeWebView.postMessage`
    // calls — if the web app ever wants to ask the shell to share a URL,
    // request push permission, etc., it posts a JSON envelope here.
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; url?: string };
      if (msg.type === "share" && msg.url) {
        Linking.openURL(`mailto:?body=${encodeURIComponent(msg.url)}`).catch(() => {});
      }
    } catch {
      /* not JSON — ignore */
    }
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCurrentUrl(nav.url);
  }, []);

  if (offline) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.offlineSafe}>
          <StatusBar style="light" backgroundColor={BRAND} />
          <View style={styles.offlineInner}>
            <Image source={require("./assets/icon.png")} style={styles.offlineLogo} />
            <Text style={styles.offlineTitle}>You&rsquo;re offline</Text>
            <Text style={styles.offlineBody}>
              StreekMart needs an internet connection. Reconnect and tap retry.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.offlineButton}
              onPress={async () => {
                const state = await Network.getNetworkStateAsync().catch(() => null);
                if (state?.isConnected) setOffline(false);
              }}
            >
              <Text style={styles.offlineButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // First-launch onboarding. We keep the native splash up while we read
  // AsyncStorage (state === null), then either show Onboarding or fall
  // through to the WebView. Hiding the splash here so onboarding's own
  // background paints behind the system splash transition.
  if (onboardingState === "needed") {
    void SplashScreen.hideAsync().catch(() => {});
    return (
      <SafeAreaProvider>
        <Onboarding onFinish={handleOnboardingFinish} />
      </SafeAreaProvider>
    );
  }

  // Still resolving AsyncStorage — render nothing so the native splash
  // stays visible. The state flips within a tick on real devices.
  if (onboardingState === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {/* The status-bar background tint matches the site brand color so the
            top of the WebView and the status bar read as one surface. */}
        <StatusBar style="light" backgroundColor={BRAND} translucent={false} />

        {/* WebView owns its own scroll — no outer ScrollView wrapper.
            Wrapping it caused every scroll-up gesture at any position to
            be interpreted as pull-to-refresh, which felt broken. The
            WebView has native iOS-style overscroll bounce on its own. */}
        <WebView
          ref={webRef}
          source={{ uri: currentUrl }}
          applicationNameForUserAgent={APP_UA_TAG}
          originWhitelist={["https://*", "http://*"]}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onLoadEnd={onLoadEnd}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          domStorageEnabled
          javaScriptEnabled
          // iOS-style overscroll bounce — feels like a real native scroll.
          bounces
          // Hide the default loading indicator; we render our own overlay.
          startInLoadingState={false}
          // Persistent cache so revisits are fast.
          cacheEnabled
          // Block long-press text selection on non-input elements for a
          // cleaner native feel. Users still get the system context menu
          // on inputs.
          allowsLinkPreview={false}
          decelerationRate="normal"
          // Inject the in-app CSS overrides (hide footer, etc.) before the
          // first paint so the user never sees a flash of the desktop chrome.
          injectedJavaScriptBeforeContentLoaded={INJECTED_CSS}
          // Re-inject after every full navigation since SPA route changes
          // sometimes re-render the layout chrome. Cheap to repeat.
          injectedJavaScript={INJECTED_CSS}
          style={styles.webview}
        />

        {/* Splash-to-content fade. While the first WebView load hasn't
            painted, we cover with an opaque brand-colored layer that
            mirrors the native splash so the handoff is invisible. */}
        {!ready && (
          <View style={styles.splashOverlay} pointerEvents="none">
            <Image source={require("./assets/icon.png")} style={styles.splashLogo} />
            <ActivityIndicator size="small" color="#ffffff" style={styles.splashSpinner} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

// ----- helpers -----

function isExternal(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) return true;
  try {
    const u = new URL(url);
    const site = new URL(SITE_URL);
    // Same host (and www variant) stays in the WebView; everything else
    // pops out to Safari/Chrome.
    return u.host !== site.host && u.host !== `www.${site.host}` && `www.${u.host}` !== site.host;
  } catch {
    return false;
  }
}

// Convert a deep-link URL (streekmart:// or universal-link form) into the
// canonical https URL the WebView understands.
function resolveDeepLink(url: string): string | null {
  try {
    if (url.startsWith("streekmart://")) {
      const path = url.replace(/^streekmart:\/\//, "");
      return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
    }
    const u = new URL(url);
    const site = new URL(SITE_URL);
    if (u.host === site.host || u.host === `www.${site.host}`) {
      return url;
    }
  } catch {
    /* unparseable — fall through */
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND,
  },
  webview: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  splashOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogo: {
    width: 112,
    height: 112,
    resizeMode: "contain",
  },
  splashSpinner: {
    marginTop: 24,
  },
  offlineSafe: {
    flex: 1,
    backgroundColor: "#0a0a14",
  },
  offlineInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  offlineLogo: {
    width: 84,
    height: 84,
    resizeMode: "contain",
    opacity: 0.85,
    marginBottom: 24,
  },
  offlineTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  offlineBody: {
    color: "#a3a3a8",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
    maxWidth: 320,
  },
  offlineButton: {
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  offlineButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});
