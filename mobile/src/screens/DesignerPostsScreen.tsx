import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Post = {
  id: string;
  title: string;
  image: string | null;
  likeCount: number;
  viewCount: number;
  saveCount: number;
  createdAt: string;
};

export function DesignerPostsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ posts: Post[] }>("/api/designer/posts");
      setItems(data.posts ?? []);
    } catch (err) {
      if (isNotFound(err)) setItems([]);
      else setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function deletePost(id: string) {
    Alert.alert("Delete post?", "It will be removed from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const prev = items;
          setItems((cur) => cur.filter((p) => p.id !== id));
          try {
            await api.delete(`/api/designer/posts/${id}`);
          } catch (err) {
            setItems(prev);
            Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  }

  return (
    <ListScaffold<Post>
      title="Manage posts"
      rightAction={
        <Pressable onPress={() => nav.navigate("NewPost")} hitSlop={8}>
          <Ionicons name="add" size={26} color={t.cta} />
        </Pressable>
      }
      data={items}
      keyExtractor={(p) => p.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      emptyIcon="albums-outline"
      emptyTitle="No posts yet"
      emptyMessage="Share a new design via the + button."
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, { backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="image-outline" size={24} color={t.textFaint} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.statsRow}>
              <Stat icon="heart-outline" value={item.likeCount} />
              <Stat icon="eye-outline" value={item.viewCount} />
              <Stat icon="bookmark-outline" value={item.saveCount} />
            </View>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          </View>
          <Pressable onPress={() => deletePost(item.id)} hitSlop={6}>
            <Ionicons name="trash-outline" size={20} color={t.danger.fg} />
          </Pressable>
        </View>
      )}
    />
  );
}

function Stat({ icon, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={t.textMuted} />
      <Text style={[type.small, { color: t.textMuted }]}>
        {value.toLocaleString("en-NG")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
});
