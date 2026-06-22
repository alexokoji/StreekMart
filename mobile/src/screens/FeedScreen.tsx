import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { API_URL } from "../api/client";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { firstImage } from "../lib/productImage";
import { sellerDisplayName } from "../lib/sellerName";
import { type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FAB_CLEARANCE = 110;
const { width: SCREEN_W } = Dimensions.get("window");

// Server shape per /api/posts. We only pull the fields the feed needs;
// imagesJson is decoded inline so cards always show the photo (the
// previous `image` field was server-side never populated, leaving every
// card photoless).
type RawPost = {
  id: string;
  title: string;
  body: string;
  imagesJson?: string | null;
  likeCount: number;
  commentCount?: number;
  author?: {
    id: string;
    name: string;
    businessName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

type Post = {
  id: string;
  title: string;
  body: string;
  images: string[];
  author: {
    id: string;
    name: string;
    businessName: string | null;
    avatarUrl: string | null;
  } | null;
  likeCount: number;
  commentCount: number;
  saved?: boolean;
};

function decodePost(p: RawPost): Post {
  let images: string[] = [];
  if (p.imagesJson) {
    try {
      const arr = JSON.parse(p.imagesJson);
      if (Array.isArray(arr)) images = arr.filter((s): s is string => typeof s === "string");
    } catch {
      /* ignore */
    }
  }
  // Fallback: try the firstImage helper which also handles a top-level
  // `image` field on some endpoints.
  if (images.length === 0) {
    const single = firstImage(p as unknown as { image?: string; imagesJson?: string });
    if (single) images = [single];
  }
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    images,
    author: p.author
      ? {
          id: p.author.id,
          name: p.author.name,
          businessName: p.author.businessName ?? null,
          avatarUrl: p.author.avatarUrl ?? null,
        }
      : null,
    likeCount: p.likeCount,
    commentCount: p.commentCount ?? 0,
  };
}

export function FeedScreen() {
  const t = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoom, setZoom] = useState<{ url: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api
        .get<{ posts: RawPost[] }>("/api/posts", { limit: 20 })
        .catch(() => ({ posts: [] }));
      setPosts((data.posts ?? []).map(decodePost));
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
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.headline, { color: t.text }]}>Feed</Text>
      </View>
      {loading && posts.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: FAB_CLEARANCE }}
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
          renderItem={({ item }) => (
            <PostCard post={item} onZoomImage={(url) => setZoom({ url })} />
          )}
        />
      )}
      <ZoomModal url={zoom?.url ?? null} onClose={() => setZoom(null)} />
    </SafeAreaView>
  );
}

