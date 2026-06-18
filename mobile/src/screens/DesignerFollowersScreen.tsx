import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

type Follower = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  followedAt: string;
};

type Resp = {
  total: number;
  growthThisWeek: number;
  followers: Follower[];
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
      const d = await api.get<Resp>("/api/designer/followers");
      setData(d);
    } catch (err) {
      if (isNotFound(err)) setData({ total: 0, growthThisWeek: 0, followers: [] });
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
    <ListScaffold<Follower>
      title="Followers"
      data={data?.followers ?? []}
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
        const initial = (item.name?.[0] ?? "?").toUpperCase();
        return (
          <View style={[styles.row, { borderBottomColor: t.border }]}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 18 }}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{item.name}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{item.email}</Text>
            </View>
            <Text style={[type.small, { color: t.textMuted }]}>
              {new Date(item.followedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
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
