// StreekMart mobile shell (v2 — native).
//
// The old shell was a thin WebView wrapper around streekmart.online.
// Buyers reported the app failing to open on lower-end Android devices
// because the WebView would time out before paint. This rewrite drops
// the WebView entirely in favour of:
//   - React Navigation (bottom tabs + stack)
//   - Themed UI (auto/light/dark) sourced from src/theme/tokens.ts
//   - SecureStore-backed auth, AsyncStorage-backed theme preference
//   - Expo push registration on first signed-in launch
// Splash colors moved to white/black (per theme) in app.json — no purple.

import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from "./src/state/ThemeContext";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import { usePushRegistration } from "./src/state/usePush";
import { RootNav } from "./src/navigation/RootNav";

// Keep the native splash up until the first paint of the navigation tree
// — gives the AuthProvider time to hydrate the cached token so the user
// doesn't briefly see a "signed-out" Account tab before bouncing back.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppInner() {
  const { user, ready } = useAuth();
  usePushRegistration(user?.id);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return <RootNav />;
}
