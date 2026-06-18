import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

type Payout = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
};

type Resp = {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  payouts: Payout[];
};

function statusColors(t: ReturnType<typeof useTheme>, status: string) {
  switch (status.toUpperCase()) {
    case "PAID":
      return { fg: t.success.fg, bg: t.success.bg };
    case "PENDING":
      return { fg: t.warning.fg, bg: t.warning.bg };
    case "FAILED":
    case "REJECTED":
      return { fg: t.danger.fg, bg: t.danger.bg };
    default:
      return { fg: t.accent, bg: t.accentSoft };
  }
}

export function SellerPayoutsScreen() {
  const t = useTheme();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get<Resp>("/api/seller/payouts");
      setData(d);
    } catch (err) {
      if (isNotFound(err)) {
        setData({ availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0, payouts: [] });
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
    Alert.alert(
      "Request payout?",
      `We'll transfer ₦${Math.round(data.availableBalance).toLocaleString("en-NG")} to your saved payout method.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            setRequesting(true);
            try {
              await api.post("/api/seller/payouts/request", {});
              Alert.alert("Requested", "We'll send a confirmation once the transfer clears.");
              await load();
            } catch (err) {
              Alert.alert("Couldn't request", err instanceof Error ? err.message : "Try again.");
            } finally {
              setRequesting(false);
            }
          },
        },
      ],
    );
  }

  const balanceHeader = (
    <View style={{ marginBottom: 6 }}>
      <View style={[styles.heroCard, { backgroundColor: t.cta }]}>
        <Text style={[type.micro, { color: t.ctaText, opacity: 0.8 }]}>AVAILABLE TO WITHDRAW</Text>
        <Text style={[styles.heroAmount, { color: t.ctaText }]}>
          ₦{Math.round(data?.availableBalance ?? 0).toLocaleString("en-NG")}
        </Text>
        <Pressable
          onPress={requestPayout}
          disabled={requesting || !data || data.availableBalance <= 0}
          style={({ pressed }) => [
            styles.heroBtn,
            {
              backgroundColor: "rgba(255,255,255,0.18)",
              opacity: requesting || !data || data.availableBalance <= 0 ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="cash-outline" size={18} color={t.ctaText} />
          <Text style={{ color: t.ctaText, fontWeight: "800", marginLeft: 8 }}>
            {requesting ? "Requesting…" : "Request payout"}
          </Text>
        </Pressable>
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

      <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>History</Text>
    </View>
  );

  return (
    <ListScaffold<Payout>
      title="Payouts"
      data={data?.payouts ?? []}
      keyExtractor={(p) => p.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      ListHeader={balanceHeader}
      emptyIcon="time-outline"
      emptyTitle="No payouts yet"
      emptyMessage="When you withdraw, the history will show here."
      renderItem={({ item }) => {
        const sc = statusColors(t, item.status);
        return (
          <View style={[styles.payRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.payIcon, { backgroundColor: sc.bg }]}>
              <Ionicons name="cash-outline" size={18} color={sc.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>
                ₦{Math.round(item.amount).toLocaleString("en-NG")}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                {new Date(item.createdAt).toLocaleDateString("en-NG", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {item.method ? ` · ${item.method}` : ""}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
              <Text style={{ color: sc.fg, fontSize: 11, fontWeight: "800" }}>{item.status}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 20, borderRadius: radius.lg },
  heroAmount: { fontSize: 32, fontWeight: "800", marginTop: 8 },
  heroBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  miniRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  miniCard: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  payIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
