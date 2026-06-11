import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Minimal registration form for V2 mobile. Country/city default to Nigeria/
// Lagos since that's the bulk of the user base today — they can correct
// from /account → settings on web for now. A native location picker is on
// the V2.1 list.
export function RegisterScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { register, signingIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  async function submit() {
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
      nav.goBack();
    } catch (err) {
      Alert.alert("Couldn't create account", err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <Screen keyboard>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[type.display, { color: t.text }]}>Join StreekMart</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]}>
          Shop fabrics, fashion, and designer drops.
        </Text>

        <Field t={t} label="Full name" value={name} onChange={setName} />
        <Field t={t} label="Email" value={email} onChange={setEmail} keyboardType="email-address" />
        <Field t={t} label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Field t={t} label="Password" value={password} onChange={setPassword} secure />
        <Field t={t} label="Referral code (optional)" value={referralCode} onChange={setReferralCode} />

        <Button
          label="Create account"
          loading={signingIn}
          disabled={!name.trim() || !email.trim() || !phone.trim() || password.length < 8}
          onPress={submit}
          style={{ marginTop: 20 }}
        />

        <Pressable onPress={() => nav.replace("Login")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={[type.small, { color: t.textMuted }]}>
            Already have an account? <Text style={{ color: t.accent, fontWeight: "600" }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field({
  t,
  label,
  value,
  onChange,
  keyboardType,
  secure,
}: {
  t: ReturnType<typeof useTheme>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[type.small, { color: t.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        secureTextEntry={secure}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={t.textFaint}
        style={[
          styles.input,
          { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 14, gap: 6 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
});
