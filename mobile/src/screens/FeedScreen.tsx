import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

const FAB_CLEARANCE = 110;

type Post = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  author: { id: string; name: string };
  likeCount: number;
  commentCount: number;
  saved?: boolean;
};

export function FeedScreen() {
  const t = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api
        .get<{ posts: Post[] }>("/api/posts", { limit: 20 })
        .catch(() => ({ posts: [] }));
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.header}>
        <Text style={[styles.headline, { color: t.text }]}>Designer feed</Text>
        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
          Fresh drops and inspiration from independent designers.
        </Text>
      </View>
      {loading && posts.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: FAB_CLEARANCE }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={40} color={t.textMuted} />
              <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>
                Feed is empty
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
                Follow some designers to see their work here.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              tintColor={t.cta}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function PostCard({ post }: { post: Post }) {
  const t = useTheme();
  const initial = (post.author.name?.[0] ?? "?").toUpperCase();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
          <Text style={{ color: t.accent, fontWeight: "800" }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]}>{post.author.name}</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 1 }]}>Designer</Text>
        </View>
        <Pressable hitSlop={8} style={[styles.followPill, { borderColor: t.cta }]}>
          <Text style={{ color: t.cta, fontWeight: "700" }}>Follow</Text>
        </Pressable>
      </View>
      {post.image ? (
        <Image
          source={{ uri: post.image }}
          style={styles.cardImage}
          contentFit="cover"
          transition={120}
        />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.actionsRow}>
          <Pressable hitSlop={8} style={styles.action}>
            <Ionicons name="heart-outline" size={22} color={t.text} />
            <Text style={[type.small, { color: t.text, fontWeight: "700" }]}>{post.likeCount}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={styles.action}>
            <Ionicons name="chatbubble-outline" size={20} color={t.text} />
            <Text style={[type.small, { color: t.text, fontWeight: "700" }]}>{post.commentCount}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={styles.action}>
            <Ionicons name="share-outline" size={20} color={t.text} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.action}>
            <Ionicons
              name={post.saved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={post.saved ? t.cta : t.text}
            />
          </Pressable>
        </View>
        <Text style={[type.h2, { color: t.text, marginTop: 6 }]} numberOfLines={2}>
          {post.title}
        </Text>
        {post.body ? (
          <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]} numberOfLines={3}>
            {post.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headline: { fontSize: 24, fontWeight: "800" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  followPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  cardImage: { width: "100%", aspectRatio: 4 / 3 },
  cardBody: { padding: 14, gap: 4 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
});
