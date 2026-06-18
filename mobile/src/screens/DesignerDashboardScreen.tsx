import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { BackHeader } from "../components/BackHeader";
import { StatTile } from "../components/StatTile";
import { QuickAction } from "../components/QuickAction";
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
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Designer" />
        <View style={styles.empty}>
          <Text style={[type.h2, { color: t.text }]}>Designer dashboard</Text>
          <Text style={[type.body, { color: t.textMuted, marginTop: 8, textAlign: "center" }]}>
            You need designer permissions to see this dashboard.
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Designer" />
        <View style={styles.empty}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  const s = data?.stats;
  const totalActions =
    (s?.totalLikes ?? 0) + (s?.totalSaves ?? 0) + (s?.totalComments ?? 0);
  const positiveGrowth = (s?.growthPercent ?? 0) >= 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Designer" />
      <FlatList
        data={data?.recentPosts ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[styles.greeting, { color: t.text }]}>Hi, {user.name.split(" ")[0]}</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Your work this week at a glance.
            </Text>

            {/* Engagement spotlight */}
            <View style={[styles.engageCard, { backgroundColor: t.cta }]}>
              <Text style={[type.micro, { color: t.ctaText, opacity: 0.85 }]}>ENGAGEMENT</Text>
              <Text style={styles.engageBig}>{s?.engagementRate ?? 0}%</Text>
              <Text style={[type.small, { color: t.ctaText, opacity: 0.85 }]}>
                {totalActions.toLocaleString("en-NG")} actions on {(s?.totalViews ?? 0).toLocaleString("en-NG")} views
              </Text>
              <View style={styles.engageBottom}>
                <View>
                  <Text style={[type.small, { color: t.ctaText, opacity: 0.8 }]}>New followers (7d)</Text>
                  <Text style={[type.h1, { color: t.ctaText, marginTop: 2 }]}>
                    {s?.newFollowersThisWeek ?? 0}
                  </Text>
                </View>
                {s?.growthPercent != null ? (
                  <View
                    style={[
                      styles.growthBadge,
                      { backgroundColor: positiveGrowth ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.20)" },
                    ]}
                  >
                    <Text style={{ color: t.ctaText, fontWeight: "800" }}>
                      {positiveGrowth ? "▲" : "▼"} {Math.abs(s.growthPercent).toFixed(0)}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.tileGrid}>
              <StatTile glyph={<Ionicons name="create-outline" size={18} color={t.accent} />} tone="primary" label="Posts" value={s?.postCount ?? 0} />
              <StatTile glyph={<Ionicons name="bag-handle-outline" size={18} color={t.cta} />} tone="info" label="Products" value={s?.productCount ?? 0} sub={`${s?.activeProducts ?? 0} live`} />
              <StatTile glyph={<Ionicons name="eye-outline" size={18} color={t.premium} />} tone="gold" label="Views" value={(s?.totalViews ?? 0).toLocaleString("en-NG")} />
              <StatTile glyph={<Ionicons name="heart-outline" size={18} color={t.promo} />} tone="promo" label="Likes" value={(s?.totalLikes ?? 0).toLocaleString("en-NG")} />
              <StatTile glyph={<MaterialCommunityIcons name="palette-outline" size={18} color={t.cta} />} tone="info" label="Active commissions" value={s?.activeCommissions ?? 0} />
              <StatTile glyph={<Ionicons name="cube-outline" size={18} color={t.success.fg} />} tone="success" label="Active preorders" value={s?.activePreorders ?? 0} />
            </View>

            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 10 }]}>
              Quick actions
            </Text>
            <View style={styles.tileGrid}>
              <QuickAction
                tone="primary"
                icon={<Ionicons name="add-circle-outline" size={22} />}
                label="New post"
                sub="Share a new design"
                onPress={() => nav.navigate("NewPost")}
              />
              <QuickAction
                tone="info"
                icon={<Ionicons name="albums-outline" size={22} />}
                label="Manage posts"
                sub={`${s?.postCount ?? 0} total`}
                onPress={() => nav.navigate("DesignerPosts")}
              />
              <QuickAction
                tone="promo"
                icon={<MaterialCommunityIcons name="palette-outline" size={22} />}
                label="Commissions"
                sub={`${s?.activeCommissions ?? 0} active`}
                onPress={() => nav.navigate("DesignerCommissions")}
              />
              <QuickAction
                tone="gold"
                icon={<Ionicons name="people-outline" size={22} />}
                label="Followers"
                sub="Audience growth"
                onPress={() => nav.navigate("DesignerFollowers")}
              />
              <QuickAction
                tone="success"
                icon={<Ionicons name="cash-outline" size={22} />}
                label="Earnings"
                sub="Payouts & history"
                onPress={() => nav.navigate("DesignerEarnings")}
              />
              <QuickAction
                tone="primary"
                icon={<Ionicons name="storefront-outline" size={22} />}
                label="Designer profile"
                sub="Bio, links, theme"
                onPress={() => nav.navigate("DesignerProfile")}
              />
              <QuickAction
                tone="info"
                icon={<Ionicons name="shield-checkmark-outline" size={22} />}
                label="Get verified"
                sub="Submit documents for review"
                onPress={() => nav.navigate("Verification")}
              />
            </View>

            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 10 }]}>
              Recent posts
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyOrders, { borderColor: t.border }]}>
            <Text style={[type.body, { color: t.textMuted }]}>No posts yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            tintColor={t.cta}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.postRow,
              { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.bg }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
                {item.likeCount} likes · {item.saveCount} saves · {item.viewCount} views
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  greeting: { fontSize: 26, fontWeight: "800", marginTop: 6 },
  engageCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: radius.lg,
  },
  engageBig: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "800",
    marginTop: 6,
  },
  engageBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  growthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  emptyOrders: {
    padding: 24,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  postRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
});
