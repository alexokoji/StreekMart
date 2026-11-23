import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, StyleSheet, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { API_URL, getAuthToken } from "../api/client";
import type { RootStackParamList } from "../navigation/RootNav";

// Opens any StreekMart web page inside the app, signed in as the current
// user. This is how every website feature that doesn't have a native screen
// yet (preorders, commissions, lookbooks, shop managers, sketch studio,
// support and the legal pages) stays reachable from the app.
//
// Auth: the first request carries the Bearer token (the server accepts it
// like the API does) and the session cookie is set before each page loads so
// in-page navigation and forms keep working.
const SESSION_COOKIE = "upclo_session";

export function WebPageScreen() {
  const t = useTheme();
  const { path, title } = useRoute<RouteProp<RootStackParamList, "WebPage">>().params;
  const ref = useRef<WebView>(null);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    getAuthToken().then(setToken);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        ref.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const base = API_URL.replace(/\/$/, "");
  const host = new URL(base).host;
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  function onNav(e: WebViewNavigation) {
    setCanGoBack(e.canGoBack);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={title} />
      {token === undefined ? (
        <ActivityIndicator color={t.cta} style={styles.center} />
      ) : (
        <>
          <WebView
            ref={ref}
            source={{ uri: url, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
            injectedJavaScriptBeforeContentLoaded={
              token ? `document.cookie = "${SESSION_COOKIE}=${token}; path=/; max-age=2592000"; true;` : undefined
            }
            onNavigationStateChange={onNav}
            onLoadEnd={() => setLoading(false)}
            // Keep the app's own pages in the WebView; send everything else
            // (external sites, mailto, tel) to the system.
            onShouldStartLoadWithRequest={(req) => {
              try {
                const u = new URL(req.url);
                if (u.protocol === "http:" || u.protocol === "https:") {
                  if (u.host === host) return true;
                  Linking.openURL(req.url).catch(() => {});
                  return false;
                }
              } catch {
                /* fall through */
              }
              Linking.openURL(req.url).catch(() => {});
              return false;
            }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            startInLoadingState
            style={{ flex: 1, backgroundColor: t.bg }}
          />
          {loading && <ActivityIndicator color={t.cta} style={styles.overlay} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  overlay: { position: "absolute", top: 120, alignSelf: "center" },
});
