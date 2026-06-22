import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { API_URL, api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

// /api/wallet shape — see src/app/api/wallet/route.ts.
type WalletTransaction = {
  id: string;
  type: string;
  amountCents: number;
  status: string;
  description: string | null;
  createdAt: string;
};

type WalletResp = {
  balanceCents: number;
  availableCents: number;
  heldCents: number;
  pendingWithdrawalsCents: number;
  currencyCode: string;
  transactions: WalletTransaction[];
};

type Resp = {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  heldBalance: number;
  transactions: WalletTransaction[];
};

function txColors(t: ReturnType<typeof useTheme>, type: string, amountCents: number) {
  const isOutflow = type === "WITHDRAWAL" || type === "REFUND" || amountCents < 0;
  if (isOutflow) {
    return { fg: t.danger.fg, bg: t.danger.bg, icon: "arrow-down-outline" as const, sign: "−" };
  }
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
      // /api/wallet is the same source the web wallet pages read.
      // Maps balanceCents (NGN kobo) into NGN for display.
      const w = await api.get<WalletResp>("/api/wallet");
      // "Lifetime earnings" is the sum of all positive credit
      // transactions (sales, etc.) — derived from the transactions
      // list since the wallet endpoint doesn't ship a separate field.
      const lifetimeCents = (w.transactions ?? [])
        .filter((tx) => tx.amountCents > 0 && tx.status === "PAID")
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      setData({
        availableBalance: (w.availableCents ?? 0) / 100,
        pendingBalance: (w.pendingWithdrawalsCents ?? 0) / 100,
        heldBalance: (w.heldCents ?? 0) / 100,
        lifetimeEarnings: lifetimeCents / 100,
        transactions: w.transactions ?? [],
      });
    } catch (err) {
      if (isNotFound(err)) {
        setData({ availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0, heldBalance: 0, transactions: [] });
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
    // POST /api/wallet/payout requires bank details (bankCode,
    // accountNumber, accountName, amountCents). The bank-picker
    // form lives on the web; route the user there until the mobile
    // payout form is built, mirroring the rest of the app's
    // "advanced settings live on the web" pattern.
    setRequesting(true);
    try {
      const url = `${API_URL.replace(/\/$/, "")}/designer/wallet`;
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Open in browser",
        "Withdrawals are processed on the web — open designer/wallet in your browser.",
      );
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
            ₦{Math.round(data?.heldBalance ?? 0).toLocaleString("en-NG")} held in escrow
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
              {requesting ? "Opening…" : "Withdraw"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.miniRow}>
        <View style={[styles.miniCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.small, { color: t.textMuted }]}>Pending payout</Text>
          <Text style={[type.h2, { color: t.text, marginTop: 4 }]}>
            ₦{Math.round(data?.pendingBalance ?? 0).toLocaleString("en-NG")}
          </Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.small, { color: t.textMuted }]}>Lifetime earnings</Text>
          <Text style={[type.h2, { color: t.text, marginTop: 4 }]}>
            ₦{Math.round(data?.lifetimeEarnings ?? 0).toLocaleString("en-NG")}
          </Text>
        </View>
      </View>

      <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>Transactions</Text>
    </View>
  );

  return (
    <ListScaffold<WalletTransaction>
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
        const c = txColors(t, item.type, item.amountCents);
        const label =
          item.type === "WITHDRAWAL"
            ? "Withdrawal"
            : item.type === "REFUND"
              ? "Refund"
              : item.type === "WITHDRAWAL_FEE"
                ? "Withdrawal fee"
                : item.description ?? "Sale";
        const ngn = Math.abs(item.amountCents) / 100;
        return (
          <View style={[styles.txRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.txIcon, { backgroundColor: c.bg }]}>
              <Ionicons name={c.icon} size={18} color={c.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{label}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                {item.status === "PENDING" ? " · pending" : ""}
              </Text>
            </View>
            <Text style={[type.bodyStrong, { color: c.fg }]}>
              {c.sign}₦{Math.round(ngn).toLocaleString("en-NG")}
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
