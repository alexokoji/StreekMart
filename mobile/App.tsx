// StreekMart mobile shell (v2 - native).

import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextStyle } from "react-native";
import { fontFamilyFor } from "./src/theme/tokens";
import { getDefaultPlaceholderColor, getDefaultTextColor } from "./src/theme/defaultColors";

// Force every <Text> to render in the brand font (Manrope) regardless of
// how it was styled. RN won't auto-pick a bold member of a custom
// family — `<Text style={{ fontWeight: "700" }}>` paints with the
// device default unless we explicitly set fontFamily too. By wrapping
// Text.render we flatten the incoming style, read its fontWeight, and
// inject the matching Manrope weight family. Per-call styles still win
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
    const family = flat.fontFamily ?? fontFamilyFor(flat.fontWeight);
    // No colour set? Use the theme's text colour, never RN's default black.
    const nextStyle: TextStyle = { ...flat, fontFamily: family, color: flat.color ?? getDefaultTextColor() };
    return originalRender.call(this, { ...props, style: nextStyle }, ref);
  };
}
// Same for TextInput: readable text and placeholder in light and dark mode.
type RenderableInput = typeof TextInput & { render?: (props: object, ref: unknown) => React.ReactNode };
const RenderableInputRef = TextInput as RenderableInput;
const originalInputRender = RenderableInputRef.render;
if (originalInputRender) {
  RenderableInputRef.render = function patchedInput(props: object, ref: unknown) {
    const p = props as { style?: TextStyle | TextStyle[]; placeholderTextColor?: string };
    const flat = (StyleSheet.flatten(p.style) ?? {}) as TextStyle;
    return originalInputRender.call(
      this,
      {
        ...props,
        placeholderTextColor: p.placeholderTextColor ?? getDefaultPlaceholderColor(),
        style: { ...flat, fontFamily: flat.fontFamily ?? fontFamilyFor(flat.fontWeight), color: flat.color ?? getDefaultTextColor() },
      },
      ref,
    );
  };
}
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { ThemeProvider, useTheme } from "./src/state/ThemeContext";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import { CartProvider } from "./src/state/CartContext";
import { usePushRegistration } from "./src/state/usePush";
import { promptBiometric, readBiometricState } from "./src/state/biometric";
import { RootNav, navigationRef } from "./src/navigation/RootNav";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import type { RootStackParamList } from "./src/navigation/RootNav";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Custom brand fonts (Manrope + Instrument Serif). Block render until the family is ready
  // so we never paint with the device default and then re-flow text
  // when the font swaps in.
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    InstrumentSerif_400Regular,
  });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <AppInner />
            </CartProvider>
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

  // Where the app opens. Signed-in users go straight in; everyone else
  // always starts at the onboarding slides (the way in to sign up, log in or
  // browse as a guest), on every launch.
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setInitialRoute(user ? "Tabs" : "Onboarding");
  }, [ready, user]);

  // Signing out from inside the app drops the user back at onboarding.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (user) {
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Onboarding" }] });
      }
    }
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

  const bootReady = ready && initialRoute !== null;
  const locked = !unlocked && needsBiometric === "yes";

  return (
    <View style={{ flex: 1, backgroundColor: "#17121F" }}>
      {bootReady ? (
        locked ? (
          <BiometricLockScreen onRetry={() => setUnlocked(false)} onSignOut={logout} />
        ) : (
          <RootNav initialRouteName={initialRoute!} />
        )
      ) : null}
      {/* Animated splash sits on top until the app is ready, then fades away. */}
      {!splashDone ? <AnimatedSplash ready={bootReady} onFinish={() => setSplashDone(true)} /> : null}
    </View>
  );
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