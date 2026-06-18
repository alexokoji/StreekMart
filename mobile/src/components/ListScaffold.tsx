// Shared scaffold for the role-dashboard list screens (Manage Products,
// Posts, Commissions, Payouts, all admin queues). Standardises the
// BackHeader, loading skeleton, refresh control, empty state, error
// state, and optional header content slot.
//
// Each screen wraps the scaffold around a FlatList; everything else
// (data fetching, item rendering) is local to that screen.

import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "./BackHeader";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

export type ListScaffoldProps<T> = {
  title: string;
  rightAction?: React.ReactNode;
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  // Fetch state
  loading: boolean;
  refreshing: boolean;
  error?: string | null;
  onRefresh: () => void;
  // Empty / error illustrations
  emptyIcon?: React.ComponentProps<typeof Ionicons>["name"];
  emptyTitle?: string;
  emptyMessage?: string;
  // Optional header rendered above the list (KPI cards etc.)
  ListHeader?: React.ReactNode;
};

export function ListScaffold<T>({
  title,
  rightAction,
  data,
  keyExtractor,
  renderItem,
  loading,
  refreshing,
  error,
  onRefresh,
  emptyIcon = "cube-outline",
  emptyTitle = "Nothing here yet",
  emptyMessage = "Items will appear here once they exist.",
  ListHeader,
}: ListScaffoldProps<T>) {
  const t = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={title} rightAction={rightAction} />
      {loading && data.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={t.danger.fg} />
          <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>
            Couldn't load
          </Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.retry,
              { borderColor: t.cta, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[type.bodyStrong, { color: t.cta }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeader ? <View>{ListHeader}</View> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={emptyIcon} size={48} color={t.textMuted} />
              <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>
                {emptyTitle}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
                {emptyMessage}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl tintColor={t.cta} refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { padding: 40, alignItems: "center" },
  retry: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
