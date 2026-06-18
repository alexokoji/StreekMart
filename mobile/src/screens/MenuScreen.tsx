import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { BackHeader } from "../components/BackHeader";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Drawer-style menu surfaced from the hamburger on the LogoBar. Holds
// the secondary surfaces that didn't make it into the primary tab
// bar -- Feed (designer posts), Notifications, Orders, Preorders,
// Coupons, plus the role dashboards once the user has them.
export function MenuScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Menu" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {user ? (
          <View style={[styles.userCard, { backgroundColor: t.cta }]}>
            <View style={[styles.userAvatar, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
              <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 22 }}>
                {user.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: t.ctaText }]}>{user.name}</Text>
              <Text style={[type.small, { color: t.ctaText, opacity: 0.85 }]}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.userCard, { backgroundColor: t.card, borderColor: t.border, borderWidth: 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: t.text }]}>Welcome</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                Sign in to track orders, save items, and chat with sellers.
              </Text>
            </View>
            <Pressable
              onPress={() => nav.navigate("Login")}
              style={[styles.smallCta, { backgroundColor: t.cta }]}
            >
              <Text style={{ color: t.ctaText, fontWeight: "700" }}>Sign in</Text>
            </Pressable>
          </View>
        )}

        <Group title="Browse">
          <Row label="Designer feed" onPress={() => goToTab(nav, "Feed")} />
          <Row label="Categories" onPress={() => nav.navigate("Categories")} />
          <Row label="Trending products" onPress={() => goToTab(nav, "Search")} />
        </Group>

        {user ? (
          <Group title="Your account">
            <Row label="Orders" onPress={() => nav.navigate("Orders")} />
            <Row label="Notifications" onPress={() => nav.navigate("Notifications")} />
            <Row label="Coupons" onPress={() => nav.navigate("Coupons")} />
            <Row label="Addresses" onPress={() => nav.navigate("Addresses")} />
            <Row label="Payment methods" onPress={() => nav.navigate("PaymentMethods")} />
            <Row label="Messages" onPress={() => nav.navigate("Chats")} />
          </Group>
        ) : null}

        {user && (user.isSeller || user.isDesigner) ? (
          <Group title="Dashboards">
            {user.isSeller ? <Row label="Seller dashboard" onPress={() => nav.navigate("SellerDashboard")} /> : null}
            {user.isDesigner ? <Row label="Designer dashboard" onPress={() => nav.navigate("DesignerDashboard")} /> : null}
          </Group>
        ) : null}

        <Group title="App">
          <Row label="Settings" onPress={() => nav.navigate("Settings")} />
          {user ? <Row label="Sign out" tone="danger" onPress={() => logout()} /> : null}
        </Group>
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

function Row({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: "danger";
}) {
  const t = useTheme();
  const color = tone === "danger" ? t.danger.fg : t.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? t.bg : "transparent", borderBottomColor: t.border },
      ]}
    >
      <Text style={[type.body, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCta: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
