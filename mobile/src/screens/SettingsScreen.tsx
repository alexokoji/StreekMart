import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { promptBiometric, readBiometricState, setBiometricEnabled, type BiometricState } from "../state/biometric";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme, useThemePreference, type ThemePreference } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { refreshPushRegistration } from "../state/usePush";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useThemePreference();

  const [pushBusy, setPushBusy] = useState(false);
  const [biometricState, setBiometricState] = React.useState<BiometricState | null>(null);
  React.useEffect(() => {
    readBiometricState().then(setBiometricState);
  }, []);
  async function toggleBiometric(next: boolean) {
    if (!biometricState) return;
    if (next) {
      // Verify before persisting -- prevents locking the user out if their
      // biometric is broken at the moment they tick the box.
      const ok = await promptBiometric(`Confirm ${biometricState.friendlyName} works`);
      if (!ok) return;
    }
    await setBiometricEnabled(next);
    setBiometricState({ ...biometricState, userOptedIn: next });
  }

  async function checkPush() {
    if (!user) {
      Alert.alert("Sign in", "You need an account to enable push notifications.");
      return;
    }
    setPushBusy(true);
    try {
      const result = await refreshPushRegistration(user.id);
      if (result === "registered") {
        Alert.alert("Done", "You're set to receive order, message, and verification alerts.");
      } else if (result === "denied") {
        Alert.alert(
          "Permission denied",
          "Enable notifications for StreekMart in your phone's Settings to receive alerts.",
        );
      } else {
        Alert.alert("Unsupported", "Push notifications require a physical device.");
      }
    } catch (err) {
      Alert.alert("Couldn't enable", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={[type.h1, { color: t.text }]}>Settings</Text>

      <Section title="Appearance">
        <Row label="Use system theme" desc="Match your phone's light/dark mode automatically.">
          <Switch
            value={preference === "system"}
            onValueChange={(v) => setPreference(v ? "system" : t.scheme)}
            trackColor={{ true: t.cta, false: t.border }}
          />
        </Row>
        {preference !== "system" && (
          <View style={styles.modeRow}>
            <ModeChip
              label="Light"
              active={preference === "light"}
              onPress={() => setPreference("light")}
            />
            <ModeChip
              label="Dark"
              active={preference === "dark"}
              onPress={() => setPreference("dark")}
            />
          </View>
        )}
      </Section>

      {biometricState?.hardwareAvailable && (
        <Section title="Security">
          <Row label={`Unlock with ${biometricState.friendlyName}`} desc="Require biometric authentication every time you open the app.">
            <Switch
              value={biometricState.userOptedIn}
              onValueChange={toggleBiometric}
              trackColor={{ true: t.cta, false: t.border }}
            />
          </Row>
        </Section>
      )}

      <Section title="Notifications">
        <Row
          label="Push notifications"
          desc="Order updates, replies, and verification decisions."
        >
          <Button
            label={pushBusy ? "Checking…" : "Manage"}
            variant="secondary"
            onPress={checkPush}
            loading={pushBusy}
          />
        </Row>
      </Section>

      {user ? (
        <Section title="Account">
          <LinkRow label="Email" value={user.email} />
          {user.referralCode && (
            <LinkRow label="Referral code" value={user.referralCode} />
          )}
          {typeof user.pointsBalance === "number" && (
            <LinkRow
              label="Points balance"
              value={user.pointsBalance.toLocaleString()}
            />
          )}
          <Button
            label="Sign out"
            variant="danger"
            onPress={() =>
              Alert.alert("Sign out?", "You'll need to sign in again on next launch.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: () => logout() },
              ])
            }
            style={{ marginTop: 16 }}
          />
        </Section>
      ) : (
        <Section title="Account">
          <Button label="Sign in" onPress={() => nav.navigate("Login")} />
        </Section>
      )}

      <Section title="About">
        <LinkRow label="App version" value="2.0.0 (native)" />
        <LinkRow label="Server" value="streekmart.online" />
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={[type.micro, { color: t.textMuted, marginBottom: 8 }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[type.body, { color: t.text }]}>{label}</Text>
        {desc && (
          <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{desc}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function LinkRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? t.cta : t.bgElevated,
          borderColor: active ? t.cta : t.border,
        },
      ]}
    >
      <Text style={{ color: active ? t.ctaText : t.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    gap: 8,
  },
  modeRow: { flexDirection: "row", gap: 8, padding: 14, paddingTop: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
