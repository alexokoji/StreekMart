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
import { Screen } from "../components/Screen";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

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

  if (loading && posts.length === 0) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padding={false}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={[type.h1, { color: t.text }]}>Designer feed</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Inspiration straight from independent designers.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>
              No posts yet — check back soon.
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
    </Screen>
  );
}

function PostCard({ post }: { post: Post }) {
  const t = useTheme();
  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: t.card, borderColor: t.border },
      ]}
    >
      {post.image && (
        <Image
          source={{ uri: post.image }}
          style={styles.cardImage}
          contentFit="cover"
          transition={120}
        />
      )}
      <View style={styles.cardBody}>
        <Text style={[type.h2, { color: t.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={[type.small, { color: t.textMuted }]} numberOfLines={3}>
          {post.body}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[type.small, { color: t.textMuted }]}>
            by {post.author.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Text style={[type.small, { color: t.textMuted }]}>
              ♥ {post.likeCount}
            </Text>
            <Text style={[type.small, { color: t.textMuted }]}>
              💬 {post.commentCount}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 32, alignItems: "center" },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardImage: { width: "100%", aspectRatio: 4 / 3 },
  cardBody: { padding: 14, gap: 6 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
});
