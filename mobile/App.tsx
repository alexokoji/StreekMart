// StreekMart mobile shell (v2 - native).

import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "./src/state/ThemeContext";
import { AuthProvider, useAuth } from "./src/state/AuthContext";
import { usePushRegistration } from "./src/state/usePush";
import { promptBiometric, readBiometricState } from "./src/state/biometric";
import { RootNav } from "./src/navigation/RootNav";

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
  const { user, ready, logout } = useAuth();
  usePushRegistration(user?.id);

  // Biometric gate. On cold start, if the user is signed in AND has
  // opted in to biometric, prompt once before unlocking the app. If
  // they fail or cancel, give them the option to retry or sign out so
  // they don't get stuck.
  const [unlocked, setUnlocked] = useState(false);
  const [needsBiometric, setNeedsBiometric] = useState<"checking" | "yes" | "no">("checking");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      // No session -- nothing to unlock. The login screens are public.
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
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (!unlocked && needsBiometric === "yes") {
    return <BiometricLockScreen onRetry={() => setUnlocked(false)} onSignOut={logout} />;
  }

  return <RootNav />;
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