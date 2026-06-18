import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
import { api, isNotFound, API_URL } from "../api/client";
import { firstImage } from "../lib/productImage";
import { sellerDisplayName } from "../lib/sellerName";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SellerInfo = {
  id: string;
  slug?: string | null;
  name: string;
  businessName: string | null;
  tagline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  productCount: number;
  followerCount: number;
  ratingAvg: number;
  ratingCount: number;
  isDesigner: boolean;
  isSeller?: boolean;
  verified?: boolean | null;
  joinedAt?: string | null;
  location?: string | null;
  responseTimeHours?: number | null;
  completedOrders?: number | null;
  categories?: string[] | null;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  image?: string | null;
  imagesJson?: string | null;
};

type PostRow = {
  id: string;
  title: string;
  body?: string | null;
  image?: string | null;
  imagesJson?: string | null;
  likeCount: number;
};

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: { id: string; name: string };
  productName?: string | null;
};

type Resp = {
  seller: SellerInfo;
  products: ProductRow[];
  posts?: PostRow[];
  reviews?: ReviewRow[];
};

type Tab = "products" | "posts" | "about" | "reviews";

export function SellerProfileScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "SellerProfile">>();
  const { user: viewer } = useAuth();
  const { id, name: paramName, businessName: paramBusinessName, avatarUrl: paramAvatarUrl } = route.params;

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [openingChat, setOpeningChat] = useState(false);

  const load = useCallback(async () => {
    // Mirror the website's /u/[id] page: fetch products by sellerId
    // and posts by authorId via the existing endpoints. The web does
    // these as Prisma queries server-side; we hit the same data via
    // /api/products?sellerId=... and /api/posts?authorId=... — both
    // existed and already had query-param plumbing, we just added the
    // filter keys on the server.
    type RawProduct = {
      id: string;
      name: string;
      price: number;
      salePrice: number | null;
      imagesJson?: string | null;
      seller?: {
        id: string;
        slug?: string | null;
        name: string;
        businessName?: string | null;
        bio?: string | null;
        avatarUrl?: string | null;
        coverImageUrl?: string | null;
        isSeller?: boolean;
        isDesigner?: boolean;
        sellerVerified?: boolean;
        designerVerified?: boolean;
        sellerRatingAvg?: number;
        sellerRatingCount?: number;
        createdAt?: string;
      };
    };
    type RawPost = {
      id: string;
      title: string;
      body?: string | null;
      imagesJson?: string | null;
      likeCount: number;
      author?: {
        id: string;
        slug?: string | null;
        name: string;
        businessName?: string | null;
        bio?: string | null;
        avatarUrl?: string | null;
        coverImageUrl?: string | null;
        isSeller?: boolean;
        isDesigner?: boolean;
        sellerVerified?: boolean;
        designerVerified?: boolean;
        createdAt?: string;
      };
    };
    type SearchHit = {
      id: string;
      name: string;
      seller: { id: string; name: string; verified?: boolean };
    };

    let rawProducts: RawProduct[] = [];
    let rawPosts: RawPost[] = [];
    try {
      const r = await api.get<{ products: RawProduct[] }>("/api/products", { sellerId: id });
      rawProducts = r.products ?? [];
    } catch (err) {
      if (!isNotFound(err)) {
        // Auth/network — keep going; the shell still renders below.
      }
    }
    try {
      const r = await api.get<{ posts: RawPost[] }>("/api/posts", { authorId: id });
      rawPosts = r.posts ?? [];
    } catch (err) {
      if (!isNotFound(err)) {
        /* ignore */
      }
    }

    // Hard guarantee: filter client-side to ONLY items belonging to
    // this profile's id. Protects against a server that hasn't been
    // restarted to honour the sellerId/authorId query params and would
    // otherwise return the entire catalog/feed.
    rawProducts = rawProducts.filter((p) => !p.seller || p.seller.id === id);
    rawPosts = rawPosts.filter((p) => !p.author || p.author.id === id);

    // Build seller info from richest available embedded record.
    // Priority: post.author (always carries businessName) > product.seller
    // > route params. /api/posts ships businessName on production already;
    // /api/products may not yet on stale deploys.
    const firstSeller = rawProducts.find((p) => p.seller)?.seller;
    const firstAuthor = rawPosts.find((p) => p.author)?.author;

    // Final businessName fallback: /api/search resolves seller.name to
    // `businessName?.trim() || name` server-side. Hit it with the best
    // free-text we have and find a product matching this sellerId.
    let searchResolvedName: string | null = null;
    const haveBusinessName = Boolean(
      (firstAuthor?.businessName ?? "").trim() ||
        (firstSeller?.businessName ?? "").trim() ||
        (paramBusinessName ?? "").trim(),
    );
    if (!haveBusinessName) {
      const probe =
        paramName?.trim() ||
        firstSeller?.name?.trim() ||
        firstAuthor?.name?.trim() ||
        rawProducts[0]?.name?.trim() ||
        "shop";
      try {
        const r = await api.post<{ results: SearchHit[] }>("/api/search", {
          query: probe,
        });
        const hit = (r.results ?? []).find((h) => h.seller?.id === id);
        if (hit?.seller?.name?.trim()) searchResolvedName = hit.seller.name.trim();
      } catch {
        /* ignore — fallback to whatever embedded source we had */
      }
    }

    const resolvedBusinessName =
      (firstAuthor?.businessName ?? "").trim() ||
      (firstSeller?.businessName ?? "").trim() ||
      (paramBusinessName ?? "").trim() ||
      searchResolvedName ||
      null;

    const seller: SellerInfo = {
      id: firstSeller?.id ?? firstAuthor?.id ?? id,
      slug: firstSeller?.slug ?? firstAuthor?.slug ?? null,
      name: firstAuthor?.name ?? firstSeller?.name ?? paramName ?? "Shop",
      businessName: resolvedBusinessName,
      tagline: null,
      bio: firstAuthor?.bio ?? firstSeller?.bio ?? null,
      avatarUrl: firstAuthor?.avatarUrl ?? firstSeller?.avatarUrl ?? paramAvatarUrl ?? null,
      bannerUrl: firstAuthor?.coverImageUrl ?? firstSeller?.coverImageUrl ?? null,
      productCount: rawProducts.length,
      followerCount: 0,
      ratingAvg: firstSeller?.sellerRatingAvg ?? 0,
      ratingCount: firstSeller?.sellerRatingCount ?? 0,
      isSeller: firstSeller?.isSeller ?? firstAuthor?.isSeller ?? rawProducts.length > 0,
      isDesigner: firstAuthor?.isDesigner ?? firstSeller?.isDesigner ?? rawPosts.length > 0,
      verified:
        firstAuthor?.sellerVerified ||
        firstAuthor?.designerVerified ||
        firstSeller?.sellerVerified ||
        firstSeller?.designerVerified ||
        null,
      joinedAt: firstAuthor?.createdAt ?? firstSeller?.createdAt ?? null,
      location: null,
      responseTimeHours: null,
      completedOrders: null,
      categories: null,
    };

    const products: ProductRow[] = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.salePrice ?? null,
      imagesJson: p.imagesJson ?? null,
    }));
    const posts: PostRow[] = rawPosts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body ?? null,
      imagesJson: p.imagesJson ?? null,
      likeCount: p.likeCount,
    }));

    setData({ seller, products, posts, reviews: [] });
    setLoading(false);
    setRefreshing(false);
  }, [id, paramName, paramBusinessName, paramAvatarUrl]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFollow() {
    if (!data) return;
    if (!viewer) {
      Alert.alert("Sign in", "Sign in to follow this shop.");
      return;
    }
    const prev = following;
    setFollowing(!prev);
    try {
      // The server's /api/follows is a toggle — it returns the new state.
      const r = await api.post<{ following: boolean }>(`/api/follows`, {
        designerId: data.seller.id,
      });
      setFollowing(r.following);
    } catch {
      setFollowing(prev);
    }
  }

  async function sharePublicProfile() {
    if (!data) return;
    const handle = data.seller.slug ?? data.seller.id;
    const url = `${API_URL.replace(/\/$/, "")}/u/${handle}`;
    const display = sellerDisplayName(data.seller);
    const title = `${display} on StreekMart`;
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

  async function messageSeller() {
    if (!data) return;
    if (!viewer) {
      Alert.alert("Sign in", "Sign in to message this shop.");
      return;
    }
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const r = await api.post<{ chat: { id: string } }>("/api/chats", { withUserId: data.seller.id });
      const display = sellerDisplayName(data.seller);
      nav.navigate("Chat", { id: r.chat.id, counterpartName: display });
    } catch (err) {
      Alert.alert("Couldn't open chat", err instanceof Error ? err.message : "Try again.");
    } finally {
      setOpeningChat(false);
    }
  }

  async function requestCommission() {
    if (!data) return;
    if (!viewer) {
      Alert.alert("Sign in", "Sign in to request a custom commission.");
      return;
    }
    // Web has a richer in-page form; mobile launches a chat seeded with
    // a commission template so the conversation starts with intent.
    setOpeningChat(true);
    try {
      const r = await api.post<{ chat: { id: string } }>("/api/chats", {
        withUserId: data.seller.id,
        seed:
          "Hi! I'd like to commission a custom piece. I can share a brief, budget, and timeline — when's a good time to chat?",
      });
      const display = sellerDisplayName(data.seller);
      nav.navigate("Chat", { id: r.chat.id, counterpartName: display });
    } catch (err) {
      Alert.alert("Couldn't start commission", err instanceof Error ? err.message : "Try again.");
    } finally {
      setOpeningChat(false);
    }
  }

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader />
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }
  if (!data) return null;

  const s = data.seller;
  const display = sellerDisplayName(s);
  const initial = display.slice(0, 1).toUpperCase();
  const isOwner = !!viewer && viewer.id === s.id;
  const tabs: Tab[] = [
    "products",
    ...(s.isDesigner ? (["posts"] as Tab[]) : []),
    "reviews",
    "about",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={display} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
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
      >
        <View style={[styles.banner, { backgroundColor: s.bannerUrl ? t.bg : t.accentSoft }]}>
          {s.bannerUrl ? (
            <Image source={{ uri: s.bannerUrl }} style={styles.bannerImg} contentFit="cover" />
          ) : null}
        </View>

        <View style={styles.headRow}>
          <View style={styles.avatarWrap}>
            {s.avatarUrl ? (
              <Image source={{ uri: s.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: t.cta, alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 26 }}>{initial}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <View style={styles.titleRow}>
            <Text style={[type.h1, { color: t.text, flex: 1 }]} numberOfLines={1}>{display}</Text>
            {s.verified ? (
              <View style={[styles.verifiedChip, { backgroundColor: t.accentSoft }]}>
                <Ionicons name="shield-checkmark" size={14} color={t.accent} />
                <Text style={{ color: t.accent, fontWeight: "800", fontSize: 11, marginLeft: 4 }}>VERIFIED</Text>
              </View>
            ) : null}
          </View>
          {s.tagline ? (
            <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]}>{s.tagline}</Text>
          ) : null}

          {/* Role chips — match the web's badge row. */}
          <View style={[styles.metaRow, { marginTop: 8 }]}>
            {s.isSeller ? (
              <View style={[styles.roleChip, { backgroundColor: t.accentSoft }]}>
                <Text style={{ color: t.accent, fontSize: 11, fontWeight: "800" }}>SELLER</Text>
              </View>
            ) : null}
            {s.isDesigner ? (
              <View style={[styles.roleChip, { backgroundColor: "rgba(217,70,239,0.15)" }]}>
                <Text style={{ color: t.promo, fontSize: 11, fontWeight: "800" }}>DESIGNER</Text>
              </View>
            ) : null}
          </View>

          {/* Bio sits prominently below the headline, like the web. */}
          {s.bio ? (
            <Text style={[type.body, { color: t.textMuted, marginTop: 12, lineHeight: 22 }]}>
              {s.bio}
            </Text>
          ) : null}

          {/* Action row — Share is always available; Message/Follow/
              Commission appear only to non-owners. Owners see an
              "Edit profile" shortcut to their own settings instead. */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={sharePublicProfile}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="share-outline" size={16} color={t.text} />
              <Text style={{ color: t.text, fontWeight: "700", marginLeft: 6 }}>Share</Text>
            </Pressable>

            {!isOwner ? (
              <Pressable
                onPress={messageSeller}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: t.card, borderColor: t.border, opacity: openingChat || pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={t.text} />
                <Text style={{ color: t.text, fontWeight: "700", marginLeft: 6 }}>Message</Text>
              </Pressable>
            ) : null}

            {!isOwner ? (
              <Pressable
                onPress={toggleFollow}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: following ? t.card : t.cta,
                    borderColor: following ? t.border : t.cta,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={following ? "checkmark" : "add"}
                  size={16}
                  color={following ? t.text : t.ctaText}
                />
                <Text style={{ color: following ? t.text : t.ctaText, fontWeight: "800", marginLeft: 4 }}>
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
            ) : null}

            {!isOwner && s.isDesigner ? (
              <Pressable
                onPress={requestCommission}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: t.promo, borderColor: t.promo, opacity: openingChat || pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="color-palette-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", marginLeft: 6 }}>Commission</Text>
              </Pressable>
            ) : null}

            {isOwner ? (
              <Pressable
                onPress={() =>
                  nav.navigate(s.isSeller ? "SellerSettings" : "EditProfile")
                }
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: t.cta, borderColor: t.cta, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="create-outline" size={16} color={t.ctaText} />
                <Text style={{ color: t.ctaText, fontWeight: "800", marginLeft: 6 }}>
                  Edit profile
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {s.location ? <MetaPill icon="location-outline" text={s.location} /> : null}
            {s.joinedAt ? (
              <MetaPill
                icon="calendar-outline"
                text={`Since ${new Date(s.joinedAt).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}`}
              />
            ) : null}
            {typeof s.responseTimeHours === "number" && s.responseTimeHours > 0 ? (
              <MetaPill icon="chatbubble-ellipses-outline" text={`~${s.responseTimeHours}h reply`} />
            ) : null}
          </View>

          <View style={[styles.statStrip, { backgroundColor: t.card, borderColor: t.border }]}>
            <Stat label="Products" value={s.productCount.toLocaleString("en-NG")} />
            <Divider />
            <Stat label="Followers" value={s.followerCount.toLocaleString("en-NG")} />
            <Divider />
            <Stat
              label="Rating"
              value={s.ratingCount > 0 ? `${s.ratingAvg.toFixed(1)} ★` : "—"}
              sub={s.ratingCount > 0 ? `${s.ratingCount}` : undefined}
            />
            {typeof s.completedOrders === "number" ? (
              <>
                <Divider />
                <Stat label="Sales" value={s.completedOrders.toLocaleString("en-NG")} />
              </>
            ) : null}
          </View>

          {s.categories && s.categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 14 }}>
              {s.categories.map((c) => (
                <View key={c} style={[styles.catChip, { backgroundColor: t.accentSoft }]}>
                  <Text style={{ color: t.accent, fontWeight: "700", fontSize: 12 }}>{c}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
            {tabs.map((tk) => {
              const active = tk === tab;
              return (
                <Pressable key={tk} onPress={() => setTab(tk)} style={styles.tabBtn}>
                  <Text style={[type.bodyStrong, { color: active ? t.cta : t.textMuted, textTransform: "capitalize" }]}>{tk}</Text>
                  {active ? <View style={[styles.tabUnderline, { backgroundColor: t.cta }]} /> : null}
                </Pressable>
              );
            })}
          </View>

          {tab === "products" ? <ProductsTab products={data.products} nav={nav} /> : null}
          {tab === "posts" ? <PostsTab posts={data.posts ?? []} /> : null}
          {tab === "reviews" ? <ReviewsTab reviews={data.reviews ?? []} avg={s.ratingAvg} total={s.ratingCount} /> : null}
          {tab === "about" ? <AboutTab seller={s} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ProductsTab({ products, nav }: { products: ProductRow[]; nav: Nav }) {
  const t = useTheme();
  if (products.length === 0) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="bag-handle-outline" size={36} color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>No listings yet.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      numColumns={2}
      scrollEnabled={false}
      contentContainerStyle={{ gap: 12, paddingTop: 14 }}
      columnWrapperStyle={{ gap: 12 }}
      renderItem={({ item }) => {
        const img = firstImage(item);
        const eff = item.salePrice ?? item.price;
        return (
          <Pressable
            onPress={() => nav.navigate("ProductDetail", { id: item.id })}
            style={[styles.prodCard, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <View style={[styles.prodImage, { backgroundColor: t.bg }]}>
              {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </View>
            <View style={{ padding: 10, gap: 4 }}>
              <Text style={[type.body, { color: t.text }]} numberOfLines={2}>{item.name}</Text>
              <Text style={[type.bodyStrong, { color: t.cta }]}>
                ₦{Math.round(eff).toLocaleString("en-NG")}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function PostsTab({ posts }: { posts: PostRow[] }) {
  const t = useTheme();
  if (posts.length === 0) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="albums-outline" size={36} color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>No posts yet.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={3}
      scrollEnabled={false}
      contentContainerStyle={{ gap: 4, paddingTop: 14 }}
      columnWrapperStyle={{ gap: 4 }}
      renderItem={({ item }) => {
        const img = item.image ?? firstImage(item);
        return (
          <View style={[styles.postTile, { backgroundColor: t.card }]}>
            {img ? (
              <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={24} color={t.textFaint} />
              </View>
            )}
            {item.likeCount > 0 ? (
              <View style={[styles.postOverlay, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                <Ionicons name="heart" size={12} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11, marginLeft: 3 }}>
                  {item.likeCount.toLocaleString("en-NG")}
                </Text>
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

function ReviewsTab({ reviews, avg, total }: { reviews: ReviewRow[]; avg: number; total: number }) {
  const t = useTheme();
  if (reviews.length === 0) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="star-outline" size={36} color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>No reviews yet.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10, paddingTop: 14 }}>
      <View style={[styles.reviewHero, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[type.display, { color: t.text }]}>{avg.toFixed(1)}</Text>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= Math.round(avg) ? "star" : "star-outline"}
              size={18}
              color={n <= Math.round(avg) ? t.premium : t.textFaint}
            />
          ))}
        </View>
        <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
          {total.toLocaleString("en-NG")} reviews
        </Text>
      </View>
      {reviews.map((r) => (
        <View key={r.id} style={[styles.reviewRow, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.reviewHead}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{r.author.name}</Text>
            <View style={{ flexDirection: "row" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= r.rating ? "star" : "star-outline"}
                  size={12}
                  color={n <= r.rating ? t.premium : t.textFaint}
                />
              ))}
            </View>
          </View>
          {r.productName ? (
            <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{r.productName}</Text>
          ) : null}
          {r.body ? (
            <Text style={[type.body, { color: t.text, marginTop: 6 }]}>{r.body}</Text>
          ) : null}
          <Text style={[type.small, { color: t.textFaint, marginTop: 6 }]}>
            {new Date(r.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AboutTab({ seller }: { seller: SellerInfo }) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: 14, gap: 14 }}>
      <View style={[styles.aboutCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[type.bodyStrong, { color: t.text, marginBottom: 6 }]}>About</Text>
        {seller.bio ? (
          <Text style={[type.body, { color: t.text, lineHeight: 22 }]}>{seller.bio}</Text>
        ) : (
          <Text style={[type.small, { color: t.textMuted }]}>This shop hasn't added a bio yet.</Text>
        )}
      </View>
      <View style={[styles.aboutCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[type.bodyStrong, { color: t.text, marginBottom: 10 }]}>Details</Text>
        <Detail icon="location-outline" label="Location" value={seller.location ?? "Not provided"} />
        <Detail
          icon="calendar-outline"
          label="Joined"
          value={
            seller.joinedAt
              ? new Date(seller.joinedAt).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
              : "Unknown"
          }
        />
        <Detail
          icon="chatbubble-ellipses-outline"
          label="Reply time"
          value={
            typeof seller.responseTimeHours === "number" && seller.responseTimeHours > 0
              ? `~${seller.responseTimeHours} hours`
              : "Not measured yet"
          }
        />
        <Detail
          icon="checkmark-done-outline"
          label="Completed sales"
          value={typeof seller.completedOrders === "number" ? seller.completedOrders.toLocaleString("en-NG") : "—"}
          last
        />
      </View>
    </View>
  );
}

function MetaPill({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.metaPill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={icon} size={12} color={t.textMuted} />
      <Text style={[type.small, { color: t.textMuted, marginLeft: 4 }]}>{text}</Text>
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[type.h2, { color: t.text }]}>{value}</Text>
      <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
        {label}
        {sub ? ` · ${sub}` : ""}
      </Text>
    </View>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={[styles.statDivider, { backgroundColor: t.border }]} />;
}

function Detail({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.detail, !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.detailIcon, { backgroundColor: t.accentSoft }]}>
        <Ionicons name={icon} size={16} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.small, { color: t.textMuted }]}>{label}</Text>
        <Text style={[type.body, { color: t.text, marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  banner: { height: 140 },
  bannerImg: { width: "100%", height: "100%" },
  headRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: -40,
  },
  avatarWrap: {},
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  tabBar: { flexDirection: "row", marginTop: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 12, position: "relative" },
  tabUnderline: { position: "absolute", left: 16, right: 16, bottom: 0, height: 3, borderRadius: 2 },
  tabEmpty: { padding: 40, alignItems: "center" },
  prodCard: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  prodImage: { aspectRatio: 1 },
  postTile: { flex: 1, aspectRatio: 1, overflow: "hidden", position: "relative" },
  postOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  reviewHero: { padding: 18, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  reviewRow: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  aboutCard: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  detail: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  detailIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
