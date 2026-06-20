import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { API_URL, api } from "../api/client";
import { sellerDisplayName } from "../lib/sellerName";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PostAuthor = {
  id: string;
  name: string;
  businessName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

type RawPost = {
  id: string;
  title: string;
  body: string;
  imagesJson?: string | null;
  likeCount: number;
  createdAt?: string;
  author?: PostAuthor | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; isDesigner?: boolean; designerVerified?: boolean };
};

const { width: SCREEN_W } = Dimensions.get("window");

function decodeImages(imagesJson: string | null | undefined): string[] {
  if (!imagesJson) return [];
  try {
    const arr = JSON.parse(imagesJson);
    if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export function PostDetailScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "PostDetail">>();
  const { id } = route.params;
  const { user } = useAuth();

  const [post, setPost] = useState<RawPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    try {
      const [postResp, commentsResp] = await Promise.all([
        api.get<{ post: RawPost }>(`/api/posts/${id}`),
        api.get<{ comments: Comment[] }>(`/api/posts/${id}/comments`).catch(() => ({ comments: [] })),
      ]);
      setPost(postResp.post);
      setComments(commentsResp.comments ?? []);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submitComment() {
    if (!user) {
      Alert.alert("Sign in", "Sign in to comment on this post.");
      return;
    }
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const r = await api.post<{ comment: Comment }>(`/api/posts/${id}/comments`, { body });
      setComments((cur) => [...cur, r.comment]);
      setDraft("");
    } catch (err) {
      Alert.alert("Couldn't comment", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function sharePost() {
    if (!post) return;
    const url = `${API_URL.replace(/\/$/, "")}/posts/${post.id}`;
    const title = post.title || "StreekMart post";
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(url, { dialogTitle: title });
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert("Couldn't share", url);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Post" />
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Post" />
        <View style={styles.centered}>
          <Text style={[type.body, { color: t.text }]}>Couldn't load this post.</Text>
        </View>
      </View>
    );
  }

  const author = post.author;
  const authorName = author ? sellerDisplayName(author) : "Designer";
  const authorInitial = (authorName?.[0] ?? "?").toUpperCase();
  const images = decodeImages(post.imagesJson);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <BackHeader
        title="Post"
        rightAction={
          <Pressable hitSlop={8} onPress={sharePost}>
            <Ionicons name="paper-plane-outline" size={22} color={t.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* Author row */}
        <Pressable
          style={styles.authorRow}
          onPress={() => {
            if (!author) return;
            nav.navigate("SellerProfile", {
              id: author.id,
              name: author.name,
              businessName: author.businessName ?? null,
              avatarUrl: author.avatarUrl ?? null,
            });
          }}
        >
          {author?.avatarUrl ? (
            <Image source={{ uri: author.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: t.accent, fontWeight: "800" }}>{authorInitial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{authorName}</Text>
          </View>
        </Pressable>

        {/* Images */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
              }
            >
              {images.map((uri, i) => (
                <View key={uri + i} style={{ width: SCREEN_W, height: SCREEN_W, backgroundColor: t.bgElevated }}>
                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                </View>
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === active ? t.cta : "rgba(255,255,255,0.55)",
                        width: i === active ? 16 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Caption */}
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <Text style={[type.bodyStrong, { color: t.text }]}>
            {post.likeCount.toLocaleString("en-NG")} likes
          </Text>
          {post.title ? (
            <Text style={[type.body, { color: t.text, marginTop: 6 }]}>
              <Text style={{ fontWeight: "800" }}>{authorName}</Text>{" "}
              {post.title}
            </Text>
          ) : null}
          {post.body ? (
            <Text style={[type.body, { color: t.textMuted, marginTop: 6, lineHeight: 22 }]}>
              {post.body}
            </Text>
          ) : null}
        </View>

        {/* Comments */}
        <View style={{ paddingHorizontal: 14, paddingTop: 22 }}>
          <Text style={[type.h2, { color: t.text }]}>
            Comments {comments.length > 0 ? `· ${comments.length}` : ""}
          </Text>
          {comments.length === 0 ? (
            <Text style={[type.small, { color: t.textMuted, marginTop: 8 }]}>
              No comments yet. Be the first to say something.
            </Text>
          ) : (
            <View style={{ marginTop: 10, gap: 10 }}>
              {comments.map((c) => (
                <View key={c.id} style={[styles.commentRow, { borderBottomColor: t.border }]}>
                  <View style={[styles.commentAvatar, { backgroundColor: t.accentSoft }]}>
                    <Text style={{ color: t.accent, fontWeight: "800" }}>
                      {(c.author.name?.[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: t.text }]}>{c.author.name}</Text>
                    <Text style={[type.body, { color: t.text, marginTop: 2 }]}>{c.body}</Text>
                    <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                      {new Date(c.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: t.bgElevated, borderTopColor: t.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={user ? "Add a comment…" : "Sign in to comment"}
          placeholderTextColor={t.textMuted}
          editable={!!user && !posting}
          style={[styles.composerInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
          multiline
        />
        <Pressable
          onPress={submitComment}
          disabled={!user || posting || !draft.trim()}
          style={[
            styles.composerBtn,
            { backgroundColor: t.cta, opacity: !user || posting || !draft.trim() ? 0.5 : 1 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "800" }}>
            {posting ? "…" : "Post"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, overflow: "hidden" },
  dotsRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  composerBtn: {
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
