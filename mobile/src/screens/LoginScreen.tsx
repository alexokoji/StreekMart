import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { loginWithPassword, signingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit() {
    try {
      await loginWithPassword(email.trim(), password);
      nav.goBack();
    } catch (err) {
      Alert.alert("Sign-in failed", err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <Screen keyboard>
      <Text style={[type.display, { color: t.text }]}>Welcome back</Text>
      <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]}>
        Sign in to keep shopping where you left off.
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
          style={[styles.input, { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[type.small, { color: t.textMuted }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          secureTextEntry
          placeholder="Your password"
          placeholderTextColor={t.textFaint}
          style={[styles.input, { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text }]}
        />
      </View>

      <Pressable onPress={() => nav.navigate("ForgotPassword")} style={{ marginTop: 8, alignItems: "flex-end" }}>
        <Text style={[type.small, { color: t.accent, fontWeight: "600" }]}>Forgot your password?</Text>
      </Pressable>
      <Button
        label="Sign in"
        loading={signingIn}
        disabled={!email.trim() || !password}
        onPress={submit}
        style={{ marginTop: 16 }}
      />

      <Pressable onPress={() => nav.replace("Register")} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={[type.small, { color: t.textMuted }]}>
          Don't have an account? <Text style={{ color: t.accent, fontWeight: "600" }}>Create one</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 16, gap: 6 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
});
