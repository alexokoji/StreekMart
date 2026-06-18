import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotifTone = "primary" | "promo" | "gold" | "info" | "success";

function iconFor(notifType: string): {
  name: React.ComponentProps<typeof Ionicons>["name"];
  tone: NotifTone;
} {
  const k = notifType.toLowerCase();
  if (k.includes("order")) return { name: "cube-outline", tone: "info" };
  if (k.includes("message") || k.includes("chat")) return { name: "chatbubble-outline", tone: "primary" };
  if (k.includes("promo") || k.includes("offer") || k.includes("sale")) return { name: "pricetag-outline", tone: "promo" };
  if (k.includes("payout") || k.includes("payment")) return { name: "cash-outline", tone: "gold" };
  if (k.includes("verif") || k.includes("approval")) return { name: "checkmark-circle-outline", tone: "success" };
  return { name: "notifications-outline", tone: "primary" };
}

function chipColors(t: ReturnType<typeof useTheme>, tone: NotifTone) {
  switch (tone) {
    case "promo": return { bg: "rgba(217,70,239,0.15)", fg: t.promo };
    case "gold": return { bg: "rgba(207,159,50,0.18)", fg: t.premium };
    case "info": return { bg: "rgba(124,58,237,0.15)", fg: t.cta };
    case "success": return { bg: t.success.bg, fg: t.success.fg };
    default: return { bg: t.accentSoft, fg: t.accent };
  }
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

export function NotificationsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ notifications: Notification[]; unreadCount: number }>("/api/notifications");
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markAll() {
    try {
      await api.patch("/api/notifications", { all: true });
      setItems((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      // ignore
    }
  }

  async function tap(n: Notification) {
    if (!n.readAt) {
      try {
        await api.patch("/api/notifications", { id: n.id });
        setItems((cur) => cur.map((x) => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        // ignore
      }
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Notifications" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to see updates from your orders, messages, and offers.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 16 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700" }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader
        title="Notifications"
        rightAction={
          unread > 0 ? (
            <Pressable onPress={markAll} hitSlop={8}>
              <Text style={[type.bodyStrong, { color: t.cta }]}>Mark all</Text>
            </Pressable>
          ) : null
        }
      />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <Text style={[type.small, { color: t.textMuted, marginBottom: 8 }]}>
              {unread === 0 ? "You're all caught up." : `${unread} unread`}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
                Nothing here yet. We'll let you know when something happens.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          renderItem={({ item }) => {
            const g = iconFor(item.type);
            const c = chipColors(t, g.tone);
            const isUnread = !item.readAt;
            return (
              <Pressable
                onPress={() => tap(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: t.card,
                    borderColor: isUnread ? t.cta : t.border,
                    borderWidth: isUnread ? 1 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.glyph, { backgroundColor: c.bg }]}>
                  <Ionicons name={g.name} size={20} color={c.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowHead}>
                    <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[type.small, { color: t.textMuted, marginLeft: 8 }]}>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]} numberOfLines={3}>
                    {item.body}
                  </Text>
                </View>
                {isUnread ? <View style={[styles.unreadDot, { backgroundColor: t.cta }]} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  pill: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    alignItems: "flex-start",
  },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowHead: { flexDirection: "row", alignItems: "center" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    marginLeft: 4,
  },
});
