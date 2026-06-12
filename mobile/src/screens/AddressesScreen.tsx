import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
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
  isDefault: boolean;
};

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
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to manage addresses.</Text>
        <Button label="Sign in" onPress={() => nav.navigate("Login")} style={{ marginTop: 12 }} />
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

  return (
    <Screen padding={false}>
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[type.h1, { color: t.text }]}>Delivery addresses</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              The default is pre-selected at checkout.
            </Text>
            <Button
              label="+ Add new address"
              variant="secondary"
              style={{ marginTop: 16 }}
              onPress={() => nav.navigate("AddressForm", { id: undefined })}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>
              No addresses yet. Tap "+ Add new address" to get started.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: busy === item.id ? 0.6 : 1 }]}>
            <View style={styles.cardHeader}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{item.label || "Address"}</Text>
              {item.isDefault && (
                <Text style={[type.micro, { color: t.success.fg, backgroundColor: t.success.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                  DEFAULT
                </Text>
              )}
            </View>
            <Text style={[type.body, { color: t.text, marginTop: 4 }]}>{item.formattedAddress}</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              {[item.city, item.region, item.country].filter(Boolean).join(", ")}
              {item.phone ? ` · ${item.phone}` : ""}
            </Text>
            <View style={styles.actions}>
              {!item.isDefault && (
                <Pressable onPress={() => makeDefault(item.id)} disabled={busy === item.id}>
                  <Text style={[type.small, { color: t.accent, fontWeight: "600" }]}>Set default</Text>
                </Pressable>
              )}
              <Pressable onPress={() => nav.navigate("AddressForm", { id: item.id })}>
                <Text style={[type.small, { color: t.accent, fontWeight: "600" }]}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => remove(item.id)} disabled={busy === item.id}>
                <Text style={[type.small, { color: t.danger.fg, fontWeight: "600" }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 24, alignItems: "center" },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", gap: 16, marginTop: 12 },
});