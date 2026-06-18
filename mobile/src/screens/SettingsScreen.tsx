import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemePreference, type ThemePreference } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { promptBiometric, readBiometricState, setBiometricEnabled, type BiometricState } from "../state/biometric";
import { refreshPushRegistration } from "../state/usePush";
import { BackHeader } from "../components/BackHeader";
import { Chip } from "../components/Chip";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Visual settings hub. Grouped rows in the same idiom as AccountScreen.
// Sections only render when they're relevant -- e.g. the biometric
// toggle is hidden on devices with no biometric hardware.
export function SettingsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useThemePreference();

  const [pushBusy, setPushBusy] = useState(false);
  const [biometricState, setBiometricState] = useState<BiometricState | null>(null);

  useEffect(() => {
    readBiometricState().then(setBiometricState);
  }, []);

  async function toggleBiometric(next: boolean) {
    if (!biometricState) return;
    if (next) {
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
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}>
        {/* Appearance */}
        <Group title="Appearance">
          <ToggleRow
            icon={<Ionicons name="contrast-outline" size={18} />}
            label="Use system theme"
            desc="Match your phone's light or dark mode."
            value={preference === "system"}
            onValueChange={(v) => setPreference(v ? "system" : t.scheme)}
          />
          {preference !== "system" ? (
            <View style={[styles.chipRow, { borderTopColor: t.border }]}>
              <Chip
                label="Light"
                selected={preference === "light"}
                onPress={() => setPreference("light" as ThemePreference)}
              />
              <Chip
                label="Dark"
                selected={preference === "dark"}
                onPress={() => setPreference("dark" as ThemePreference)}
              />
            </View>
          ) : null}
        </Group>

        {/* Security */}
        {biometricState?.hardwareAvailable ? (
          <Group title="Security">
            <ToggleRow
              icon={<Ionicons name="finger-print-outline" size={18} />}
              label={`Unlock with ${biometricState.friendlyName}`}
              desc="Require biometric authentication every time you open the app."
              value={biometricState.userOptedIn}
              onValueChange={toggleBiometric}
              last
            />
          </Group>
        ) : null}

        {/* Notifications */}
        <Group title="Notifications">
          <PressableRow
            icon={<Ionicons name="notifications-outline" size={18} />}
            label="Push notifications"
            desc="Order updates, replies, and verification decisions."
            actionLabel={pushBusy ? "Checking…" : "Manage"}
            onPress={checkPush}
            last
          />
        </Group>

        {/* Account */}
        {user ? (
          <Group title="Account">
            <InfoRow icon={<Ionicons name="mail-outline" size={18} />} label="Email" value={user.email} />
            {user.referralCode ? (
              <InfoRow icon={<Ionicons name="gift-outline" size={18} />} label="Referral code" value={user.referralCode} />
            ) : null}
            {typeof user.pointsBalance === "number" ? (
              <InfoRow icon={<Ionicons name="sparkles-outline" size={18} />} label="Points balance" value={user.pointsBalance.toLocaleString()} last />
            ) : (
              <InfoRow icon={<Ionicons name="person-outline" size={18} />} label="Status" value={user.isSeller ? "Seller" : user.isDesigner ? "Designer" : "Member"} last />
            )}
          </Group>
        ) : (
          <Group title="Account">
            <PressableRow
              icon={<Ionicons name="log-in-outline" size={18} />}
              label="Sign in"
              desc="Track orders, save items, message sellers."
              actionLabel="Sign in"
              onPress={() => nav.navigate("Login")}
              last
            />
          </Group>
        )}

        {/* About */}
        <Group title="About">
          <InfoRow icon={<Ionicons name="information-circle-outline" size={18} />} label="App version" value="2.0.0 (native)" />
          <InfoRow icon={<Ionicons name="globe-outline" size={18} />} label="Server" value="streekmart.online" last />
        </Group>

        {user ? (
          <Pressable
            onPress={() =>
              Alert.alert("Sign out?", "You'll need to sign in again on next launch.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: () => logout() },
              ])
            }
            style={({ pressed }) => [
              styles.signOutBtn,
              { backgroundColor: t.danger.bg, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: t.danger.fg, fontWeight: "700", fontSize: 16 }}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[type.micro, { color: t.textMuted, letterSpacing: 1.2, marginBottom: 8 }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onValueChange,
  last,
}: {
  icon: React.ReactElement<{ color?: string }>;
  label: string;
  desc?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        {React.cloneElement(icon, { color: t.text })}
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[type.body, { color: t.text }]}>{label}</Text>
        {desc ? <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: t.cta, false: t.border }} />
    </View>
  );
}

function PressableRow({
  icon,
  label,
  desc,
  actionLabel,
  onPress,
  last,
}: {
  icon: React.ReactElement<{ color?: string }>;
  label: string;
  desc?: string;
  actionLabel: string;
  onPress: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        {React.cloneElement(icon, { color: t.text })}
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[type.body, { color: t.text }]}>{label}</Text>
        {desc ? <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{desc}</Text> : null}
      </View>
      <Pressable onPress={onPress} hitSlop={6}>
        <Text style={[type.bodyStrong, { color: t.cta }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ReactElement<{ color?: string }>;
  label: string;
  value: string;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        {React.cloneElement(icon, { color: t.text })}
      </View>
      <Text style={[type.body, { color: t.text, flex: 1 }]}>{label}</Text>
      <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  signOutBtn: {
    marginTop: 28,
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
