import React, { useCallback, useState } from "react";
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

type Method = {
  id: string;
  gateway: string;
  maskedPan: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
};

export function PaymentMethodsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ methods: Method[] }>("/api/payment-methods");
      setRows(data.methods ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setDefault(id: string) {
    setBusy(id);
    try {
      await api.patch(`/api/payment-methods/${id}`, { isDefault: true });
      setRows((r) => r.map((m) => ({ ...m, isDefault: m.id === id })));
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  function remove(id: string) {
    Alert.alert("Forget card?", "We won't be able to use this card without you re-entering it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Forget",
        style: "destructive",
        onPress: async () => {
          setBusy(id);
          try {
            await api.delete(`/api/payment-methods/${id}`);
            setRows((r) => r.filter((m) => m.id !== id));
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
        <Text style={[type.body, { color: t.text }]}>Sign in to manage payment methods.</Text>
        <Button label="Sign in" style={{ marginTop: 12 }} onPress={() => nav.navigate("Login")} />
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
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[type.h1, { color: t.text }]}>Payment methods</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Cards saved at checkout. Tick "Save this card" next time you pay to add a new one.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
              No saved cards yet. At your next checkout you can opt to save one.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: busy === item.id ? 0.6 : 1 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{item.brand ?? "Card"}</Text>
              {item.isDefault && (
                <Text style={[type.micro, { color: t.success.fg, backgroundColor: t.success.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                  DEFAULT
                </Text>
              )}
            </View>
            <Text style={[type.body, { color: t.text, marginTop: 4, fontFamily: "monospace" }]}>
              {item.maskedPan ?? "----  ----  ----  ----"}
            </Text>
            {item.expMonth && item.expYear && (
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                Expires {String(item.expMonth).padStart(2, "0")}/{item.expYear}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              {!item.isDefault && (
                <Pressable onPress={() => setDefault(item.id)} disabled={busy === item.id}>
                  <Text style={[type.small, { color: t.accent, fontWeight: "600" }]}>Set default</Text>
                </Pressable>
              )}
              <Pressable onPress={() => remove(item.id)} disabled={busy === item.id}>
                <Text style={[type.small, { color: t.danger.fg, fontWeight: "600" }]}>Forget card</Text>
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
  empty: { padding: 32, alignItems: "center" },
  card: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});