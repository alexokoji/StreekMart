import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Method = {
  id: string;
  gateway: string;
  maskedPan: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
};

function brandColors(t: ReturnType<typeof useTheme>, brand: string | null) {
  const b = (brand ?? "").toLowerCase();
  if (b.includes("visa")) return { bg: t.cta, fg: t.ctaText };
  if (b.includes("master")) return { bg: t.promo, fg: t.ctaText };
  if (b.includes("verve")) return { bg: t.premium, fg: "#1b1b1b" };
  return { bg: t.text, fg: t.bg };
}

export function PaymentMethodsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ methods: Method[] }>("/api/payment-methods");
      setRows(data.methods ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setDefault(id: string) {
    setBusy(id);
    try {
      await api.patch(`/api/payment-methods/${id}`, { isDefault: true });
      setRows((r) => r.map((m) => ({ ...m, isDefault: m.id === id })));
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  function remove(id: string) {
    Alert.alert("Forget card?", "We won't be able to use this card without you re-entering it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Forget",
        style: "destructive",
        onPress: async () => {
          setBusy(id);
          try {
            await api.delete(`/api/payment-methods/${id}`);
            setRows((r) => r.filter((m) => m.id !== id));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Payment methods" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to manage saved cards.
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
        <BackHeader title="Payment methods" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Payment methods" />
      <FlatList
        data={rows}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        ListHeaderComponent={
          <Text style={[type.small, { color: t.textMuted, marginBottom: 4 }]}>
            Cards you saved at checkout. Tick "Save this card" next time you pay to add a new one.
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
              No saved cards yet. You can save one from the checkout screen.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => {
          const bc = brandColors(t, item.brand);
          const expired =
            item.expMonth && item.expYear
              ? new Date(item.expYear, item.expMonth, 1).getTime() < Date.now()
              : false;
          return (
            <View style={{ opacity: busy === item.id ? 0.6 : 1 }}>
              <View style={[styles.cardFace, { backgroundColor: bc.bg }]}>
                <View style={styles.cardTop}>
                  <Text style={[type.small, { color: bc.fg, opacity: 0.8 }]}>{item.gateway.toUpperCase()}</Text>
                  {item.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Text style={[type.micro, { color: bc.fg, fontWeight: "800" }]}>DEFAULT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.cardNumber, { color: bc.fg }]}>
                  {item.maskedPan ?? "•••• •••• •••• ••••"}
                </Text>
                <View style={styles.cardBottom}>
                  <View>
                    <Text style={[type.micro, { color: bc.fg, opacity: 0.7 }]}>EXPIRES</Text>
                    <Text style={[type.bodyStrong, { color: bc.fg, marginTop: 2 }]}>
                      {item.expMonth && item.expYear
                        ? `${String(item.expMonth).padStart(2, "0")}/${String(item.expYear).slice(-2)}`
                        : "--/--"}
                    </Text>
                  </View>
                  <Text style={[styles.brandLabel, { color: bc.fg }]}>{item.brand ?? "Card"}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                {expired ? (
                  <Text style={[type.small, { color: t.danger.fg, fontWeight: "700" }]}>Expired</Text>
                ) : !item.isDefault ? (
                  <Pressable onPress={() => setDefault(item.id)} disabled={busy === item.id}>
                    <Text style={[type.bodyStrong, { color: t.cta }]}>Set default</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable onPress={() => remove(item.id)} disabled={busy === item.id}>
                  <Text style={[type.bodyStrong, { color: t.danger.fg }]}>Forget card</Text>
                </Pressable>
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
  pill: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  cardFace: {
    height: 180,
    borderRadius: radius.lg,
    padding: 18,
    justifyContent: "space-between",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
  },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  brandLabel: { fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 10,
  },
});
