// StreekMart mobile shell (v2 - native).

import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { TextStyle } from "react-native";
import { nunitoFamilyFor } from "./src/theme/tokens";

// Force every <Text> to render in the brand font (Nunito) regardless of
// how it was styled. RN won't auto-pick a bold member of a custom
// family — `<Text style={{ fontWeight: "700" }}>` paints with the
// device default unless we explicitly set fontFamily too. By wrapping
// Text.render we flatten the incoming style, read its fontWeight, and
// inject the matching Nunito weight family. Per-call styles still win
// — we only add fontFamily when the caller didn't.
type RenderableText = typeof Text & {
  render?: (props: object, ref: unknown) => React.ReactNode;
};
const RenderableTextRef = Text as RenderableText;
const originalRender = RenderableTextRef.render;
if (originalRender) {
  RenderableTextRef.render = function patched(props: object, ref: unknown) {
    const p = props as { style?: TextStyle | TextStyle[] };
    const flat = (StyleSheet.flatten(p.style) ?? {}) as TextStyle;
    const family = flat.fontFamily ?? nunitoFamilyFor(flat.fontWeight);
    const nextStyle: TextStyle = { ...flat, fontFamily: family };
    return originalRender.call(this, { ...props, style: nextStyle }, ref);
  };
}
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";
import { ThemeProvider, useTheme } from "./src/state/ThemeContext";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import { usePushRegistration } from "./src/state/usePush";
import { promptBiometric, readBiometricState } from "./src/state/biometric";
import { RootNav } from "./src/navigation/RootNav";
import type { RootStackParamList } from "./src/navigation/RootNav";

// Matches the flag persisted by OnboardingScreen on completion. Bump
// the suffix if a future redesign should re-show the flow.
const ONBOARDED_KEY = "streekmart:onboarded:v2";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Custom brand font (Inter). Block render until the family is ready
  // so we never paint with the device default and then re-flow text
  // when the font swaps in.
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  if (!fontsLoaded) return null;
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
  const { user, ready, logout } = useAuth();
  usePushRegistration(user?.id);

  // Biometric gate. On cold start, if the user is signed in AND has
  // opted in to biometric, prompt once before unlocking the app. If
  // they fail or cancel, give them the option to retry or sign out so
  // they don't get stuck.
  const [unlocked, setUnlocked] = useState(false);
  const [needsBiometric, setNeedsBiometric] = useState<"checking" | "yes" | "no">("checking");

  // First-launch onboarding gate. While we wait for AsyncStorage we hold
  // the splash up so the user never sees a flash of the wrong route.
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      // Already signed in -- skip onboarding entirely.
      if (user) {
        setInitialRoute("Tabs");
        return;
      }
      // Logged out: route to GetStarted on first launch, otherwise to
      // Tabs (which renders the public storefront; each tab handles its
      // own auth prompt if needed).
      const seen = await AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null);
      setInitialRoute(seen === "1" ? "Tabs" : "GetStarted");
    })();
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setUnlocked(true);
      setNeedsBiometric("no");
      return;
    }
    (async () => {
      const state = await readBiometricState();
      if (state.hardwareAvailable && state.userOptedIn) {
        setNeedsBiometric("yes");
        const ok = await promptBiometric(`Unlock StreekMart with ${state.friendlyName}`);
        if (ok) {
          setUnlocked(true);
        }
      } else {
        setNeedsBiometric("no");
        setUnlocked(true);
      }
    })();
  }, [ready, user]);

  useEffect(() => {
    // Don't hide the splash until BOTH the session AND the
    // onboarded-flag check have resolved -- otherwise the user can see
    // GetStarted flash before we route them to Tabs.
    if (ready && initialRoute !== null) SplashScreen.hideAsync().catch(() => {});
  }, [ready, initialRoute]);

  if (!ready || initialRoute === null) return null;

  if (!unlocked && needsBiometric === "yes") {
    return <BiometricLockScreen onRetry={() => setUnlocked(false)} onSignOut={logout} />;
  }

  return <RootNav initialRouteName={initialRoute} />;
}

function BiometricLockScreen({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  const t = useTheme();
  async function retry() {
    const state = await readBiometricState();
    const ok = await promptBiometric(`Unlock StreekMart with ${state.friendlyName}`);
    if (ok) onRetry();
  }
  return (
    <SafeAreaView style={[styles.lockScreen, { backgroundColor: t.bg }]}>
      <View style={styles.lockInner}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>Locked</Text>
        <Text style={{ color: t.textMuted, marginTop: 8, textAlign: "center" }}>
          Authenticate to continue.
        </Text>
        <Pressable
          onPress={retry}
          style={[styles.lockBtn, { backgroundColor: t.cta }]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "700" }}>Authenticate</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert("Sign out?", "You'll need to sign in again from scratch.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => onSignOut() },
            ]);
          }}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: t.textMuted, fontSize: 12 }}>Sign out instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lockScreen: { flex: 1 },
  lockInner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  lockBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 },
});