import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

// Paid product promotion — the same flow as the web PromoteButton:
// POST /api/promotions { kind: "product", id } creates the request and
// returns a payment link (₦500 for 3 days). After payment an admin reviews
// it, then the product is boosted on the storefront.
type Row = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  status: string;
  imagesJson?: string;
  promotionState: "LIVE" | "REVIEW" | "PAYMENT" | null;
};

function firstImage(p: Row): string | null {
  try {
    const arr = JSON.parse(p.imagesJson ?? "[]");
    return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : null;
  } catch {
    return null;
  }
}

export function SellerPromotionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ products: Row[] }>("/api/products", { mine: 1 });
      setItems((data.products ?? []).filter((p) => p.status === "ACTIVE"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function promote(p: Row) {
    setBusyId(p.id);
    try {
      const r = await api.post<{ checkoutUrl?: string; feeNgn?: number; durationDays?: number; stub?: boolean }>(
        "/api/promotions",
        { kind: "product", id: p.id },
      );
      if (r.checkoutUrl && !r.stub) {
        await WebBrowser.openBrowserAsync(r.checkoutUrl);
      } else {
        Alert.alert("Sent for review", "We'll review your promotion and boost it once approved.");
      }
      await load();
    } catch (err) {
      Alert.alert("Couldn't start promotion", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <View style={[styles.info, { backgroundColor: t.accentSoft }]}>
      <Ionicons name="megaphone-outline" size={20} color={t.accent} />
      <Text style={[type.body, { color: t.text, flex: 1 }]}>
        Boost a product for 3 days for ₦500. It's reviewed first, then shown higher in the featured rails.
      </Text>
    </View>
  );

  return (
    <ListScaffold<Row>
      title="Promotions"
      data={items}
      keyExtractor={(p) => p.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      ListHeader={header}
      emptyIcon="megaphone-outline"
      emptyTitle="No active products"
      emptyMessage="List a product first, then promote it from here."
      renderItem={({ item }) => {
        const img = firstImage(item);
        const label =
          item.promotionState === "LIVE"
            ? "Promoted"
            : item.promotionState === "REVIEW"
              ? "In review"
              : item.promotionState === "PAYMENT"
                ? "Awaiting payment"
                : null;
        return (
          <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.bg }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                ₦{Math.round(item.salePrice ?? item.price).toLocaleString("en-NG")}
              </Text>
            </View>
            {label ? (
              <View style={[styles.chip, { backgroundColor: item.promotionState === "LIVE" ? t.success.bg : t.warning.bg }]}>
                <Text style={{ color: item.promotionState === "LIVE" ? t.success.fg : t.warning.fg, fontSize: 11, fontWeight: "800" }}>
                  {label}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => promote(item)}
                disabled={busyId === item.id}
                style={[styles.btn, { backgroundColor: t.cta, opacity: busyId === item.id ? 0.6 : 1 }]}
              >
                <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 13 }}>
                  {busyId === item.id ? "…" : "Promote"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  info: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: radius.md, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  btn: { paddingHorizontal: 16, minHeight: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
