import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { DailyCheckIn } from "../components/DailyCheckIn";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Bottom padding to clear the centre Search FAB on the new BottomNav.
const FAB_CLEARANCE = 24;

// Account hub. Profile card + daily-rewards card on top, then grouped
// rows for orders/notifications/coupons/addresses etc. Role
// dashboards surface only for users that actually have the role.
export function AccountScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top"]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={[type.h1, { color: t.text }]}>Welcome</Text>
          <Text style={[type.body, { color: t.textMuted, marginTop: 6 }]}>
            Sign in to track orders, save items, and chat with sellers.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.fullPill,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 18 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700", fontSize: 16 }}>Sign in</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("Register")}
            style={({ pressed }) => [
              styles.fullPill,
              {
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.cta,
                marginTop: 10,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={{ color: t.cta, fontWeight: "700", fontSize: 16 }}>Create an account</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("Settings")}
            style={{ marginTop: 18, alignItems: "center" }}
          >
            <Text style={[type.small, { color: t.textMuted }]}>App settings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: FAB_CLEARANCE }}>
        {/* Profile card — tap anywhere to edit. */}
        <Pressable
          onPress={() => nav.navigate("EditProfile")}
          style={({ pressed }) => [
            styles.profileCard,
            { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={{ position: "relative" }}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: t.cta, alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 24 }}>
                  {user.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.editPip, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Ionicons name="camera" size={11} color={t.ctaText} />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[type.h2, { color: t.text }]}>{user.name}</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{user.email}</Text>
            {user.referralCode ? (
              <View style={[styles.referralTag, { backgroundColor: t.accentSoft }]}>
                <Text style={[type.small, { color: t.accent, fontWeight: "700" }]}>
                  Code: {user.referralCode}
                </Text>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
        </Pressable>

        {/* Daily rewards */}
        <DailyCheckIn />

        {/* Shopping group */}
        <Group title="Shopping">
          <Row icon={<Ionicons name="cube-outline" size={18} />} label="My orders" onPress={() => nav.navigate("Orders")} />
          <Row icon={<Ionicons name="time-outline" size={18} />} label="Preorders" onPress={() => nav.navigate("Preorders", { role: "buyer" })} />
          <Row icon={<Ionicons name="heart-outline" size={18} />} label="Wishlist" onPress={() => nav.navigate("Wishlist")} />
          <Row icon={<Ionicons name="ticket-outline" size={18} />} label="Coupons" onPress={() => nav.navigate("Coupons")} />
          <Row icon={<Ionicons name="location-outline" size={18} />} label="Delivery addresses" onPress={() => nav.navigate("Addresses")} last />
        </Group>

        {/* Verification — relevant to sellers / designers wanting the badge. */}
        {user.isSeller || user.isDesigner ? (
          <Group title="Trust">
            <Row
              icon={<Ionicons name="shield-checkmark-outline" size={18} />}
              label="Verification"
              onPress={() => nav.navigate("Verification")}
              last
            />
          </Group>
        ) : null}

        {/* Communication group */}
        <Group title="Communication">
          <Row icon={<Ionicons name="chatbubble-ellipses-outline" size={18} />} label="Messages" onPress={() => nav.navigate("Chats")} />
          <Row icon={<Ionicons name="notifications-outline" size={18} />} label="Notifications" onPress={() => nav.navigate("Notifications")} last />
        </Group>

        {/* Wallet group */}
        <Group title="Wallet">
          <Row icon={<Ionicons name="wallet-outline" size={18} />} label="Wallet" onPress={() => nav.navigate("Wallet")} />
          <Row icon={<Ionicons name="card-outline" size={18} />} label="Payment methods" onPress={() => nav.navigate("PaymentMethods")} last />
        </Group>

        <Group title="Your account">
          {!(user.isSeller && user.isDesigner) ? (
            <Row icon={<Ionicons name="swap-horizontal-outline" size={18} />} label={user.isSeller || user.isDesigner ? "Add another account type" : "Become a seller or designer"} onPress={() => nav.navigate("AccountType")} />
          ) : null}
          <Row icon={<Ionicons name="trash-outline" size={18} />} label="Delete my data" tone="danger" onPress={() => nav.navigate("DeleteAccount")} last />
        </Group>
      </ScrollView>
    </SafeAreaView>
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
  icon,
  label,
  onPress,
  tone,
  last,
}: {
  icon: React.ReactElement<{ color?: string }>;
  label: string;
  onPress: () => void;
  tone?: "danger";
  last?: boolean;
}) {
  const t = useTheme();
  const color = tone === "danger" ? t.danger.fg : t.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? t.bg : "transparent",
          borderBottomColor: t.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone === "danger" ? "rgba(155,11,34,0.10)" : t.bg }]}>
        {React.cloneElement(icon, { color })}
      </View>
      <Text style={[type.body, { color, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editPip: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  referralTag: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fullPill: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
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
  roleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    marginTop: 14,
  },
  roleBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
