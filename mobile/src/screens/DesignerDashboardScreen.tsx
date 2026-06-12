import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Resp = {
  stats: {
    postCount: number;
    productCount: number;
    activeProducts: number;
    totalViews: number;
    totalLikes: number;
    totalSaves: number;
    totalComments: number;
    engagementRate: number;
    newFollowersThisWeek: number;
    newFollowersPrevWeek: number;
    growthPercent: number | null;
    activeCommissions: number;
    activePreorders: number;
  };
  recentPosts: Array<{
    id: string;
    title: string;
    likeCount: number;
    viewCount: number;
    saveCount: number;
    image: string | null;
    createdAt: string;
  }>;
};

export function DesignerDashboardScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.isDesigner) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.get<Resp>("/api/dashboard/designer");
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.isDesigner) {
    return (
      <Screen>
        <Text style={[type.h2, { color: t.text }]}>Designer dashboard</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>
          You need designer permissions to see this dashboard.
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

  return (
    <Screen padding={false}>
      <FlatList
        data={data?.recentPosts ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[type.h1, { color: t.text }]}>Designer</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Welcome back, {user.name.split(" ")[0]}
            </Text>

            <View style={styles.kpiGrid}>
              <Kpi label="Posts" value={s?.postCount ?? 0} />
              <Kpi label="Products" value={s?.productCount ?? 0} sub={`${s?.activeProducts ?? 0} active`} />
              <Kpi label="Views" value={s?.totalViews ?? 0} />
              <Kpi label="Likes" value={s?.totalLikes ?? 0} />
            </View>

            <View style={[styles.engageCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[type.micro, { color: t.textMuted }]}>ENGAGEMENT</Text>
              <Text style={[type.display, { color: t.cta, marginTop: 4 }]}>
                {s?.engagementRate ?? 0}%
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                {(s?.totalLikes ?? 0) + (s?.totalSaves ?? 0) + (s?.totalComments ?? 0)} actions on {s?.totalViews ?? 0} views
              </Text>
              <View style={styles.engageBottomRow}>
                <View>
                  <Text style={[type.small, { color: t.textMuted }]}>New followers (7d)</Text>
                  <Text style={[type.h2, { color: t.text }]}>{s?.newFollowersThisWeek ?? 0}</Text>
                </View>
                {s?.growthPercent != null && (
                  <Text style={[type.bodyStrong, { color: s.growthPercent >= 0 ? t.success.fg : t.danger.fg }]}>
                    {s.growthPercent >= 0 ? "+" : ""}{Math.round(s.growthPercent)}%
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.kpiGrid}>
              <Kpi label="Active commissions" value={s?.activeCommissions ?? 0} />
              <Kpi label="Active preorders" value={s?.activePreorders ?? 0} />
            </View>

            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 8 }]}>Recent posts</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>No posts yet.</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                {item.likeCount} likes · {item.saveCount} saves · {item.viewCount} views
              </Text>
            </View>
          </Pressable>
        )}
      />
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 24, alignItems: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  kpi: { width: "48%", flexGrow: 1, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  engageCard: { marginTop: 16, padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  engageBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});