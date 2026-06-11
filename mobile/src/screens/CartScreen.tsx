import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

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
    seller?: { businessName?: string | null; name: string };
  };
};

type CartResp = { items: CartItem[]; totalCents?: number };

export function CartScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
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
      if (qty <= 0) {
        await api.delete(`/api/cart/${id}`);
      } else {
        await api.patch(`/api/cart/${id}`, { quantity: qty });
      }
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!user) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={[type.h2, { color: t.text }]}>Your cart is empty</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6, textAlign: "center" }]}>
            Sign in to save items between sessions and check out.
          </Text>
          <Button label="Sign in" onPress={() => nav.navigate("Login")} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </Screen>
    );
  }

  const total = items.reduce(
    (sum, ci) => sum + (ci.product.salePrice ?? ci.product.price) * ci.quantity,
    0,
  );

  return (
    <Screen padding={false}>
      <FlatList
        data={items}
        keyExtractor={(ci) => ci.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <Text style={[type.h1, { color: t.text, marginBottom: 8 }]}>Cart</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>
              Nothing here yet. Browse the home page to add items.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CartRow
            item={item}
            disabled={busy === item.id}
            onIncrement={() => updateQty(item.id, item.quantity + 1)}
            onDecrement={() => updateQty(item.id, item.quantity - 1)}
            onRemove={() => updateQty(item.id, 0)}
          />
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <View style={styles.totalRow}>
                <Text style={[type.body, { color: t.textMuted }]}>Subtotal</Text>
                <Text style={[type.h2, { color: t.text }]}>
                  ₦{Math.round(total).toLocaleString("en-NG")}
                </Text>
              </View>
              <Button
                label="Proceed to checkout"
                style={{ marginTop: 12 }}
                onPress={() => Alert.alert("Checkout", "Checkout lives in the web flow for V2 — coming next.")}
              />
            </View>
          ) : null
        }
      />
    </Screen>
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
      <View style={[styles.thumb, { backgroundColor: t.bgElevated }]}>
        {item.product.image && (
          <Image source={{ uri: item.product.image }} style={styles.thumbImg} contentFit="cover" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: t.text }]} numberOfLines={2}>
          {item.product.name}
        </Text>
        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
          {item.product.seller?.businessName ?? item.product.seller?.name}
        </Text>
        <Text style={[type.bodyStrong, { color: t.cta, marginTop: 6 }]}>
          ₦{Math.round(effective * item.quantity).toLocaleString("en-NG")}
        </Text>
        <View style={styles.qtyRow}>
          <Pressable onPress={onDecrement} style={[styles.qtyBtn, { borderColor: t.border }]}>
            <Text style={{ color: t.text, fontSize: 18 }}>−</Text>
          </Pressable>
          <Text style={[type.body, { color: t.text, minWidth: 30, textAlign: "center" }]}>
            {item.quantity}
          </Text>
          <Pressable onPress={onIncrement} style={[styles.qtyBtn, { borderColor: t.border }]}>
            <Text style={{ color: t.text, fontSize: 18 }}>+</Text>
          </Pressable>
          <Pressable onPress={onRemove} style={{ marginLeft: "auto", padding: 6 }}>
            <Text style={[type.small, { color: t.danger.fg, fontWeight: "600" }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 32, alignItems: "center" },
  row: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 80, height: 80, borderRadius: radius.sm, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
