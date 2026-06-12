import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Coupon = {
  id: string;
  code: string;
  kind: string;
  value: number;
  maxDiscountCents: number | null;
  minSubtotalCents: number | null;
  endsAt: string | null;
  description: string | null;
  claimedAt?: string;
};

function discountLabel(c: Coupon): string {
  if (c.kind === "FLAT") return `NGN ${Math.round(c.value / 100).toLocaleString("en-NG")} off`;
  if (c.kind === "PERCENT") return `${(c.value / 100).toFixed(0)}% off`;
  return "Discount";
}

export function CouponsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [available, setAvailable] = useState<Coupon[]>([]);
  const [mine, setMine] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ available: Coupon[]; mine: Coupon[] }>("/api/coupons");
      setAvailable(data.available ?? []);
      setMine(data.mine ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function claim(c: Coupon) {
    setBusy(c.id);
    try {
      const r = await api.post<{ ok: boolean; alreadyClaimed?: boolean }>(`/api/coupons/${encodeURIComponent(c.code)}/claim`);
      if (r.ok) {
        setAvailable((cur) => cur.filter((x) => x.id !== c.id));
        setMine((cur) => [{ ...c, claimedAt: new Date().toISOString() }, ...cur]);
      }
    } catch (err) {
      Alert.alert("Couldn't claim", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", `${code} copied to clipboard.`);
  }

  if (!user) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to collect coupons.</Text>
        <Button label="Sign in" style={{ marginTop: 12 }} onPress={() => nav.navigate("Login")} />
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

  type Section = { kind: "header"; title: string } | { kind: "available"; coupon: Coupon } | { kind: "mine"; coupon: Coupon } | { kind: "empty"; text: string };
  const sections: Section[] = [
    { kind: "header", title: "Available to claim" },
    ...(available.length === 0
      ? ([{ kind: "empty", text: "Nothing to claim right now - check back soon." }] as Section[])
      : available.map((c): Section => ({ kind: "available", coupon: c }))),
    { kind: "header", title: "My coupons" },
    ...(mine.length === 0
      ? ([{ kind: "empty", text: "You haven't saved any coupons yet." }] as Section[])
      : mine.map((c): Section => ({ kind: "mine", coupon: c }))),
  ];

  return (
    <Screen padding={false}>
      <FlatList
        data={sections}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={[type.h1, { color: t.text }]}>Coupons</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Save coupons here, copy the code at checkout.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => {
          if (item.kind === "header") {
            return (
              <Text style={[type.h2, { color: t.text, marginTop: 12, marginBottom: 4 }]}>
                {item.title}
              </Text>
            );
          }
          if (item.kind === "empty") {
            return (
              <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[type.small, { color: t.textMuted, textAlign: "center" }]}>{item.text}</Text>
              </View>
            );
          }
          const c = item.coupon;
          return (
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: busy === c.id ? 0.6 : 1 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]}>{discountLabel(c)}</Text>
                  {item.kind === "mine" && (
                    <Text style={[type.bodyStrong, { color: t.accent, marginTop: 4, fontFamily: "monospace" }]}>{c.code}</Text>
                  )}
                  {c.description && (
                    <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{c.description}</Text>
                  )}
                  {c.endsAt && (
                    <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                      Ends {new Date(c.endsAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                    </Text>
                  )}
                </View>
                {item.kind === "available" ? (
                  <Pressable onPress={() => claim(c)} disabled={busy === c.id} style={[styles.actionBtn, { backgroundColor: t.cta }]}>
                    <Text style={{ color: t.ctaText, fontWeight: "700" }}>Claim</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => copyCode(c.code)} style={[styles.actionBtn, { backgroundColor: t.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
                    <Text style={{ color: t.text, fontWeight: "700" }}>Copy</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
});