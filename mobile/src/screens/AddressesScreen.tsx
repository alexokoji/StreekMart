import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type Address = {
  id: string;
  label: string | null;
  phone: string | null;
  formattedAddress: string;
  city: string | null;
  region: string | null;
  country: string | null;
  // Google Places fields — needed by Shipbubble (logistics rates) and
  // the checkout's shippingPlaceId/shippingLatitude/shippingLongitude.
  // Optional so legacy rows without a picker entry still load.
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
};

function iconForLabel(label: string | null): React.ComponentProps<typeof Ionicons>["name"] {
  const k = (label ?? "").toLowerCase();
  if (k.includes("home")) return "home-outline";
  if (k.includes("office") || k.includes("work")) return "briefcase-outline";
  if (k.includes("school") || k.includes("uni")) return "school-outline";
  return "location-outline";
}

export function AddressesScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ addresses: Address[] }>(
        "/api/account/addresses",
        { kind: "DELIVERY" },
      );
      setRows(data.addresses ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function makeDefault(id: string) {
    setBusy(id);
    try {
      await api.patch(`/api/account/addresses/${id}`, { isDefault: true });
      setRows((r) => r.map((x) => ({ ...x, isDefault: x.id === id })));
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    Alert.alert("Delete address?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(id);
          try {
            await api.delete(`/api/account/addresses/${id}`);
            setRows((r) => r.filter((x) => x.id !== id));
          } catch (err) {
            Alert.alert("Could not delete", err instanceof Error ? err.message : "Try again.");
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
        <BackHeader title="Addresses" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to manage delivery addresses.
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
        <BackHeader title="Addresses" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader
        title="Addresses"
        rightAction={
          <Pressable onPress={() => nav.navigate("AddressForm", { id: undefined })} hitSlop={8}>
            <Text style={[type.bodyStrong, { color: t.cta }]}>+ Add</Text>
          </Pressable>
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <Text style={[type.small, { color: t.textMuted, marginBottom: 4 }]}>
            We use your default address at checkout.
          </Text>
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="location-outline" size={38} color={t.textMuted} />
            <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>No addresses yet</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
              Add a delivery address so checkout is one tap.
            </Text>
            <Pressable
              onPress={() => nav.navigate("AddressForm", { id: undefined })}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 16 },
              ]}
            >
              <Text style={{ color: t.ctaText, fontWeight: "700" }}>Add address</Text>
            </Pressable>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: t.card,
                borderColor: item.isDefault ? t.cta : t.border,
                borderWidth: item.isDefault ? 1.5 : StyleSheet.hairlineWidth,
                opacity: busy === item.id ? 0.6 : 1,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.glyph, { backgroundColor: t.accentSoft }]}>
                <Ionicons name={iconForLabel(item.label)} size={18} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>
                  {item.label || "Address"}
                </Text>
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  {[item.city, item.region, item.country].filter(Boolean).join(", ") || "—"}
                </Text>
              </View>
              {item.isDefault ? (
                <View style={[styles.defaultBadge, { backgroundColor: t.success.bg }]}>
                  <Text style={{ color: t.success.fg, fontSize: 11, fontWeight: "800" }}>DEFAULT</Text>
                </View>
              ) : null}
            </View>
            <Text style={[type.body, { color: t.text, marginTop: 10 }]}>{item.formattedAddress}</Text>
            {item.phone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={14} color={t.textMuted} />
                <Text style={[type.small, { color: t.textMuted }]}>{item.phone}</Text>
              </View>
            ) : null}
            <View style={[styles.actions, { borderTopColor: t.border }]}>
              {!item.isDefault ? (
                <Pressable onPress={() => makeDefault(item.id)} disabled={busy === item.id}>
                  <Text style={[type.bodyStrong, { color: t.cta }]}>Set default</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Pressable onPress={() => nav.navigate("AddressForm", { id: item.id })}>
                  <Text style={[type.bodyStrong, { color: t.text }]}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(item.id)} disabled={busy === item.id}>
                  <Text style={[type.bodyStrong, { color: t.danger.fg }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  pill: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.pill },
  emptyCard: {
    padding: 28,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  card: {
    borderRadius: radius.md,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
});