function PostCard({
  post,
  onZoomImage,
}: {
  post: Post;
  onZoomImage: (url: string) => void;
}) {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  // Caption expand/collapse — Instagram clips to 2 lines by default
  // with a "more" affordance. Body text gets its own toggle.
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const author = post.author;
  const authorName = author ? sellerDisplayName(author) : "Designer";
  const initial = (authorName?.[0] ?? "?").toUpperCase();

  async function sharePost() {
    const url = `${API_URL.replace(/\/$/, "")}/posts/${post.id}`;
    const title = post.title || (author ? `${authorName}'s post` : "StreekMart post");
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

  function openComments() {
    nav.navigate("PostDetail", { id: post.id });
  }

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {/* Header — avatar + handle, Instagram style. Tappable to the
          designer's public profile. */}
      <Pressable
        style={styles.authorRow}
        onPress={() => {
          if (!author) return;
          nav.navigate("SellerProfile", {
            id: author.id,
            name: author.name,
            businessName: author.businessName,
            avatarUrl: author.avatarUrl,
          });
        }}
      >
        {author?.avatarUrl ? (
          <Image
            source={{ uri: author.avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: t.accent, fontWeight: "800" }}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
            {authorName}
          </Text>
        </View>
        <Pressable hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={t.text} />
        </Pressable>
      </Pressable>

      {/* Image — square edge-to-edge. Multi-image posts get a pager
          with dots beneath. Tap to open fullscreen with pinch-to-zoom. */}
      {post.images.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
          >
            {post.images.map((uri, i) => (
              <Pressable
                key={uri + i}
                onPress={() => onZoomImage(uri)}
                style={{ width: SCREEN_W, height: SCREEN_W, backgroundColor: t.bgElevated }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={120}
                />
              </Pressable>
            ))}
          </ScrollView>
          {post.images.length > 1 ? (
            <View style={styles.dotsRow}>
              {post.images.map((_, i) => (
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
          {post.images.length > 1 ? (
            <View style={[styles.countPill, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
                {active + 1}/{post.images.length}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Action row */}
      <View style={styles.actionsRow}>
        <Pressable hitSlop={8} style={styles.action} onPress={() => setLiked((v) => !v)}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={26}
            color={liked ? "#ed4956" : t.text}
          />
        </Pressable>
        <Pressable hitSlop={8} style={styles.action} onPress={openComments}>
          <Ionicons name="chatbubble-outline" size={24} color={t.text} />
        </Pressable>
        <Pressable hitSlop={8} style={styles.action} onPress={sharePost}>
          <Ionicons name="paper-plane-outline" size={24} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} style={styles.action} onPress={() => setSaved((v) => !v)}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={t.text}
          />
        </Pressable>
      </View>

      {/* Likes + caption (expandable). Tap "more" to read the full
          body; the post page is reachable from the comment icon. */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>
          {(post.likeCount + (liked ? 1 : 0)).toLocaleString("en-NG")} likes
        </Text>
        {post.title ? (
          <Pressable onPress={() => setTitleExpanded((v) => !v)}>
            <Text
              style={[type.body, { color: t.text, marginTop: 4 }]}
              numberOfLines={titleExpanded ? undefined : 2}
            >
              <Text style={{ fontWeight: "800" }}>{authorName}</Text>{" "}
              {post.title}
            </Text>
            {!titleExpanded && post.title.length > 80 ? (
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                more
              </Text>
            ) : null}
          </Pressable>
        ) : null}
        {post.body ? (
          <Pressable onPress={() => setBodyExpanded((v) => !v)}>
            <Text
              style={[type.body, { color: t.textMuted, marginTop: 4 }]}
              numberOfLines={bodyExpanded ? undefined : 3}
            >
              {post.body}
            </Text>
            {!bodyExpanded && post.body.length > 140 ? (
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                more
              </Text>
            ) : (
              bodyExpanded ? (
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  less
                </Text>
              ) : null
            )}
          </Pressable>
        ) : null}
        <Pressable onPress={openComments} hitSlop={6}>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
            {post.commentCount > 0
              ? `View ${post.commentCount === 1 ? "1 comment" : `all ${post.commentCount.toLocaleString("en-NG")} comments`}`
              : "Add a comment"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Fullscreen pinch-to-zoom image modal. Tap once to dismiss, pinch
// outward to zoom; the gesture rests back to 1:1 on release so the
// reader doesn't get stuck on an upscale they can't dismiss.
function ZoomModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  // Plain RN Animated value driven by PinchGestureHandler's
  // onGestureEvent. Avoids reanimated's heavy generic types (they
  // crash tsc with OOM on this codebase) while still scaling the
  // image on the native thread via useNativeDriver.
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);

  function onPinch(e: { nativeEvent: { scale: number } }) {
    const next = Math.max(1, Math.min(baseScale.current * e.nativeEvent.scale, 5));
    scale.setValue(next);
  }

  function onStateChange(e: { nativeEvent: { oldState: number; state: number; scale: number } }) {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      // Snap back to 1x when the user lets go below a small threshold.
      const final = Math.max(1, Math.min(baseScale.current * e.nativeEvent.scale, 5));
      if (final < 1.05) {
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        baseScale.current = 1;
      } else {
        baseScale.current = final;
      }
    }
  }

  function resetThenClose() {
    scale.setValue(1);
    baseScale.current = 1;
    onClose();
  }

  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={resetThenClose}>
      <View style={styles.zoomBackdrop}>
        <Pressable style={styles.zoomCloseTap} onPress={resetThenClose} />
        <PinchGestureHandler
          onGestureEvent={onPinch}
          onHandlerStateChange={onStateChange}
        >
          <Animated.View style={[styles.zoomImageWrap, { transform: [{ scale }] }]}>
            {url ? (
              <Image
                source={{ uri: url }}
                style={styles.zoomImage}
                contentFit="contain"
              />
            ) : null}
          </Animated.View>
        </PinchGestureHandler>
        <Pressable onPress={resetThenClose} hitSlop={12} style={styles.zoomCloseBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.zoomHint}>Pinch to zoom · tap to close</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headline: { fontSize: 22, fontWeight: "800" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  // Instagram-style cards are edge-to-edge with no rounded corners.
  card: { marginBottom: 6 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  countPill: {
    position: "absolute",
    top: 10,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  action: { paddingHorizontal: 4, paddingVertical: 4 },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCloseTap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  zoomImageWrap: { width: SCREEN_W, height: SCREEN_W },
  zoomImage: { width: "100%", height: "100%" },
  zoomCloseBtn: { position: "absolute", top: 50, right: 18 },
  zoomHint: { position: "absolute", bottom: 50, color: "rgba(255,255,255,0.75)", fontSize: 12 },
});
