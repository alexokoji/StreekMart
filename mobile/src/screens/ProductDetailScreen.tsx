import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
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
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type AttrOption = { id: string; label: string };
type AttrGroup = { id: string; label: string; options: AttrOption[] };

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  category: string;
  status: string;
  images: string[];
  attributesJson?: string;
  seller: { id: string; name: string; businessName?: string | null };
  sizes?: string[];
  ratingAvg?: number;
  ratingCount?: number;
};

type Review = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string | null };
};

type ReviewsResp = {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
  myReview: { rating: number; body: string | null } | null;
};

const { width } = Dimensions.get("window");

export function ProductDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ProductDetail">>();
  const { id } = route.params;
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // Variant picker state
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  // Reviews
  const [reviews, setReviews] = useState<ReviewsResp | null>(null);
  const [writingReview, setWritingReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const attrGroups: AttrGroup[] = useMemo(() => {
    if (!product?.attributesJson) return [];
    try {
      const parsed = JSON.parse(product.attributesJson);
      if (Array.isArray(parsed)) {
        return parsed.map((g: { id?: string; label?: string; options?: Array<{ id?: string; label?: string }> }, i: number) => ({
          id: g.id ?? `g${i}`,
          label: g.label ?? "Option",
          options: (g.options ?? []).map((o, j) => ({ id: o.id ?? `o${j}`, label: o.label ?? "" })),
        }));
      }
    } catch {
      return [];
    }
    return [];
  }, [product]);

  const loadProduct = useCallback(async () => {
    try {
      const data = await api.get<{ product: Product }>(`/api/products/${id}`);
      setProduct(data.product);
      // Track recently-viewed for logged-in users.
      if (user) {
        api.post("/api/recently-viewed", { productId: id }).catch(() => {});
      }
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  const loadReviews = useCallback(async () => {
    try {
      const data = await api.get<ReviewsResp>(`/api/products/${id}/reviews`);
      setReviews(data);
      if (data.myReview) {
        setRating(data.myReview.rating);
        setReviewBody(data.myReview.body ?? "");
      }
    } catch {
      setReviews({ reviews: [], ratingAvg: 0, ratingCount: 0, myReview: null });
    }
  }, [id]);

  const loadSaved = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get<{ favorites: Array<{ productId: string | null }> }>("/api/favorites");
      setSaved((data.favorites ?? []).some((f) => f.productId === id));
    } catch {
      // ignore
    }
  }, [user, id]);

  useFocusEffect(useCallback(() => {
    loadProduct();
    loadReviews();
    loadSaved();
  }, [loadProduct, loadReviews, loadSaved]));

  async function toggleSave() {
    if (!user) {
      Alert.alert("Sign in", "Sign in to save items to your wishlist.");
      return;
    }
    const prev = saved;
    setSaved(!prev); // optimistic
    try {
      const res = await api.post<{ saved: boolean }>("/api/favorites", { kind: "product", id });
      setSaved(res.saved);
    } catch {
      setSaved(prev); // rollback
    }
  }

  async function addToCart() {
    if (!user) {
      Alert.alert("Sign in", "You need an account to add items to the cart.");
      return;
    }
    if (!product) return;
    // Check required variants picked
    for (const g of attrGroups) {
      if (g.options.length > 0 && !selectedAttrs[g.id]) {
        Alert.alert("Pick options", `Choose a ${g.label.toLowerCase()} before adding to cart.`);
        return;
      }
    }
    setAdding(true);
    try {
      const body: Record<string, unknown> = { productId: product.id, quantity: 1 };
      if (Object.keys(selectedAttrs).length > 0) body.attributesSelection = selectedAttrs;
      await api.post("/api/cart", body);
      Alert.alert("Added", `${product.name} is in your cart.`);
    } catch (err) {
      Alert.alert("Couldn't add", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function messageSeller() {
    if (!product) return;
    if (!user) {
      Alert.alert("Sign in", "Sign in to message sellers.");
      return;
    }
    try {
      const r = await api.post<{ chat: { id: string } }>("/api/chats", { withUserId: product.seller.id });
      nav.navigate("Chat", { id: r.chat.id, counterpartName: product.seller.businessName ?? product.seller.name });
    } catch (err) {
      Alert.alert("Could not open chat", err instanceof Error ? err.message : "Try again.");
    }
  }

  async function shareProduct() {
    if (!product) return;
    const url = `https://www.streekmart.online/products/${product.id}`;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Share", url);
      return;
    }
    try {
      await Sharing.shareAsync(url, { dialogTitle: product.name });
    } catch {
      // user cancelled -- silent
    }
  }

  async function submitReview() {
    setSubmittingReview(true);
    try {
      const r = await api.post(`/api/products/${id}/reviews`, {
        rating,
        body: reviewBody || undefined,
      });
      void r;
      setWritingReview(false);
      await loadReviews();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }
  if (!product) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Product not found.</Text>
      </Screen>
    );
  }

  const effective = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice != null && product.salePrice < product.price;
  const images = product.images?.length ? product.images : [null];

  return (
    <Screen padding={false} scroll edges={[]}>
      {/* Image carousel - tap to zoom */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {images.map((img, i) => (
          <Pressable
            key={i}
            onPress={() => img && setZoomIndex(i)}
            style={{ width, aspectRatio: 1, backgroundColor: t.bgElevated }}
          >
            {img && (
              <Image source={{ uri: img }} style={styles.heroImage} contentFit="cover" transition={150} />
            )}
          </Pressable>
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === activeImage ? t.cta : t.border }]}
            />
          ))}
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[type.h1, { color: t.text, flex: 1 }]}>{product.name}</Text>
          <Pressable onPress={shareProduct} hitSlop={10} style={styles.iconBtn}>
            <Text style={{ color: t.accent, fontSize: 18 }}>↗</Text>
          </Pressable>
          <Pressable onPress={toggleSave} hitSlop={10} style={styles.iconBtn}>
            <Text style={{ color: saved ? t.promo : t.textMuted, fontSize: 22 }}>
              {saved ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.priceRow}>
          <Text style={[type.display, { color: t.cta }]}>
            ₦{Math.round(effective).toLocaleString("en-NG")}
          </Text>
          {hasDiscount && (
            <Text style={[type.body, { color: t.textMuted, textDecorationLine: "line-through", marginLeft: 10 }]}>
              ₦{Math.round(product.price).toLocaleString("en-NG")}
            </Text>
          )}
        </View>

        {reviews && reviews.ratingCount > 0 && (
          <Text style={[type.small, { color: t.premium, marginTop: 4 }]}>
            ★ {reviews.ratingAvg.toFixed(1)} ({reviews.ratingCount} review{reviews.ratingCount === 1 ? "" : "s"})
          </Text>
        )}

        <View style={[styles.sellerCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={[type.small, { color: t.textMuted }]}>Sold by</Text>
              <Text style={[type.bodyStrong, { color: t.text, marginTop: 2 }]}>
                {product.seller.businessName ?? product.seller.name}
              </Text>
            </View>
            <Pressable onPress={messageSeller} style={styles.msgBtn}>
              <Text style={{ color: t.accent, fontWeight: "600", fontSize: 13 }}>Message</Text>
            </Pressable>
          </View>
        </View>

        {/* Variant picker */}
        {attrGroups.length > 0 && (
          <View style={{ marginTop: 16 }}>
            {attrGroups.map((g) => (
              <View key={g.id} style={{ marginBottom: 12 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>{g.label}</Text>
                <View style={styles.chipRow}>
                  {g.options.map((opt) => {
                    const sel = selectedAttrs[g.id] === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setSelectedAttrs((cur) => ({ ...cur, [g.id]: opt.id }))}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: sel ? t.cta : t.card,
                            borderColor: sel ? t.cta : t.border,
                          },
                        ]}
                      >
                        <Text style={{ color: sel ? t.ctaText : t.text, fontWeight: "600" }}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[type.h2, { color: t.text, marginTop: 20 }]}>Description</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 6, lineHeight: 22 }]}>
          {product.description}
        </Text>

        <Button label={adding ? "Adding..." : "Add to cart"} onPress={addToCart} loading={adding} style={{ marginTop: 16 }} />

        {/* Reviews */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={[type.h2, { color: t.text }]}>Reviews</Text>
            {reviews && reviews.ratingCount > 0 && (
              <Text style={[type.small, { color: t.textMuted }]}>
                {reviews.ratingAvg.toFixed(1)} / 5 · {reviews.ratingCount}
              </Text>
            )}
          </View>

          {writingReview ? (
            <View style={[styles.reviewForm, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[type.small, { color: t.textMuted }]}>Your rating</Text>
              <View style={[styles.chipRow, { marginTop: 6 }]}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                    <Text style={{ fontSize: 26, color: n <= rating ? t.premium : t.textFaint }}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                multiline
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder="What did you love, what could be better?"
                placeholderTextColor={t.textFaint}
                style={[styles.reviewInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button label="Save" loading={submittingReview} onPress={submitReview} style={{ flex: 1 }} />
                <Button label="Cancel" variant="secondary" onPress={() => setWritingReview(false)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : reviews?.myReview ? (
            <Pressable
              onPress={() => setWritingReview(true)}
              style={[styles.reviewForm, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <Text style={[type.small, { color: t.textMuted }]}>Your review</Text>
              <Text style={[type.bodyStrong, { color: t.premium, marginTop: 2 }]}>
                {"★".repeat(reviews.myReview.rating)}{"☆".repeat(5 - reviews.myReview.rating)}
              </Text>
              {reviews.myReview.body && (
                <Text style={[type.body, { color: t.text, marginTop: 4 }]}>{reviews.myReview.body}</Text>
              )}
              <Text style={[type.small, { color: t.accent, marginTop: 6, fontWeight: "600" }]}>Edit</Text>
            </Pressable>
          ) : (
            <Button label="Write a review" variant="secondary" onPress={() => setWritingReview(true)} style={{ marginTop: 10 }} />
          )}

          {reviews && reviews.reviews.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {reviews.reviews.map((r) => (
                <View key={r.id} style={[styles.reviewItem, { backgroundColor: t.card, borderColor: t.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[type.bodyStrong, { color: t.text }]}>{r.author.name}</Text>
                    <Text style={[type.small, { color: t.textMuted }]}>
                      {new Date(r.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                  <Text style={[type.small, { color: t.premium, marginTop: 2 }]}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </Text>
                  {r.body && <Text style={[type.body, { color: t.text, marginTop: 6 }]}>{r.body}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Zoom modal -- expo-image with contentFit=contain on a black bg */}
      <Modal visible={zoomIndex !== null} transparent animationType="fade" onRequestClose={() => setZoomIndex(null)}>
        <Pressable onPress={() => setZoomIndex(null)} style={styles.zoomBackdrop}>
          {zoomIndex !== null && images[zoomIndex] && (
            <Image
              source={{ uri: images[zoomIndex]! }}
              style={{ width: width, height: width }}
              contentFit="contain"
            />
          )}
          <Text style={styles.zoomHint}>Tap to close</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroImage: { width: "100%", height: "100%" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  sellerCard: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  reviewForm: { padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginTop: 10 },
  reviewInput: { minHeight: 80, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, fontSize: 14, marginTop: 10, textAlignVertical: "top" },
  reviewItem: { padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  msgBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  zoomBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  zoomHint: { position: "absolute", bottom: 60, color: "#999", fontSize: 12 },
});