// Email-verification gate.
//
// Reached after register (always), and after sign-in when /api/me
// reports emailVerifiedAt === null. Shows a one-time "check your
// inbox" prompt, lets the user resend the verification email, and
// polls /api/me on focus + every 6s so as soon as the user taps the
// link in their email the screen advances to Tabs without them
// having to come back and tap anything.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POLL_INTERVAL_MS = 6000;

export function VerifyEmailScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, refresh, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const goVerified = useCallback(() => {
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }, [nav]);

  // If the user is already verified when this screen mounts, bounce
  // them straight through — avoids a flash for sessions that landed
  // here mid-flow.
  useEffect(() => {
    if (user?.emailVerifiedAt) goVerified();
  }, [user?.emailVerifiedAt, goVerified]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }, [refresh]);

  // Background-poll the user record so the moment the user taps the
  // email link in their browser the app side flips through.
  useEffect(() => {
    pollTimer.current = setInterval(() => {
      refresh().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [refresh]);

  // Refresh as soon as the app returns to the foreground — many users
  // will swipe to their email app to tap the link and then swipe back.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  async function resend() {
    setResending(true);
    try {
      const r = await api.post<{ ok: boolean; alreadyVerified?: boolean }>(
        "/api/auth/resend-verification",
        {},
      );
      if (r.alreadyVerified) {
        await refresh();
        goVerified();
        return;
      }
      setResentAt(Date.now());
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof Error ? err.message : "Try again.");
    } finally {
      setResending(false);
    }
  }

  async function signOut() {
    await logout();
    nav.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="mail-unread-outline" size={48} color={t.accent} />
        </View>
        <Text style={[type.h1, { color: t.text, textAlign: "center", marginTop: 18 }]}>
          Verify your email
        </Text>
        <Text style={[type.body, { color: t.textMuted, textAlign: "center", marginTop: 8, lineHeight: 22 }]}>
          We sent a verification link to{" "}
          <Text style={{ color: t.text, fontWeight: "800" }}>
            {user?.email ?? "your inbox"}
          </Text>
          . Tap the link to activate your account, then come back here.
        </Text>

        {resentAt ? (
          <View style={[styles.notice, { backgroundColor: t.success.bg }]}>
            <Ionicons name="checkmark-circle" size={16} color={t.success.fg} />
            <Text style={[type.small, { color: t.success.fg, marginLeft: 6 }]}>
              Resent — check your inbox (and spam folder).
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={checkNow}
          disabled={checking}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: t.cta, opacity: checking ? 0.7 : pressed ? 0.9 : 1 },
          ]}
        >
          {checking ? (
            <ActivityIndicator color={t.ctaText} />
          ) : (
            <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
              I've verified — continue
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={resend}
          disabled={resending}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: t.border, opacity: resending ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: t.text, fontWeight: "700" }}>
            {resending ? "Resending…" : "Resend email"}
          </Text>
        </Pressable>

        <Pressable onPress={signOut} hitSlop={8} style={styles.signOutLink}>
          <Text style={[type.small, { color: t.textMuted, textDecorationLine: "underline" }]}>
            Use a different email
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  primaryBtn: {
    marginTop: 28,
    width: "100%",
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutLink: { marginTop: 22 },
});
