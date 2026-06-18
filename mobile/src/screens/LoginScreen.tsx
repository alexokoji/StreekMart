import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Input, PasswordInput } from "../components/Input";
import { BrandMark } from "../components/BrandMark";
import { SocialButton } from "../components/SocialButton";
import { useOAuthSignIn } from "../state/useOAuthSignIn";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { loginWithPassword, signingIn } = useAuth();
  const { signIn: signInWithOAuth, busy: oauthBusy, appleSupported } = useOAuthSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit() {
    try {
      await loginWithPassword(email.trim(), password);
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (err) {
      Alert.alert("Sign-in failed", err instanceof Error ? err.message : "Try again.");
    }
  }

  const disabled = signingIn || !email.trim() || !password;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <BrandMark style={{ marginBottom: 28 }} />

        <Text style={[styles.headline, { color: t.text }]}>Welcome back</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 6 }]}>
          Sign in to pick up where you left off.
        </Text>

        <View style={{ marginTop: 28, gap: 14 }}>
          <Input
            leftIcon={<Ionicons name="mail-outline" size={18} color={t.textMuted} />}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email"
          />
          <PasswordInput
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={t.textMuted} />}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
          />
        </View>

        <Pressable
          onPress={() => nav.navigate("ForgotPassword")}
          hitSlop={8}
          style={{ alignSelf: "flex-end", marginTop: 10 }}
        >
          <Text style={[type.small, { color: t.cta, fontWeight: "700" }]}>Forgot password?</Text>
        </Pressable>

        <Pressable
          onPress={submit}
          disabled={disabled}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: disabled ? 0.55 : pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>
            {signingIn ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
          <Text style={[type.small, { color: t.textMuted, marginHorizontal: 12 }]}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
        </View>

        <View style={styles.socials}>
          <SocialButton
            provider="google"
            loading={oauthBusy === "google"}
            disabled={oauthBusy !== null && oauthBusy !== "google"}
            onPress={() => signInWithOAuth("google")}
          />
          {appleSupported ? (
            <SocialButton
              provider="apple"
              loading={oauthBusy === "apple"}
              disabled={oauthBusy !== null && oauthBusy !== "apple"}
              onPress={() => signInWithOAuth("apple")}
            />
          ) : null}
          <SocialButton
            provider="facebook"
            loading={oauthBusy === "facebook"}
            disabled={oauthBusy !== null && oauthBusy !== "facebook"}
            onPress={() => signInWithOAuth("facebook")}
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={[type.body, { color: t.textMuted }]}>New here? </Text>
          <Pressable onPress={() => nav.navigate("Register")} hitSlop={6}>
            <Text style={[type.body, { color: t.cta, fontWeight: "700" }]}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  headline: { fontSize: 30, fontWeight: "800" },
  cta: {
    marginTop: 24,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerRow: { flexDirection: "row", alignItems: "center", marginTop: 30, marginBottom: 18 },
  dividerLine: { height: 1, flex: 1 },
  socials: { flexDirection: "row", justifyContent: "center", gap: 18 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
});
