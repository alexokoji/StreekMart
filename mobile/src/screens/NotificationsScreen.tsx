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

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

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
    // V2: parse n.link and route. For now we just mark read.
  }

  if (!user) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to see your notifications.</Text>
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
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <View>
            <Text style={[type.h1, { color: t.text }]}>Notifications</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              {unread === 0 ? "All caught up." : `${unread} unread`}
            </Text>
            {unread > 0 && (
              <Button label="Mark all read" variant="secondary" onPress={markAll} style={{ marginTop: 12 }} />
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>Nothing yet.</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => tap(item)}
            style={[
              styles.row,
              {
                backgroundColor: t.card,
                borderColor: t.border,
                opacity: item.readAt ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ width: 8, alignItems: "center", paddingTop: 6 }}>
              <View style={[styles.dot, { backgroundColor: item.readAt ? t.border : t.cta }]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[type.small, { color: t.textMuted }]}>
                  {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]} numberOfLines={3}>
                {item.body}
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
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});