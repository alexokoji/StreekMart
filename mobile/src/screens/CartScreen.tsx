import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { firstImage } from "../lib/productImage";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { useCart } from "../state/CartContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    image: string | null;
    seller?: {
      id?: string;
      businessName?: string | null;
      name: string;
      // Only affiliated sellers expose a preset delivery fee. Everyone
      // else gets a Shipbubble courier quote when the buyer picks an
      // address at checkout.
      streekmartAffiliated?: boolean;
      deliveryWithinCityCents?: number;
      deliveryOutsideCityCents?: number;
      deliveryOutsideCountryCents?: number;
    };
  };
};

type CartResp = { items: CartItem[]; totalCents?: number };

// FAB clearance for the centre Search tab + room for the sticky total bar.
const FAB_CLEARANCE = 110;
const FOOTER_HEIGHT = 96;

export function CartScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { bumpCart } = useCart();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }
    try {
      const data = await api.get<CartResp>("/api/cart");
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateQty(id: string, qty: number) {
    setBusy(id);
    try {
      // Same endpoint as the web CartClient — /api/cart/items/[id] for
      // per-row PATCH/DELETE. The bare /api/cart route only handles
      // GET (list), POST (add), and DELETE (clear all).
      if (qty <= 0) {
        await api.delete(`/api/cart/items/${id}`);
      } else {
        await api.patch(`/api/cart/items/${id}`, { quantity: qty });
      }
      await Promise.all([load(), bumpCart()]);
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Shopping bag" />
        <View style={styles.empty}>
          <Text style={[type.h2, { color: t.text }]}>Your cart is empty</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6, textAlign: "center" }]}>
            Sign in to save items between sessions and check out.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700" }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Shopping bag" />
        <View style={styles.empty}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }

  const subtotal = items.reduce(
    (sum, ci) => sum + (ci.product.salePrice ?? ci.product.price) * ci.quantity,
    0,
  );
  // Web parity: the cart screen no longer prices shipping. Every
  // delivery routes through Shipbubble and the courier + fee is picked
  // on the checkout page. We show "Calculated at checkout" here and let
  // the grand total equal the subtotal so the buyer isn't surprised by
  // a fake preset.
  const total = subtotal;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader
        title="Shopping bag"
        rightAction={
          <Pressable onPress={() => nav.navigate("Wishlist")} hitSlop={8}>
            <Ionicons name="heart-outline" size={22} color={t.text} />
          </Pressable>
        }
      />

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Nothing in your bag yet. Browse the home page to add items.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: FAB_CLEARANCE + FOOTER_HEIGHT,
            gap: 12,
          }}
        >
          {/* Items */}
          {items.map((ci) => (
            <CartRow
              key={ci.id}
              item={ci}
              disabled={busy === ci.id}
              onIncrement={() => updateQty(ci.id, ci.quantity + 1)}
              onDecrement={() => updateQty(ci.id, ci.quantity - 1)}
              onRemove={() => updateQty(ci.id, 0)}
            />
          ))}

          {/* Apply coupons row */}
          <Pressable
            onPress={() => nav.navigate("Coupons")}
            style={({ pressed }) => [
              styles.couponRow,
              { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Ionicons name="ticket-outline" size={22} color={t.text} />
              <Text style={[type.bodyStrong, { color: t.text }]}>Apply coupons</Text>
            </View>
            <Text style={[type.bodyStrong, { color: t.cta }]}>Select</Text>
          </Pressable>

          {/* Order payment details */}
          <View style={[styles.summary, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[type.h2, { color: t.text }]}>Order summary</Text>
            <SummaryRow label="Subtotal" value={fmt(subtotal)} t={t} />
            <SummaryRow label="Delivery" value="Calculated at checkout" t={t} />
            <View style={[styles.summaryDivider, { backgroundColor: t.border }]} />
            <SummaryRow label="Total" value={fmt(total)} t={t} bold />
          </View>
        </ScrollView>
      )}

      {/* Sticky bottom: total snapshot + Continue */}
      {items.length > 0 ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: t.bgElevated,
              borderTopColor: t.border,
              paddingBottom: 12,
              bottom: FAB_CLEARANCE - 36,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[type.small, { color: t.textMuted }]}>Total</Text>
            <Text style={[type.h2, { color: t.text }]}>{fmt(total)}</Text>
          </View>
          <Pressable
            onPress={() => nav.navigate("Checkout")}
            style={({ pressed }) => [
              styles.checkoutBtn,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700", fontSize: 16 }}>Checkout</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function CartRow({
  item,
  disabled,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const effective = item.product.salePrice ?? item.product.price;
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: t.card, borderColor: t.border, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: t.bg }]}>
        {firstImage(item.product) ? (
          <Image source={{ uri: firstImage(item.product)! }} style={styles.thumbImg} contentFit="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>
          {item.product.name}
        </Text>
        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {item.product.seller?.businessName ?? item.product.seller?.name ?? ""}
        </Text>
        <Text style={[type.h2, { color: t.cta, marginTop: 8 }]}>
          {fmt(effective * item.quantity)}
        </Text>
        <View style={styles.qtyRow}>
          <View style={[styles.qtyGroup, { borderColor: t.border }]}>
            <Pressable onPress={onDecrement} style={styles.qtyBtn}>
              <Text style={{ color: t.text, fontSize: 18 }}>−</Text>
            </Pressable>
            <Text style={[type.bodyStrong, { color: t.text, paddingHorizontal: 14 }]}>
              {item.quantity}
            </Text>
            <Pressable onPress={onIncrement} style={styles.qtyBtn}>
              <Text style={{ color: t.text, fontSize: 18 }}>+</Text>
            </Pressable>
          </View>
          <Pressable onPress={onRemove} hitSlop={6} style={{ marginLeft: "auto" }}>
            <Text style={[type.small, { color: t.danger.fg, fontWeight: "700" }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  t,
  bold,
  valueStyle,
}: {
  label: string;
  value: string;
  t: ReturnType<typeof useTheme>;
  bold?: boolean;
  valueStyle?: object;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[bold ? type.bodyStrong : type.body, { color: t.textMuted }]}>{label}</Text>
      <Text
        style={[
          bold ? type.h2 : type.bodyStrong,
          { color: t.text },
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function fmt(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  signInBtn: {
    marginTop: 18,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 88, height: 88, borderRadius: radius.sm, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  qtyGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  couponRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summary: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryDivider: { height: 1, marginVertical: 6 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkoutBtn: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
