import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
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
      await api.post("/api/auth/forgot-password", { email: email.trim() }, { noAuth: true });
      setSent(true);
    } catch (err) {
      // Endpoint returns 200 even for unknown emails so this branch is rare.
      Alert.alert("Try again", err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={[styles.card, { backgroundColor: t.success.bg }]}>
          <Text style={[type.h2, { color: t.success.fg }]}>Check your email</Text>
          <Text style={[type.body, { color: t.success.fg, marginTop: 8 }]}>
            If an account exists for {email}, we sent a reset link. It expires in 60 minutes.
          </Text>
        </View>
        <Button label="Back to sign in" style={{ marginTop: 16 }} onPress={() => nav.replace("Login")} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Text style={[type.display, { color: t.text }]}>Forgot your password?</Text>
      <Text style={[type.body, { color: t.textMuted, marginTop: 6 }]}>
        Enter your account email. We'll send you a link to choose a new one.
      </Text>
      <View style={styles.field}>
        <Text style={[type.small, { color: t.textMuted }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={t.textFaint}
          style={[styles.input, { color: t.text, backgroundColor: t.bgElevated, borderColor: t.border }]}
        />
      </View>
      <Button label="Send reset link" loading={busy} disabled={!email.trim()} onPress={submit} style={{ marginTop: 16 }} />
      <Pressable onPress={() => nav.goBack()} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={[type.small, { color: t.textMuted }]}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 18, gap: 6 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  card: { padding: 16, borderRadius: radius.md },
});