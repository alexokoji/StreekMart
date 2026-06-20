import React, { useCallback, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { BackHeader } from "../components/BackHeader";
import { Chip } from "../components/Chip";
import { api } from "../api/client";
import { sellerDisplayName } from "../lib/sellerName";
import { CartIcon } from "../components/CartIcon";
import { useCart } from "../state/CartContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

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
  // Server sends *Json string fields; some endpoints normalise. Accept both.
  images?: string[];
  imagesJson?: string;
  sizes?: string[];
  sizesJson?: string;
  attributesJson?: string;
  seller: { id: string; name: string; businessName?: string | null };
  ratingAvg?: number;
  ratingCount?: number;
};

// Build the carousel image list from either field, swallowing parse errors.
function imagesFor(product: Product): string[] {
  if (product.images && product.images.length > 0) return product.images;
  if (product.imagesJson) {
    try {
      const arr = JSON.parse(product.imagesJson);
      if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === "string");
    } catch {
      /* fall through */
    }
  }
  return [];
}

function sizesFor(product: Product): string[] {
  if (product.sizes && product.sizes.length > 0) return product.sizes;
  if (product.sizesJson) {
    try {
      const arr = JSON.parse(product.sizesJson);
      if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === "string");
    } catch {
      /* fall through */
    }
  }
  return [];
}

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

const { width: SCREEN_W } = Dimensions.get("window");
const FAB_CLEARANCE = 110;

