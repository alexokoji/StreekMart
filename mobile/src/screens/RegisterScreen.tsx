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

// Sign-up flow. Country/city default to Nigeria/Lagos for now; the user
// can correct from the web settings page. A native location picker
// lands in a later round.
export function RegisterScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { register, signingIn } = useAuth();
  const { signIn: signInWithOAuth, busy: oauthBusy, appleSupported } = useOAuthSignIn();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const passwordsMatch = password.length === 0 || password === confirm;
  const formValid =
    !!name.trim() && !!email.trim() && !!phone.trim() && password.length >= 8 && passwordsMatch;

  async function submit() {
    if (!passwordsMatch) {
      Alert.alert("Check passwords", "The two passwords don't match.");
      return;
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        country: "NG",
        city: "Lagos",
        referralCode: referralCode.trim() || undefined,
      });
      // /api/auth/register fires the verification email automatically.
      // Gate the buyer behind VerifyEmail until /api/me reports the
      // address as verified; the screen self-advances to Tabs as soon
      // as that flips, so nothing here decides between the two paths.
      nav.reset({ index: 0, routes: [{ name: "VerifyEmail" }] });
    } catch (err) {
      Alert.alert("Couldn't create account", err instanceof Error ? err.message : "Try again.");
    }
  }

  const disabled = signingIn || !formValid;

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
        <BrandMark style={{ marginBottom: 22 }} />

        <Text style={[styles.headline, { color: t.text }]}>Create an account</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 6 }]}>
          A few details and you're shopping.
        </Text>

        <View style={{ marginTop: 24, gap: 14 }}>
          <Input
            leftIcon={<Ionicons name="person-outline" size={18} color={t.textMuted} />}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
          />
          <Input
            leftIcon={<Ionicons name="mail-outline" size={18} color={t.textMuted} />}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email"
          />
          <Input
            leftIcon={<Ionicons name="call-outline" size={18} color={t.textMuted} />}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Phone"
          />
          <PasswordInput
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={t.textMuted} />}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8+ chars)"
          />
          <PasswordInput
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={t.textMuted} />}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
          />
          <Input
            leftIcon={<Ionicons name="gift-outline" size={18} color={t.textMuted} />}
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            placeholder="Referral code (optional)"
          />
        </View>

        {!passwordsMatch ? (
          <Text style={[type.small, { color: t.danger.fg, marginTop: 8 }]}>
            Passwords don't match.
          </Text>
        ) : null}

        <Text style={[type.small, { color: t.textMuted, marginTop: 14, lineHeight: 18 }]}>
          By tapping Create account you agree to StreekMart's{" "}
          <Text style={{ color: t.cta, fontWeight: "700" }}>Terms</Text> and{" "}
          <Text style={{ color: t.cta, fontWeight: "700" }}>Privacy Policy</Text>.
        </Text>

        <Pressable
          onPress={submit}
          disabled={disabled}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: disabled ? 0.55 : pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>
            {signingIn ? "Creating account…" : "Create account"}
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
          <Text style={[type.body, { color: t.textMuted }]}>Already have an account? </Text>
          <Pressable onPress={() => nav.navigate("Login")} hitSlop={6}>
            <Text style={[type.body, { color: t.cta, fontWeight: "700" }]}>Sign in</Text>
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
    marginTop: 22,
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
