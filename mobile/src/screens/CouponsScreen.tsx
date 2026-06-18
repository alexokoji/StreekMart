import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BackHeader } from "../components/BackHeader";
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
  if (c.kind === "FLAT") return `₦${Math.round(c.value / 100).toLocaleString("en-NG")}`;
  if (c.kind === "PERCENT") return `${(c.value / 100).toFixed(0)}%`;
  return "—";
}

function discountSub(c: Coupon): string {
  if (c.kind === "FLAT") return "off your order";
  if (c.kind === "PERCENT") return "off your order";
  return "discount";
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
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Coupons" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to claim coupons and save on checkout.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 16 },
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
        <BackHeader title="Coupons" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  type Section =
    | { kind: "header"; title: string }
    | { kind: "available"; coupon: Coupon }
    | { kind: "mine"; coupon: Coupon }
    | { kind: "empty"; text: string };
  const sections: Section[] = [
    { kind: "header", title: "Available to claim" },
    ...(available.length === 0
      ? ([{ kind: "empty", text: "Nothing new right now — check back soon." }] as Section[])
      : available.map((c): Section => ({ kind: "available", coupon: c }))),
    { kind: "header", title: "My coupons" },
    ...(mine.length === 0
      ? ([{ kind: "empty", text: "You haven't claimed any coupons yet." }] as Section[])
      : mine.map((c): Section => ({ kind: "mine", coupon: c }))),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Coupons" />
      <FlatList
        data={sections}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <Text style={[type.small, { color: t.textMuted, marginBottom: 4 }]}>
            Claim a coupon and copy its code at checkout to apply.
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => {
          if (item.kind === "header") {
            return (
              <Text style={[type.h2, { color: t.text, marginTop: 14, marginBottom: 4 }]}>
                {item.title}
              </Text>
            );
          }
          if (item.kind === "empty") {
            return (
              <View style={[styles.emptyCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[type.small, { color: t.textMuted, textAlign: "center" }]}>{item.text}</Text>
              </View>
            );
          }
          const c = item.coupon;
          const isMine = item.kind === "mine";
          const accent = isMine ? t.cta : t.promo;
          return (
            <View style={[styles.ticket, { opacity: busy === c.id ? 0.6 : 1 }]}>
              <View style={[styles.stub, { backgroundColor: accent }]}>
                <Text style={[styles.stubBig, { color: t.ctaText }]}>{discountLabel(c)}</Text>
                <Text style={[type.micro, { color: t.ctaText, opacity: 0.85, marginTop: 4, textAlign: "center" }]}>
                  {discountSub(c)}
                </Text>
              </View>
              <View style={styles.notchTop} />
              <View style={styles.notchBottom} />
              <View style={[styles.body, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>
                    {c.description ?? (isMine ? "Apply at checkout" : "Limited offer")}
                  </Text>
                  {isMine ? (
                    <View style={[styles.codeChip, { borderColor: accent }]}>
                      <Text style={[styles.codeText, { color: accent }]}>{c.code}</Text>
                    </View>
                  ) : null}
                  {c.endsAt ? (
                    <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
                      Ends {new Date(c.endsAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                    </Text>
                  ) : null}
                </View>
                {isMine ? (
                  <Pressable
                    onPress={() => copyCode(c.code)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: t.bgElevated, borderColor: t.border, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={{ color: t.text, fontWeight: "700" }}>Copy</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => claim(c)}
                    disabled={busy === c.id}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: t.cta, borderColor: t.cta, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={{ color: t.ctaText, fontWeight: "700" }}>Claim</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  pill: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.pill },
  emptyCard: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  ticket: {
    flexDirection: "row",
    minHeight: 96,
  },
  stub: {
    width: 100,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  stubBig: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  notchTop: {
    position: "absolute",
    left: 92,
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  notchBottom: {
    position: "absolute",
    left: 92,
    bottom: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
  },
  codeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 8,
  },
  codeText: { fontWeight: "800", letterSpacing: 1.5, fontFamily: "monospace" },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
