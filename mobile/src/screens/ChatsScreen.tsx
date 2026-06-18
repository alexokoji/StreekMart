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

type Counterpart = { id: string; name: string; isSeller?: boolean; isDesigner?: boolean; avatarUrl?: string | null };
type ChatRow = {
  id: string;
  updatedAt: string;
  counterpart: Counterpart | null;
  lastMessage: { body: string | null; createdAt: string; senderId: string } | null;
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function avatarColor(seed: string, t: ReturnType<typeof useTheme>) {
  const colors = [t.cta, t.promo, t.premium, t.accent, t.success.fg];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

export function ChatsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ chats: ChatRow[] }>("/api/chats");
      setChats(data.chats ?? []);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Messages" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to chat with sellers and designers.
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
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Messages" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Messages" />
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 4 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={t.textMuted} />
            <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>
              No conversations yet
            </Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
              Open a product and tap "Message seller" to start chatting.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => {
          const name = item.counterpart?.name ?? "Unknown";
          const role = item.counterpart?.isSeller
            ? "Seller"
            : item.counterpart?.isDesigner
              ? "Designer"
              : null;
          const initial = name.slice(0, 1).toUpperCase();
          const last = item.lastMessage?.body ?? "No messages yet";
          return (
            <Pressable
              onPress={() => nav.navigate("Chat", { id: item.id, counterpartName: name })}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: t.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColor(name, t) }]}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
                    <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {role ? (
                      <View style={[styles.roleChip, { backgroundColor: t.accentSoft }]}>
                        <Text style={{ color: t.accent, fontSize: 10, fontWeight: "800" }}>
                          {role.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[type.small, { color: t.textMuted, marginLeft: 8 }]}>
                    {timeAgo(item.updatedAt)}
                  </Text>
                </View>
                <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]} numberOfLines={1}>
                  {last}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  pill: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.pill },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rowHead: { flexDirection: "row", alignItems: "center" },
  roleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
