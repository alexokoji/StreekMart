import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

type Transaction = {
  id: string;
  amount: number;
  kind: string;
  source: string | null;
  status: string;
  createdAt: string;
};

type Resp = {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  thisMonth: number;
  transactions: Transaction[];
};

function txColors(t: ReturnType<typeof useTheme>, kind: string) {
  if (kind === "PAYOUT") return { fg: t.danger.fg, bg: t.danger.bg, icon: "arrow-down-outline" as const, sign: "−" };
  if (kind === "REFUND") return { fg: t.danger.fg, bg: t.danger.bg, icon: "return-down-back-outline" as const, sign: "−" };
  return { fg: t.success.fg, bg: t.success.bg, icon: "arrow-up-outline" as const, sign: "+" };
}

export function DesignerEarningsScreen() {
  const t = useTheme();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get<Resp>("/api/designer/earnings");
      setData(d);
    } catch (err) {
      if (isNotFound(err)) {
        setData({ availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0, thisMonth: 0, transactions: [] });
      } else {
        setError(err instanceof Error ? err.message : "Try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function requestPayout() {
    if (!data || data.availableBalance <= 0) {
      Alert.alert("Nothing to withdraw", "Your available balance is zero.");
      return;
    }
    setRequesting(true);
    try {
      await api.post("/api/designer/earnings/withdraw", {});
      Alert.alert("Requested", "Payout queued — you'll get a confirmation shortly.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't request", err instanceof Error ? err.message : "Try again.");
    } finally {
      setRequesting(false);
    }
  }

  const header = (
    <View style={{ marginBottom: 6 }}>
      <View style={[styles.heroCard, { backgroundColor: t.promo }]}>
        <Text style={[type.micro, { color: t.ctaText, opacity: 0.85 }]}>AVAILABLE</Text>
        <Text style={[styles.heroAmount, { color: t.ctaText }]}>
          ₦{Math.round(data?.availableBalance ?? 0).toLocaleString("en-NG")}
        </Text>
        <View style={styles.heroSubRow}>
          <Text style={[type.small, { color: t.ctaText, opacity: 0.85 }]}>
            ₦{Math.round(data?.thisMonth ?? 0).toLocaleString("en-NG")} this month
          </Text>
          <Pressable
            onPress={requestPayout}
            disabled={requesting || !data || data.availableBalance <= 0}
            style={({ pressed }) => [
              styles.withdrawBtn,
              {
                backgroundColor: "rgba(255,255,255,0.22)",
                opacity: requesting || !data || data.availableBalance <= 0 ? 0.55 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "800" }}>
              {requesting ? "Requesting…" : "Withdraw"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.miniRow}>
        <View style={[styles.miniCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.small, { color: t.textMuted }]}>Pending</Text>
          <Text style={[type.h2, { color: t.text, marginTop: 4 }]}>
            ₦{Math.round(data?.pendingBalance ?? 0).toLocaleString("en-NG")}
          </Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.small, { color: t.textMuted }]}>Lifetime</Text>
          <Text style={[type.h2, { color: t.text, marginTop: 4 }]}>
            ₦{Math.round(data?.lifetimeEarnings ?? 0).toLocaleString("en-NG")}
          </Text>
        </View>
      </View>

      <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>Transactions</Text>
    </View>
  );

  return (
    <ListScaffold<Transaction>
      title="Earnings"
      data={data?.transactions ?? []}
      keyExtractor={(tx) => tx.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      ListHeader={header}
      emptyIcon="cash-outline"
      emptyTitle="No transactions"
      emptyMessage="Sales and withdrawals will list here."
      renderItem={({ item }) => {
        const c = txColors(t, item.kind);
        return (
          <View style={[styles.txRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.txIcon, { backgroundColor: c.bg }]}>
              <Ionicons name={c.icon} size={18} color={c.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>
                {item.kind === "PAYOUT" ? "Payout" : item.kind === "REFUND" ? "Refund" : item.source ?? "Sale"}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
            <Text style={[type.bodyStrong, { color: c.fg }]}>
              {c.sign}₦{Math.round(item.amount).toLocaleString("en-NG")}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 20, borderRadius: radius.lg },
  heroAmount: { fontSize: 32, fontWeight: "800", marginTop: 8 },
  heroSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  withdrawBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  miniRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  miniCard: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
