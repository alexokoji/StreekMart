import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ForgotPasswordScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post(
        "/api/auth/forgot-password",
        { email: email.trim() },
        { noAuth: true },
      );
      setSent(true);
    } catch (err) {
      Alert.alert("Try again", err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader />
        <View style={styles.confirm}>
          <View style={[styles.tickRing, { borderColor: t.cta }]}>
            <Ionicons name="checkmark" size={48} color={t.cta} />
          </View>
          <Text style={[styles.confirmHead, { color: t.text }]}>Check your inbox</Text>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center", marginTop: 8 }]}>
            If an account exists for {email}, we've sent a reset link. It expires in 60 minutes.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 28, width: "100%" },
            ]}
          >
            <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: t.text }]}>Forgot password?</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 8, lineHeight: 22 }]}>
          Enter the email on your account — we'll send a reset link that expires in 60 minutes.
        </Text>

        <View style={{ marginTop: 24 }}>
          <Input
            leftIcon={<Ionicons name="mail-outline" size={18} color={t.textMuted} />}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email address"
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={busy || !email.trim()}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: t.cta,
              opacity: busy || !email.trim() ? 0.55 : pressed ? 0.9 : 1,
              marginTop: 24,
            },
          ]}
        >
          <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>
            {busy ? "Sending…" : "Send reset link"}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  headline: { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  tickRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  confirmHead: { fontSize: 24, fontWeight: "800" },
});