export function ProductDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ProductDetail">>();
  const { id } = route.params;
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { bumpCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  const [reviews, setReviews] = useState<ReviewsResp | null>(null);
  const [writingReview, setWritingReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const attrGroups: AttrGroup[] = useMemo(() => {
    if (!product?.attributesJson) return [];
    try {
      const parsed = JSON.parse(product.attributesJson);
      if (!Array.isArray(parsed)) return [];

      // The server / seller might send the variation options in a few
      // different shapes — handle all of them so chips don't render
      // blank:
      //   1. [{ id, label, options: [{ id, label }] }]
      //   2. [{ id, label, options: ["Red", "Blue"] }]
      //   3. [{ id, label, values: [...] }]    (alt key)
      //   4. { Color: ["Red", "Blue"], Material: [...] }  (record-style)
      const normaliseOption = (o: unknown, j: number): AttrOption => {
        if (typeof o === "string") return { id: o || `o${j}`, label: o };
        if (o && typeof o === "object") {
          const obj = o as { id?: string; label?: string; value?: string; name?: string };
          const label = obj.label ?? obj.value ?? obj.name ?? "";
          return { id: obj.id ?? label ?? `o${j}`, label };
        }
        return { id: `o${j}`, label: String(o ?? "") };
      };

      const out: AttrGroup[] = parsed
        .map((g: unknown, i: number): AttrGroup | null => {
          if (typeof g !== "object" || g === null) return null;
          const raw = g as {
            id?: string;
            label?: string;
            name?: string;
            options?: unknown[];
            values?: unknown[];
          };
          const label = raw.label ?? raw.name ?? `Option ${i + 1}`;
          const rawOptions = raw.options ?? raw.values ?? [];
          const options = rawOptions
            .map(normaliseOption)
            .filter((o) => o.label.length > 0);
          return {
            id: raw.id ?? label.toLowerCase().replace(/\s+/g, "-") ?? `g${i}`,
            label,
            options,
          };
        })
        .filter((g): g is AttrGroup => g !== null && g.options.length > 0);

      return out;
    } catch {
      return [];
    }
  }, [product]);

  const loadProduct = useCallback(async () => {
    try {
      const data = await api.get<{ product: Product }>(`/api/products/${id}`);
      let p = data.product;
      // If the product endpoint hasn't been redeployed with the widened
      // seller select, businessName won't be on the row. /api/search
      // resolves seller.name to `businessName?.trim() || name` already,
      // so use it as a fallback display source.
      const business = (p.seller?.businessName ?? "").trim();
      if (!business) {
        try {
          const r = await api.post<{
            results: Array<{ id: string; seller: { id: string; name: string } }>;
          }>("/api/search", { query: p.name });
          const hit = (r.results ?? []).find(
            (h) => h.id === p.id || h.seller?.id === p.seller?.id,
          );
          const resolved = hit?.seller?.name?.trim();
          if (resolved && resolved !== p.seller?.name) {
            p = { ...p, seller: { ...p.seller, businessName: resolved } };
          }
        } catch {
          /* ignore */
        }
      }
      setProduct(p);
      if (user) api.post("/api/recently-viewed", { productId: id }).catch(() => {});
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
      /* ignore */
    }
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
      loadReviews();
      loadSaved();
    }, [loadProduct, loadReviews, loadSaved]),
  );

  async function toggleSave() {
    if (!user) {
      Alert.alert("Sign in", "Sign in to save items to your wishlist.");
      return;
    }
    const prev = saved;
    setSaved(!prev);
    try {
      const res = await api.post<{ saved: boolean }>("/api/favorites", { kind: "product", id });
      setSaved(res.saved);
    } catch {
      setSaved(prev);
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
      nav.navigate("Chat", { id: r.chat.id, counterpartName: sellerDisplayName(product.seller) });
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
      /* user cancelled */
    }
  }

  function validatedAddPayload(): Record<string, unknown> | null {
    if (!product) return null;
    const availableSizes = sizesFor(product);
    if (availableSizes.length > 0 && !selectedSize) {
      Alert.alert("Pick a size", "Choose a size before adding to your cart.");
      return null;
    }
    // Server-side AttributeSelection is `Record<groupName, optionLabel>`
    // (see src/lib/productAttributes.ts on the web). Build the same shape
    // here so the /api/cart POST validates instead of bouncing back with
    // "Please choose a <name>" for every group.
    const selectionByGroupName: Record<string, string> = {};
    for (const g of attrGroups) {
      const picked = selectedAttrs[g.label];
      if (g.options.length > 0 && !picked) {
        Alert.alert("Pick options", `Choose a ${g.label.toLowerCase()} first.`);
        return null;
      }
      if (picked) {
        // Translate the picked option's id back to its canonical label.
        const opt = g.options.find((o) => o.id === picked);
        if (opt) selectionByGroupName[g.label] = opt.label;
      }
    }
    const payload: Record<string, unknown> = { productId: product.id, quantity: 1 };
    if (selectedSize) payload.size = selectedSize;
    // The /api/cart POST contract uses `selectedAttributes`, not
    // `attributesSelection` — match the web exactly.
    if (Object.keys(selectionByGroupName).length > 0) {
      payload.selectedAttributes = selectionByGroupName;
    }
    return payload;
  }

  async function addToCart() {
    if (!user) {
      Alert.alert("Sign in", "You need an account to add items to the cart.");
      return;
    }
    const payload = validatedAddPayload();
    if (!payload) return;
    setAdding(true);
    try {
      await api.post("/api/cart", payload);
      // Refresh the global cart count so every cart icon updates.
      bumpCart().catch(() => {});
      Alert.alert("Added", `${product!.name} is in your cart.`);
    } catch (err) {
      Alert.alert("Couldn't add", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function buyNow() {
    if (!user) {
      Alert.alert("Sign in", "You need an account to check out.");
      return;
    }
    const payload = validatedAddPayload();
    if (!payload) return;
    setAdding(true);
    try {
      await api.post("/api/cart", payload);
      bumpCart().catch(() => {});
      nav.navigate("Checkout");
    } catch (err) {
      Alert.alert("Couldn't continue", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function submitReview() {
    setSubmittingReview(true);
    try {
      await api.post(`/api/products/${id}/reviews`, {
        rating,
        body: reviewBody || undefined,
      });
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
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={t.cta} size="large" />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader />
        <View style={styles.centered}>
          <Text style={[type.body, { color: t.text }]}>Product not found.</Text>
        </View>
      </View>
    );
  }

  const effective = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice != null && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;
  const parsedImages = imagesFor(product);
  const images: Array<string | null> = parsedImages.length > 0 ? parsedImages : [null];
  const sizes = sizesFor(product);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader
        rightAction={
          <Pressable onPress={() => goToTab(nav, "Cart")} hitSlop={8}>
            <CartIcon />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: FAB_CLEARANCE + 40 }}>
        {/* Image carousel */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setActiveImage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
          >
            {images.map((img, i) => (
              <Pressable
                key={i}
                onPress={() => img && setZoomIndex(i)}
                style={{ width: SCREEN_W, aspectRatio: 1, backgroundColor: t.bgElevated }}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.heroImage} contentFit="cover" transition={150} />
                ) : null}
              </Pressable>
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
                      backgroundColor: i === activeImage ? t.cta : t.border,
                      width: i === activeImage ? 16 : 8,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={toggleSave}
            hitSlop={8}
            style={[styles.heartFab, { backgroundColor: "rgba(255,255,255,0.92)" }]}
          >
            <Ionicons
              name={saved ? "heart" : "heart-outline"}
              size={20}
              color={saved ? t.promo : t.textMuted}
            />
          </Pressable>
        </View>

        {/* Title, seller, rating, price */}
        <View style={styles.block}>
          <Text style={[type.h1, { color: t.text }]}>{product.name}</Text>
          <View style={styles.sellerLine}>
            <Pressable
              onPress={() =>
                nav.navigate("SellerProfile", {
                  id: product.seller.id,
                  name: product.seller.name,
                  businessName: product.seller.businessName ?? null,
                })
              }
              hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={[type.bodyStrong, { color: t.cta, marginTop: 6 }]}>
                {sellerDisplayName(product.seller)}
              </Text>
            </Pressable>
            <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}> · </Text>
            <Pressable onPress={messageSeller} hitSlop={6}>
              <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>Message</Text>
            </Pressable>
          </View>

          {(reviews?.ratingCount ?? 0) > 0 ? (
            <View style={styles.ratingRow}>
              <StarRow value={reviews?.ratingAvg ?? 0} size={16} />
              <Text style={[type.small, { color: t.textMuted, marginLeft: 8 }]}>
                {(reviews?.ratingAvg ?? 0).toFixed(1)} · {(reviews?.ratingCount ?? 0).toLocaleString("en-NG")} reviews
              </Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={[type.display, { color: t.text, fontSize: 28 }]}>
              ₦{Math.round(effective).toLocaleString("en-NG")}
            </Text>
            {hasDiscount ? (
              <>
                <Text style={[type.body, { color: t.textMuted, textDecorationLine: "line-through", marginLeft: 10 }]}>
                  ₦{Math.round(product.price).toLocaleString("en-NG")}
                </Text>
                <Text style={[type.bodyStrong, { color: t.promo, marginLeft: 10 }]}>{discountPct}% off</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Variant pickers — Size + any attribute groups, all grouped
            into one "Choose options" card so it's obvious the buyer
            has to make these selections before adding to cart. */}
        {sizes.length > 0 || attrGroups.length > 0 ? (
          <View style={styles.block}>
            <Text style={[type.h2, { color: t.text, marginBottom: 12 }]}>Choose options</Text>
            <View style={[styles.variantCard, { backgroundColor: t.card, borderColor: t.border }]}>
              {sizes.length > 0 ? (
                <View style={{ marginBottom: attrGroups.length > 0 ? 14 : 0 }}>
                  <View style={styles.variantHead}>
                    <Text style={[type.bodyStrong, { color: t.text }]}>Size</Text>
                    {selectedSize ? (
                      <Text style={[type.small, { color: t.cta, fontWeight: "700" }]}>{selectedSize} selected</Text>
                    ) : (
                      <Text style={[type.small, { color: t.danger.fg, fontWeight: "700" }]}>Required</Text>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantRow}>
                    {sizes.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        selected={selectedSize === s}
                        onPress={() => setSelectedSize(s)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            {attrGroups.map((g, i) => {
              const selOpt = g.options.find((o) => o.id === selectedAttrs[g.label]);
              return (
                <View key={g.label} style={{ marginBottom: i < attrGroups.length - 1 ? 14 : 0 }}>
                  <View style={styles.variantHead}>
                    <Text style={[type.bodyStrong, { color: t.text }]}>{g.label}</Text>
                    {selOpt ? (
                      <Text style={[type.small, { color: t.cta, fontWeight: "700" }]}>{selOpt.label} selected</Text>
                    ) : (
                      <Text style={[type.small, { color: t.danger.fg, fontWeight: "700" }]}>Required</Text>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantRow}>
                    {g.options.map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={selectedAttrs[g.label] === opt.id}
                        onPress={() => setSelectedAttrs((cur) => ({ ...cur, [g.label]: opt.id }))}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            })}
            </View>
          </View>
        ) : null}

        {/* Description with collapse/expand */}
        <View style={styles.block}>
          <Text style={[type.bodyStrong, { color: t.text, marginBottom: 6 }]}>Product details</Text>
          <Text
            style={[type.body, { color: t.textMuted, lineHeight: 22 }]}
            numberOfLines={showFullDescription ? undefined : 4}
          >
            {product.description}
          </Text>
          {product.description.length > 200 ? (
            <Pressable onPress={() => setShowFullDescription((s) => !s)} hitSlop={6}>
              <Text style={[type.small, { color: t.cta, fontWeight: "700", marginTop: 6 }]}>
                {showFullDescription ? "Show less" : "...Read more"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Badge chips */}
        <View style={[styles.block, { flexDirection: "row", flexWrap: "wrap", gap: 8 }]}>
          <BadgeChip label="Verified seller" />
          <BadgeChip label="Secure checkout" />
          <BadgeChip label="Return policy" />
        </View>

        {/* Primary actions: Add to cart + Buy now */}
        <View style={[styles.block, { flexDirection: "row", gap: 12 }]}>
          <Pressable
            onPress={addToCart}
            disabled={adding}
            style={({ pressed }) => [
              styles.ctaPill,
              { backgroundColor: t.cta, opacity: pressed || adding ? 0.85 : 1 },
            ]}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="bag-handle" size={18} color={t.ctaText} />
              <Text style={{ color: t.ctaText, fontSize: 16, fontWeight: "700" }}>Add to cart</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={buyNow}
            disabled={adding}
            style={({ pressed }) => [
              styles.ctaPill,
              { backgroundColor: t.success.fg, opacity: pressed || adding ? 0.85 : 1 },
            ]}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Buy now</Text>
            </View>
          </Pressable>
        </View>

        {/* Delivery info card */}
        <View style={styles.block}>
          <View style={[styles.deliveryCard, { backgroundColor: "rgba(217,70,239,0.10)", borderColor: t.promo }]}>
            <Text style={[type.small, { color: t.textMuted }]}>Delivery</Text>
            <Text style={[type.bodyStrong, { color: t.text, marginTop: 2 }]}>3–5 business days</Text>
          </View>
        </View>

        {/* Secondary actions */}
        <View style={[styles.block, { flexDirection: "row", gap: 12 }]}>
          <Pressable
            onPress={shareProduct}
            style={({ pressed }) => [
              styles.outlinedBtn,
              { borderColor: t.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="share-outline" size={16} color={t.text} />
              <Text style={{ color: t.text, fontWeight: "700" }}>Share</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("Trending" as never)}
            style={({ pressed }) => [
              styles.outlinedBtn,
              { borderColor: t.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="eye-outline" size={16} color={t.text} />
              <Text style={{ color: t.text, fontWeight: "700" }}>View similar</Text>
            </View>
          </Pressable>
        </View>

        {/* Reviews */}
        <View style={styles.block}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={[type.h2, { color: t.text }]}>Reviews</Text>
            {(reviews?.ratingCount ?? 0) > 0 ? (
              <Text style={[type.small, { color: t.textMuted }]}>
                {(reviews?.ratingAvg ?? 0).toFixed(1)} / 5 · {reviews?.ratingCount}
              </Text>
            ) : null}
          </View>

          {writingReview ? (
            <View style={[styles.reviewForm, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[type.small, { color: t.textMuted }]}>Your rating</Text>
              <View style={{ flexDirection: "row", marginTop: 6, gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                    <Ionicons
                      name={n <= rating ? "star" : "star-outline"}
                      size={28}
                      color={n <= rating ? t.premium : t.textFaint}
                    />
                  </Pressable>
                ))}
              </View>
              <TextInput
                multiline
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder="What worked, what didn't?"
                placeholderTextColor={t.textFaint}
                style={[styles.reviewInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable
                  onPress={submitReview}
                  disabled={submittingReview}
                  style={[styles.smallCta, { backgroundColor: t.cta, opacity: submittingReview ? 0.6 : 1 }]}
                >
                  <Text style={{ color: t.ctaText, fontWeight: "700" }}>
                    {submittingReview ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setWritingReview(false)}
                  style={[styles.smallCta, { backgroundColor: t.card, borderWidth: 1, borderColor: t.border }]}
                >
                  <Text style={{ color: t.text, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : reviews?.myReview ? (
            <Pressable
              onPress={() => setWritingReview(true)}
              style={[styles.reviewForm, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <Text style={[type.small, { color: t.textMuted }]}>Your review</Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <StarRow value={reviews.myReview.rating} size={16} />
              </View>
              {reviews.myReview.body ? (
                <Text style={[type.body, { color: t.text, marginTop: 4 }]}>{reviews.myReview.body}</Text>
              ) : null}
              <Text style={[type.small, { color: t.cta, marginTop: 6, fontWeight: "700" }]}>Edit</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setWritingReview(true)}
              style={[styles.smallCta, { backgroundColor: t.card, borderWidth: 1, borderColor: t.cta, marginTop: 12, alignSelf: "flex-start" }]}
            >
              <Text style={{ color: t.cta, fontWeight: "700" }}>Write a review</Text>
            </Pressable>
          )}

          {(reviews?.reviews.length ?? 0) > 0 ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              {reviews!.reviews.map((r) => (
                <View key={r.id} style={[styles.reviewItem, { backgroundColor: t.card, borderColor: t.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[type.bodyStrong, { color: t.text }]}>{r.author.name}</Text>
                    <Text style={[type.small, { color: t.textMuted }]}>
                      {new Date(r.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                  <View style={{ marginTop: 4 }}>
                    <StarRow value={r.rating} size={14} />
                  </View>
                  {r.body ? <Text style={[type.body, { color: t.text, marginTop: 6 }]}>{r.body}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Zoom modal */}
      <Modal visible={zoomIndex !== null} transparent animationType="fade" onRequestClose={() => setZoomIndex(null)}>
        <Pressable onPress={() => setZoomIndex(null)} style={styles.zoomBackdrop}>
          {zoomIndex !== null && images[zoomIndex] ? (
            <Image source={{ uri: images[zoomIndex]! }} style={{ width: SCREEN_W, height: SCREEN_W }} contentFit="contain" />
          ) : null}
          <Text style={styles.zoomHint}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function BadgeChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.badge, { borderColor: t.border, backgroundColor: t.card }]}>
      <Text style={[type.small, { color: t.textMuted, fontWeight: "600" }]}>{label}</Text>
    </View>
  );
}

// Five-star rating display, filled per the value rounded to nearest int.
function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  const t = useTheme();
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rounded ? "star" : "star-outline"}
          size={size}
          color={n <= rounded ? t.premium : t.textFaint}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  heroImage: { width: "100%", height: "100%" },
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
  heartFab: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  block: { paddingHorizontal: 16, paddingTop: 14 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10 },
  ctaPill: {
    flex: 1,
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  sellerLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  variantHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  variantRow: { gap: 8, paddingVertical: 2, paddingRight: 16 },
  variantCard: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deliveryCard: {
    padding: 14,
    borderRadius: radius.md,
    borderLeftWidth: 4,
  },
  outlinedBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  reviewForm: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 12,
  },
  reviewInput: {
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    marginTop: 10,
    textAlignVertical: "top",
  },
  reviewItem: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  smallCta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomHint: { position: "absolute", bottom: 60, color: "#999", fontSize: 12 },
});
