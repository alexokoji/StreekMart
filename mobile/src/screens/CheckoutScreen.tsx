import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import type { Address } from "./AddressesScreen";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same seller shape the web's CheckoutForm reads — needed for the
// /api/logistics/rates call (pickup city/state/country) and to label
// per-seller rate groups.
type CartSeller = {
  id: string;
  name?: string | null;
  businessName?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  sellerVerified?: boolean | null;
};

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
    seller?: CartSeller | null;
  };
};

// Shape returned by /api/logistics/rates — same as the web reads.
type LogisticsRate = {
  id: string;
  name: string;
  price: number; // kobo (NGN × 100)
  estimatedDays: number | null;
  eta?: string | null;
  provider?: string;
};

const FAB_CLEARANCE = 110;

export function CheckoutScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [me, setMe] = useState<{ city?: string | null; region?: string | null; country?: string | null } | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountCents: number } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Per-seller Shipbubble rates (mirrors the web's ratesBySeller /
  // selectedBySeller / errorBySeller maps).
  const [ratesBySeller, setRatesBySeller] = useState<Record<string, LogisticsRate[] | null>>({});
  const [errorBySeller, setErrorBySeller] = useState<Record<string, string | null>>({});
  const [selectedBySeller, setSelectedBySeller] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [cart, addrs, meResp] = await Promise.all([
        api.get<{ items: CartItem[] }>("/api/cart"),
        api.get<{ addresses: Address[] }>("/api/account/addresses", { kind: "DELIVERY" }),
        api.get<{ user: { city?: string | null; region?: string | null; country?: string | null } | null }>("/api/me"),
      ]);
      setItems(cart.items ?? []);
      const list = addrs.addresses ?? [];
      setAddresses(list);
      const fallback = list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
      setSelectedAddressId((cur) => cur ?? fallback);
      setMe(meResp.user ?? null);
    } catch {
      /* swallow -- empty states render below */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Distinct sellers in the cart — drives the per-seller rate fetch and
  // the rate-picker UI.
  const sellers: CartSeller[] = (() => {
    const map = new Map<string, CartSeller>();
    for (const ci of items) {
      const s = ci.product.seller;
      if (!s || !s.id) continue;
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return Array.from(map.values());
  })();

  const selectedAddr = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // Fetch Shipbubble rates for every seller in the cart whenever the
  // buyer picks (or changes) a delivery address. Mirrors the web's
  // CheckoutForm exactly — same /api/logistics/rates endpoint and body
  // shape.
  useEffect(() => {
    if (!selectedAddr || !me || sellers.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const s of sellers) {
        // Always attempt the rates call. The /api/logistics/rates server
        // route can fill missing pickup city/state/country from the
        // seller's own user record when sellerId is provided, so a stale
        // cart payload (production not yet redeployed with the widened
        // seller select) shouldn't false-positive "seller has no
        // location set" before the server has had a chance to reply.
        setRatesBySeller((prev) => ({ ...prev, [s.id]: null }));
        setErrorBySeller((prev) => ({ ...prev, [s.id]: null }));
        try {
          // Same payload shape the web's CheckoutForm sends. Forwarding
          // placeId / latitude / longitude (when the saved Address row
          // has them — typically present if the address was added via
          // the web's Google Places picker) is what gets Shipbubble's
          // validator to accept the delivery leg.
          const payload: Record<string, unknown> = {
            provider: "SHIPBUBBLE",
            sellerId: s.id,
            pickupCity: s.city ?? "",
            pickupState: s.region ?? "",
            pickupCountry: s.country ?? "",
            deliveryCity: selectedAddr.city ?? me.city ?? "",
            deliveryState: selectedAddr.region ?? me.region ?? "",
            deliveryCountry: selectedAddr.country ?? me.country ?? "NG",
            description: "Order from StreekMart",
            deliveryFormattedAddress: selectedAddr.formattedAddress,
          };
          if (selectedAddr.placeId) payload.deliveryPlaceId = selectedAddr.placeId;
          if (selectedAddr.latitude != null) payload.deliveryLatitude = selectedAddr.latitude;
          if (selectedAddr.longitude != null) payload.deliveryLongitude = selectedAddr.longitude;
          const r = await api.post<{
            ok: boolean;
            rates?: LogisticsRate[];
            error?: string;
          }>("/api/logistics/rates", payload);
          if (cancelled) return;
          if (r.ok && Array.isArray(r.rates)) {
            setRatesBySeller((prev) => ({ ...prev, [s.id]: r.rates ?? [] }));
          } else {
            setRatesBySeller((prev) => ({ ...prev, [s.id]: [] }));
            setErrorBySeller((prev) => ({
              ...prev,
              [s.id]: r.error ?? "Couldn't fetch shipping options.",
            }));
          }
        } catch (err) {
          if (cancelled) return;
          setRatesBySeller((prev) => ({ ...prev, [s.id]: [] }));
          setErrorBySeller((prev) => ({
            ...prev,
            [s.id]: err instanceof Error ? err.message : "Network error",
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddressId, me?.city, me?.region, me?.country, sellers.map((s) => s.id).join(",")]);

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setValidating(true);
    setPromoErr(null);
    try {
      const subtotalCents = Math.round(
        items.reduce((sum, ci) => sum + (ci.product.salePrice ?? ci.product.price) * ci.quantity, 0) * 100,
      );
      const resp = await api.post<{ valid: boolean; discountCents?: number; error?: string; promo?: { code: string } }>(
        "/api/promo-codes/validate",
        { code: promoCode.trim().toUpperCase(), subtotalCents },
      );
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
    const addr = selectedAddr;
    if (!addr) {
      Alert.alert("Pick an address", "Add a delivery address first.");
      return;
    }
    // Every seller in the cart must have a picked rate before we can
    // ask the server to bill. Same gate the web's CheckoutForm enforces.
    const unselected = sellers.filter((s) => !selectedBySeller[s.id]);
    if (unselected.length > 0) {
      Alert.alert(
        "Pick delivery option",
        `Pick a courier for ${unselected.length === 1 ? "the seller" : "every seller"} before placing the order.`,
      );
      return;
    }
    const shippingChoices = sellers
      .map((s) => {
        const rateId = selectedBySeller[s.id];
        const rate = ratesBySeller[s.id]?.find((r) => r.id === rateId);
        if (!rate) return null;
        return {
          sellerId: s.id,
          provider: rate.provider ?? "SHIPBUBBLE",
          courierId: rate.id,
          courierName: rate.name,
          priceCents: rate.price ?? null,
          estimatedDays: rate.estimatedDays ?? null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    setPaying(true);
    try {
      // /api/cart/checkout contract (web `CheckoutForm.onSubmit`):
      //   { shippingAddress, shippingFormattedAddress, shippingLatitude?,
      //     shippingLongitude?, shippingPlaceId?, notes?, paymentMethod,
      //     shippingChoices, promoCode? }
      // Response:
      //   live mode → { ok, paymentReference, redirectUrl, orders }
      //   stub mode → { ok, paymentReference, orders }
      //   wallet-only → { ok, paymentReference, paidByWallet, orders }
      const resp = await api.post<{
        ok?: boolean;
        paymentReference?: string;
        redirectUrl?: string;
        paidByWallet?: boolean;
      }>("/api/cart/checkout", {
        shippingAddress: addr.formattedAddress,
        shippingFormattedAddress: addr.formattedAddress,
        ...(addr.latitude != null ? { shippingLatitude: addr.latitude } : {}),
        ...(addr.longitude != null ? { shippingLongitude: addr.longitude } : {}),
        ...(addr.placeId ? { shippingPlaceId: addr.placeId } : {}),
        paymentMethod: "DIRECT",
        shippingChoices,
        ...(promoApplied ? { promoCode: promoApplied.code } : {}),
      });
      if (resp.paidByWallet) {
        Alert.alert("Order placed", "Paid in full from your wallet. Check Orders for status.");
        nav.navigate("Orders");
        return;
      }
      if (resp.redirectUrl) {
        // Korapay hosted checkout. Open it inside an in-app WebView so
        // the buyer stays in the app the whole way through; the
        // PaymentScreen pops itself when the gateway redirects to
        // /cart/checkout/return?ref=… and routes the buyer to Orders.
        nav.navigate("Payment", {
          url: resp.redirectUrl,
          paymentReference: resp.paymentReference,
        });
        return;
      }
      // No redirectUrl and not wallet-paid → stub mode, orders auto-confirmed.
      Alert.alert("Order placed", "Stub-mode checkout confirmed. Check Orders for status.");
      nav.navigate("Orders");
    } catch (err) {
      Alert.alert("Checkout failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPaying(false);
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Checkout" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.text }]}>Sign in to check out.</Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [styles.signInBtn, { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 }]}
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
        <BackHeader title="Checkout" />
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
  const discount = (promoApplied?.discountCents ?? 0) / 100;
  // Delivery total = sum of the buyer's picked courier prices, all in
  // NGN kobo on the wire. Mirrors the web's setShippingKoboTotal hook.
  const deliveryKobo = sellers.reduce((acc, s) => {
    const rateId = selectedBySeller[s.id];
    const rate = ratesBySeller[s.id]?.find((r) => r.id === rateId);
    return acc + (rate?.price ?? 0);
  }, 0);
  const deliveryFee = deliveryKobo / 100;
  const allSellersPicked = sellers.every((s) => !!selectedBySeller[s.id]);
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Checkout" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: FAB_CLEARANCE + 36, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Delivery address */}
        <View>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitle}>
              <Ionicons name="location-outline" size={20} color={t.text} />
              <Text style={[type.h2, { color: t.text }]}>Delivery address</Text>
            </View>
            <Pressable onPress={() => nav.navigate("AddressForm", { id: undefined })} hitSlop={6}>
              <Text style={[type.bodyStrong, { color: t.cta }]}>+ Add new</Text>
            </Pressable>
          </View>
          {addresses.length === 0 ? (
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, alignItems: "center" }]}>
              <Text style={[type.small, { color: t.textMuted, textAlign: "center" }]}>
                No saved addresses. Add one to continue.
              </Text>
              <Pressable
                onPress={() => nav.navigate("AddressForm", { id: undefined })}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { borderColor: t.cta, opacity: pressed ? 0.8 : 1, marginTop: 12 },
                ]}
              >
                <Text style={{ color: t.cta, fontWeight: "700" }}>Add address</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {addresses.map((a) => {
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
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: t.text }]}>{a.label || "Address"}</Text>
                        <Text style={[type.small, { color: t.text, marginTop: 4 }]} numberOfLines={2}>
                          {a.formattedAddress}
                        </Text>
                        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                          {[a.city, a.region, a.country].filter(Boolean).join(", ")}
                        </Text>
                      </View>
                      {a.isDefault ? (
                        <View style={[styles.tag, { backgroundColor: t.success.bg }]}>
                          <Text style={{ color: t.success.fg, fontSize: 10, fontWeight: "700" }}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Shopping list */}
        <View>
          <View style={[styles.sectionTitle, { marginBottom: 10 }]}>
            <Ionicons name="bag-handle-outline" size={20} color={t.text} />
            <Text style={[type.h2, { color: t.text }]}>Shopping list</Text>
          </View>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 10 }]}>
            {items.map((ci) => {
              const eff = ci.product.salePrice ?? ci.product.price;
              return (
                <View key={ci.id} style={styles.lineItem}>
                  <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={1}>
                    {ci.product.name} × {ci.quantity}
                  </Text>
                  <Text style={[type.bodyStrong, { color: t.text }]}>
                    {fmt(eff * ci.quantity)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Delivery options — same flow as the web's checkout. We fetch
            per-seller Shipbubble rates as soon as the buyer picks an
            address, and require one pick per seller before paying. */}
        <View>
          <View style={[styles.sectionTitle, { marginBottom: 10 }]}>
            <Ionicons name="bicycle-outline" size={20} color={t.text} />
            <Text style={[type.h2, { color: t.text }]}>Delivery options</Text>
          </View>
          <View style={{ gap: 10 }}>
            {sellers.map((s) => {
              const rs = ratesBySeller[s.id];
              const err = errorBySeller[s.id];
              const sel = selectedBySeller[s.id] ?? null;
              const sellerLabel = s.businessName?.trim() || s.name?.trim() || "Seller";
              return (
                <View key={s.id} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
                  <Text style={[type.bodyStrong, { color: t.text }]}>{sellerLabel}</Text>
                  {!selectedAddr ? (
                    <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
                      Pick a delivery address above to see shipping options.
                    </Text>
                  ) : rs === null || rs === undefined ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <ActivityIndicator size="small" color={t.cta} />
                      <Text style={[type.small, { color: t.textMuted }]}>Loading shipping options…</Text>
                    </View>
                  ) : err ? (
                    <Text style={[type.small, { color: t.danger.fg, marginTop: 6 }]}>{err}</Text>
                  ) : rs.length === 0 ? (
                    <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
                      No couriers available for this route right now.
                    </Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {rs.map((r) => {
                        const selected = sel === r.id;
                        return (
                          <Pressable
                            key={r.id}
                            onPress={() =>
                              setSelectedBySeller((p) => ({ ...p, [s.id]: r.id }))
                            }
                            style={[
                              styles.rateRow,
                              {
                                backgroundColor: selected ? t.accentSoft : t.bg,
                                borderColor: selected ? t.cta : t.border,
                                borderWidth: selected ? 2 : 1,
                              },
                            ]}
                          >
                            <Ionicons
                              name={selected ? "radio-button-on" : "radio-button-off"}
                              size={20}
                              color={selected ? t.cta : t.textMuted}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                                {r.name}
                              </Text>
                              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                                {typeof r.estimatedDays === "number" ? `~${r.estimatedDays} day${r.estimatedDays === 1 ? "" : "s"}` : "ETA n/a"}
                              </Text>
                            </View>
                            <Text style={[type.bodyStrong, { color: t.text }]}>
                              {fmt(r.price / 100)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Promo code */}
        <View>
          <View style={[styles.sectionTitle, { marginBottom: 10 }]}>
            <Ionicons name="ticket-outline" size={20} color={t.text} />
            <Text style={[type.h2, { color: t.text }]}>Promo code</Text>
          </View>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            {promoApplied ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={[type.bodyStrong, { color: t.success.fg }]}>
                    {promoApplied.code} applied
                  </Text>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                    Saving {fmt(promoApplied.discountCents / 100)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setPromoApplied(null);
                    setPromoCode("");
                  }}
                >
                  <Text style={[type.bodyStrong, { color: t.danger.fg }]}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={promoCode}
                      onChangeText={(v) => setPromoCode(v.toUpperCase())}
                      placeholder="Got a code? Enter it here"
                      autoCapitalize="characters"
                    />
                  </View>
                  <Pressable
                    onPress={applyPromo}
                    disabled={validating || !promoCode.trim()}
                    style={({ pressed }) => [
                      styles.applyBtn,
                      { backgroundColor: t.cta, opacity: validating || !promoCode.trim() ? 0.55 : pressed ? 0.9 : 1 },
                    ]}
                  >
                    <Text style={{ color: t.ctaText, fontWeight: "700" }}>
                      {validating ? "..." : "Apply"}
                    </Text>
                  </Pressable>
                </View>
                {promoErr ? (
                  <Text style={[type.small, { color: t.danger.fg, marginTop: 8 }]}>{promoErr}</Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* Order totals */}
        <View>
          <Text style={[type.h2, { color: t.text, marginBottom: 10 }]}>Order total</Text>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 6 }]}>
            <SummaryRow label="Subtotal" value={fmt(subtotal)} t={t} />
            <SummaryRow
              label="Delivery"
              value={
                allSellersPicked && sellers.length > 0
                  ? fmt(deliveryFee)
                  : selectedAddr
                    ? "Pick a courier above"
                    : "Pick an address first"
              }
              t={t}
            />
            {discount > 0 ? (
              <SummaryRow label={`Promo (${promoApplied?.code})`} value={`-${fmt(discount)}`} t={t} valueColor={t.success.fg} />
            ) : null}
            <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
            <SummaryRow label="Total" value={fmt(total)} t={t} bold />
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Continue bar */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: t.bgElevated,
            borderTopColor: t.border,
            bottom: FAB_CLEARANCE - 36,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.small, { color: t.textMuted }]}>Total</Text>
          <Text style={[type.h2, { color: t.text }]}>{fmt(total)}</Text>
        </View>
        <Pressable
          onPress={pay}
          disabled={paying || items.length === 0 || !selectedAddressId || (sellers.length > 0 && !allSellersPicked)}
          style={({ pressed }) => [
            styles.continueBtn,
            {
              backgroundColor: t.cta,
              opacity:
                paying || items.length === 0 || !selectedAddressId || (sellers.length > 0 && !allSellersPicked)
                  ? 0.5
                  : pressed
                    ? 0.9
                    : 1,
            },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "700", fontSize: 16 }}>
            {paying ? "Starting…" : "Pay & place orders"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  t,
  bold,
  muted,
  valueColor,
}: {
  label: string;
  value: string;
  t: ReturnType<typeof useTheme>;
  bold?: boolean;
  muted?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[bold ? type.bodyStrong : type.body, { color: muted ? t.textMuted : t.textMuted }]}>{label}</Text>
      <Text style={[bold ? type.h2 : type.bodyStrong, { color: valueColor ?? t.text }]}>{value}</Text>
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  outlineBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  applyBtn: {
    paddingHorizontal: 18,
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 8,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  dividerLine: { height: 1, marginVertical: 6 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueBtn: {
    paddingHorizontal: 28,
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
