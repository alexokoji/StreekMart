import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

type Resp = {
  stats: {
    userCount: number;
    sellerCount: number;
    designerCount: number;
    productCount: number;
    activeProducts: number;
    activeOrders: number;
    completedOrders: number;
    salesLast30dCents: number;
  };
  queues: {
    pendingVerifications: number;
    pendingPayouts: number;
    pendingPromotions: number;
    pendingRoleChanges: number;
    pendingBusinessNames: number;
  };
};

export function AdminDashboardScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.get<Resp>("/api/dashboard/admin");
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.isAdmin) {
    return (
      <Screen>
        <Text style={[type.h2, { color: t.text }]}>Admin dashboard</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>
          You need admin permissions to see this dashboard.
        </Text>
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

  const s = data?.stats;
  const q = data?.queues;
  const totalPending = q
    ? q.pendingVerifications + q.pendingPayouts + q.pendingPromotions + q.pendingRoleChanges + q.pendingBusinessNames
    : 0;

  return (
    <Screen padding={false}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={[type.h1, { color: t.text }]}>Admin</Text>
        <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
          {totalPending > 0 ? `${totalPending} item${totalPending === 1 ? "" : "s"} need attention` : "All caught up"}
        </Text>

        <Text style={[type.h2, { color: t.text, marginTop: 24 }]}>People & catalog</Text>
        <View style={styles.kpiGrid}>
          <Kpi label="Users" value={s?.userCount ?? 0} sub={`${s?.sellerCount ?? 0} sellers / ${s?.designerCount ?? 0} designers`} />
          <Kpi label="Products" value={s?.productCount ?? 0} sub={`${s?.activeProducts ?? 0} active`} />
        </View>

        <Text style={[type.h2, { color: t.text, marginTop: 24 }]}>Money</Text>
        <View style={styles.kpiGrid}>
          <Kpi label="Active orders" value={s?.activeOrders ?? 0} />
          <Kpi label="Completed orders" value={s?.completedOrders ?? 0} />
          <Kpi
            label="Sales (30d)"
            value={Math.round((s?.salesLast30dCents ?? 0) / 100)}
            sub="NGN"
          />
        </View>

        <Text style={[type.h2, { color: t.text, marginTop: 24 }]}>Triage queues</Text>
        <View style={[styles.queueCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <QueueRow label="Verifications" count={q?.pendingVerifications ?? 0} />
          <QueueRow label="Payouts" count={q?.pendingPayouts ?? 0} />
          <QueueRow label="Promotions" count={q?.pendingPromotions ?? 0} />
          <QueueRow label="Role changes" count={q?.pendingRoleChanges ?? 0} />
          <QueueRow label="Business name changes" count={q?.pendingBusinessNames ?? 0} />
        </View>

        <Text style={[type.small, { color: t.textMuted, marginTop: 16, textAlign: "center" }]}>
          For full review actions, open the site at streekmart.online/admin.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[type.micro, { color: t.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.h1, { color: t.text, marginTop: 2 }]}>{value.toLocaleString()}</Text>
      {sub && <Text style={[type.small, { color: t.textMuted }]}>{sub}</Text>}
    </View>
  );
}

function QueueRow({ label, count }: { label: string; count: number }) {
  const t = useTheme();
  return (
    <View style={styles.queueRow}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <View style={[styles.countPill, { backgroundColor: count > 0 ? t.warning.bg : t.bg }]}>
        <Text style={[type.bodyStrong, { color: count > 0 ? t.warning.fg : t.textMuted }]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  kpi: { width: "48%", flexGrow: 1, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  queueCard: { marginTop: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  queueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  countPill: { minWidth: 36, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignItems: "center" },
});