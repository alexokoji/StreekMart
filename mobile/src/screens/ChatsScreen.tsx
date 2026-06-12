import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
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
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to see your messages.</Text>
        <Button label="Sign in" style={{ marginTop: 12 }} onPress={() => nav.navigate("Login")} />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }

  return (
    <Screen padding={false}>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <Text style={[type.h1, { color: t.text, marginBottom: 8 }]}>Messages</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
              No conversations yet. Open a product and tap "Message seller" to start one.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate("Chat", { id: item.id, counterpartName: item.counterpart?.name ?? "Chat" })}
            style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 14 }}>
                {(item.counterpart?.name ?? "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                  {item.counterpart?.name ?? "Unknown"}
                </Text>
                <Text style={[type.small, { color: t.textMuted }]}>
                  {new Date(item.updatedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {item.lastMessage?.body ?? "No messages yet"}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 32, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});