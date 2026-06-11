import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AccountScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Screen>
        <Text style={[type.h1, { color: t.text }]}>Welcome</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 6 }]}>
          Sign in to save items, order, and chat with sellers.
        </Text>
        <Button label="Sign in" style={{ marginTop: 16 }} onPress={() => nav.navigate("Login")} />
        <Button
          label="Create an account"
          variant="secondary"
          style={{ marginTop: 10 }}
          onPress={() => nav.navigate("Register")}
        />
        <Pressable onPress={() => nav.navigate("Settings")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={[type.small, { color: t.textMuted }]}>App settings →</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={[styles.heroCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.avatar, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 22 }}>
            {user.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.h2, { color: t.text }]}>{user.name}</Text>
          <Text style={[type.small, { color: t.textMuted }]}>{user.email}</Text>
          {user.referralCode && (
            <Text style={[type.small, { color: t.accent, marginTop: 4 }]}>
              Referral code: {user.referralCode}
            </Text>
          )}
        </View>
      </View>

      {typeof user.pointsBalance === "number" && (
        <View style={[styles.pointsCard, { backgroundColor: t.cta }]}>
          <Text style={[type.small, { color: t.ctaText, opacity: 0.85 }]}>POINTS</Text>
          <Text style={[type.display, { color: t.ctaText, marginTop: 4 }]}>
            {user.pointsBalance.toLocaleString()}
          </Text>
          <Text style={[type.small, { color: t.ctaText, opacity: 0.85, marginTop: 4 }]}>
            Refer friends to earn more.
          </Text>
        </View>
      )}

      <View style={styles.linksList}>
        <LinkRow label="My orders" onPress={() => nav.navigate("Settings")} />
        <LinkRow label="My preorders" onPress={() => nav.navigate("Settings")} />
        <LinkRow label="Wishlist" onPress={() => nav.navigate("Settings")} />
        <LinkRow label="Messages" onPress={() => nav.navigate("Settings")} />
        <LinkRow label="Settings & notifications" onPress={() => nav.navigate("Settings")} />
      </View>

      <Button
        label="Sign out"
        variant="danger"
        style={{ marginTop: 24 }}
        onPress={() =>
          Alert.alert("Sign out?", "You'll need to sign in again on next launch.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => logout() },
          ])
        }
      />
    </Screen>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <Text style={{ color: t.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pointsCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: radius.lg,
  },
  linksList: { marginTop: 18, gap: 8 },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
