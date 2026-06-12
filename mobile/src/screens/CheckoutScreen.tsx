import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import type { Address } from "./AddressesScreen";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  product: { id: string; name: string; price: number; salePrice: number | null; image: string | null };
};

export function CheckoutScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountCents: number } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [cart, addrs] = await Promise.all([
        api.get<{ items: CartItem[] }>("/api/cart"),
        api.get<{ addresses: Address[] }>("/api/account/addresses", { kind: "DELIVERY" }),
      ]);
      setItems(cart.items ?? []);
      const list = addrs.addresses ?? [];
      setAddresses(list);
      const fallback = list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
      setSelectedAddressId((cur) => cur ?? fallback);
    } catch {
      // ignore -- empty states render below
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setValidating(true);
    setPromoErr(null);
    try {
      const subtotalCents = Math.round(items.reduce((sum, ci) => sum + (ci.product.salePrice ?? ci.product.price) * ci.quantity, 0) * 100);
      const resp = await api.post<{ valid: boolean; discountCents?: number; error?: string; promo?: { code: string } }>("/api/promo-codes/validate", { code: promoCode.trim().toUpperCase(), subtotalCents });
      if (!resp.valid) {
        setPromoErr(resp.error ?? "Code not valid.");
        setPromoApplied(null);
        return;
      }
      setPromoApplied({ code: resp.promo?.code ?? promoCode.trim().toUpperCase(), discountCents: resp.discountCents ?? 0 });
    } catch (err) {
      setPromoErr(err instanceof Error ? err.message : "Try again.");
    } finally {
      setValidating(false);
    }
  }

  async function pay() {
    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (!addr) {
      Alert.alert("Pick an address", "Add a delivery address first.");
      return;
    }
    setPaying(true);
    try {
      const resp = await api.post<{ checkoutUrl?: string; paymentReference?: string; stub?: boolean }>(
        "/api/cart/checkout",
        {
          shippingAddress: addr.formattedAddress,
          shippingFormattedAddress: addr.formattedAddress,
          paymentMethod: "DIRECT",
          ...(promoApplied ? { promoCode: promoApplied.code } : {}),
        },
      );
      if (resp.stub) {
        Alert.alert("Order placed", "Stub-mode checkout confirmed. Check Orders to see status.");
        nav.navigate("Tabs");
        return;
      }
      if (resp.checkoutUrl) {
        const result = await WebBrowser.openAuthSessionAsync(resp.checkoutUrl, "streekmart://account/orders");
        // After return from the gateway, kick the user to their orders.
        if (result.type === "success" || result.type === "dismiss") {
          nav.navigate("Orders");
        }
      }
    } catch (err) {
      Alert.alert("Checkout failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPaying(false);
    }
  }

  if (!user) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to check out.</Text>
        <Button label="Sign in" onPress={() => nav.navigate("Login")} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }

  const subtotal = items.reduce(
    (sum, ci) => sum + (ci.product.salePrice ?? ci.product.price) * ci.quantity,
    0,
  );

  return (
    <Screen padding={false} scroll contentStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={[type.h1, { color: t.text }]}>Checkout</Text>

      {/* Delivery address */}
      <View style={{ marginTop: 16 }}>
        <View style={styles.sectionHeader}>
          <Text style={[type.h2, { color: t.text }]}>Delivery address</Text>
          <Pressable onPress={() => nav.navigate("AddressForm", { id: undefined })}>
            <Text style={[type.small, { color: t.accent, fontWeight: "600" }]}>+ Add new</Text>
          </Pressable>
        </View>
        {addresses.length === 0 ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, alignItems: "center" }]}>
            <Text style={[type.small, { color: t.textMuted, textAlign: "center" }]}>
              No saved addresses. Add one to continue.
            </Text>
            <Button
              label="Add address"
              variant="secondary"
              onPress={() => nav.navigate("AddressForm", { id: undefined })}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : (
          addresses.map((a) => {
            const selected = a.id === selectedAddressId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelectedAddressId(a.id)}
                style={[
                  styles.card,
                  {
                    backgroundColor: t.card,
                    borderColor: selected ? t.cta : t.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[type.bodyStrong, { color: t.text }]}>{a.label || "Address"}</Text>
                  {a.isDefault && (
                    <Text style={[type.micro, { color: t.success.fg, backgroundColor: t.success.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                      DEFAULT
                    </Text>
                  )}
                </View>
                <Text style={[type.small, { color: t.text, marginTop: 4 }]} numberOfLines={2}>
                  {a.formattedAddress}
                </Text>
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  {[a.city, a.region, a.country].filter(Boolean).join(", ")}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Promo code */}
      <View style={{ marginTop: 20 }}>
        <Text style={[type.h2, { color: t.text, marginBottom: 8 }]}>Promo code</Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {promoApplied ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[type.body, { color: t.success.fg }]}>
                {promoApplied.code} -- saving N{Math.round(promoApplied.discountCents / 100).toLocaleString("en-NG")}
              </Text>
              <Pressable onPress={() => { setPromoApplied(null); setPromoCode(""); }}>
                <Text style={[type.small, { color: t.danger.fg, fontWeight: "600" }]}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={promoCode}
                onChangeText={(v) => setPromoCode(v.toUpperCase())}
                placeholder="Got a code? Enter it here"
                placeholderTextColor={t.textFaint}
                autoCapitalize="characters"
                style={[styles.promoInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
              />
              <Button label={validating ? "..." : "Apply"} loading={validating} onPress={applyPromo} disabled={!promoCode.trim()} />
            </View>
          )}
          {promoErr && <Text style={[type.small, { color: t.danger.fg, marginTop: 8 }]}>{promoErr}</Text>}
        </View>
      </View>

      {/* Order summary */}
      <View style={{ marginTop: 20 }}>
        <Text style={[type.h2, { color: t.text, marginBottom: 8 }]}>Order summary</Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {items.map((ci) => {
            const eff = ci.product.salePrice ?? ci.product.price;
            return (
              <View key={ci.id} style={styles.lineItem}>
                <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={1}>
                  {ci.product.name} x{ci.quantity}
                </Text>
                <Text style={[type.bodyStrong, { color: t.text }]}>
                  N{Math.round(eff * ci.quantity).toLocaleString("en-NG")}
                </Text>
              </View>
            );
          })}
          <View style={[styles.lineItem, { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
            <Text style={[type.body, { color: t.textMuted }]}>Subtotal</Text>
            <Text style={[type.h2, { color: t.text }]}>
              N{Math.round(subtotal).toLocaleString("en-NG")}
            </Text>
          </View>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
            Delivery is calculated by the gateway based on your seller(s) and address.
          </Text>
        </View>
      </View>

      <Button
        label={paying ? "Starting payment..." : "Pay now"}
        loading={paying}
        disabled={items.length === 0 || !selectedAddressId}
        onPress={pay}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  lineItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 8 },
  promoInput: { flex: 1, height: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, fontSize: 14 },
});