import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

// /api/follows?role=followers shape — see src/app/api/follows/route.ts.
type FollowRow = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    businessName: string | null;
    avatarUrl: string | null;
  };
};

type Resp = {
  total: number;
  growthThisWeek: number;
  follows: FollowRow[];
};

export function DesignerFollowersScreen() {
  const t = useTheme();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Combine the two endpoints the web already exposes:
      //   /api/follows?role=followers → the actual list of accounts
      //   /api/dashboard/designer    → the windowed growth numbers
      const [list, dash] = await Promise.all([
        api.get<{ follows: FollowRow[] }>("/api/follows", { role: "followers" }).catch(() => ({ follows: [] })),
        api
          .get<{ stats: { newFollowersThisWeek: number } }>("/api/dashboard/designer")
          .catch(() => ({ stats: { newFollowersThisWeek: 0 } })),
      ]);
      setData({
        total: list.follows?.length ?? 0,
        growthThisWeek: dash.stats?.newFollowersThisWeek ?? 0,
        follows: list.follows ?? [],
      });
    } catch (err) {
      if (isNotFound(err)) setData({ total: 0, growthThisWeek: 0, follows: [] });
      else setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = data ? (
    <View style={[styles.summary, { backgroundColor: t.cta, marginBottom: 8 }]}>
      <View>
        <Text style={[type.micro, { color: t.ctaText, opacity: 0.85 }]}>FOLLOWERS</Text>
        <Text style={[styles.summaryBig, { color: t.ctaText }]}>
          {data.total.toLocaleString("en-NG")}
        </Text>
      </View>
      <View style={styles.growthChip}>
        <Ionicons
          name={data.growthThisWeek >= 0 ? "arrow-up" : "arrow-down"}
          size={14}
          color={t.ctaText}
        />
        <Text style={{ color: t.ctaText, fontWeight: "800", marginLeft: 4 }}>
          {Math.abs(data.growthThisWeek)} this week
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <ListScaffold<FollowRow>
      title="Followers"
      data={data?.follows ?? []}
      keyExtractor={(f) => f.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      ListHeader={header}
      emptyIcon="people-outline"
      emptyTitle="No followers yet"
      emptyMessage="When buyers follow your work, they'll appear here."
      renderItem={({ item }) => {
        const display = item.user.businessName?.trim() || item.user.name;
        const initial = (display?.[0] ?? "?").toUpperCase();
        return (
          <View style={[styles.row, { borderBottomColor: t.border }]}>
            {item.user.avatarUrl ? (
              <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 18 }}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{display}</Text>
            </View>
            <Text style={[type.small, { color: t.textMuted }]}>
              {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: radius.lg,
  },
  summaryBig: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  growthChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
