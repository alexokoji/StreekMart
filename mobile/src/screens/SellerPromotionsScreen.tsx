import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { Input } from "../components/Input";
import { Chip } from "../components/Chip";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

type Promo = {
  id: string;
  code: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  description: string | null;
  endsAt: string | null;
  active: boolean;
  redemptions: number;
};

export function SellerPromotionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ promos: Promo[] }>("/api/seller/promotions");
      setItems(data.promos ?? []);
    } catch (err) {
      if (isNotFound(err)) {
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : "Try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleActive(p: Promo) {
    const prev = items;
    setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    try {
      await api.patch(`/api/seller/promotions/${p.id}`, { active: !p.active });
    } catch (err) {
      setItems(prev);
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <>
      <ListScaffold<Promo>
        title="Promotions"
        rightAction={
          <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
            <Ionicons name="add" size={26} color={t.cta} />
          </Pressable>
        }
        data={items}
        keyExtractor={(p) => p.id}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        emptyIcon="megaphone-outline"
        emptyTitle="No promotions yet"
        emptyMessage="Tap + to launch a sale or coupon."
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.stub, { backgroundColor: item.active ? t.cta : t.border }]}>
              <Text style={[styles.stubBig, { color: item.active ? t.ctaText : t.textMuted }]}>
                {item.kind === "PERCENT"
                  ? `${(item.value / 100).toFixed(0)}%`
                  : `₦${Math.round(item.value / 100).toLocaleString("en-NG")}`}
              </Text>
              <Text style={[type.micro, { color: item.active ? t.ctaText : t.textMuted, opacity: 0.85, marginTop: 2 }]}>
                off
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text, fontFamily: "monospace" }]}>{item.code}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]} numberOfLines={2}>
                {item.description ?? "Code applies at checkout"}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
                {item.redemptions} used
                {item.endsAt ? ` · Ends ${new Date(item.endsAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}` : ""}
              </Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={() => toggleActive(item)}
              trackColor={{ true: t.cta, false: t.border }}
            />
          </View>
        )}
      />
      <CreatePromoModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(p) => {
          setItems((cur) => [p, ...cur]);
          setShowCreate(false);
        }}
      />
    </>
  );
}

function CreatePromoModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (p: Promo) => void;
}) {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!code.trim() || !value.trim()) {
      Alert.alert("Almost there", "Code and value are required.");
      return;
    }
    setBusy(true);
    try {
      const numeric = Number(value);
      // Server expects cents for FLAT, basis points for PERCENT.
      const payload = {
        code: code.trim().toUpperCase(),
        kind,
        value: kind === "PERCENT" ? Math.round(numeric * 100) : Math.round(numeric * 100),
        description: description.trim() || null,
      };
      const r = await api.post<{ promo: Promo }>("/api/seller/promotions", payload);
      onCreated(r.promo);
      setCode("");
      setValue("");
      setDescription("");
    } catch (err) {
      Alert.alert("Couldn't create", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.bg }]}>
          <View style={styles.sheetHead}>
            <Text style={[type.h2, { color: t.text }]}>New promotion</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={t.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Code</Text>
              <Input
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                placeholder="SUMMER15"
              />
            </View>
            <View>
              <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Discount type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip label="Percentage" selected={kind === "PERCENT"} onPress={() => setKind("PERCENT")} />
                <Chip label="Flat amount" selected={kind === "FLAT"} onPress={() => setKind("FLAT")} />
              </View>
            </View>
            <View>
              <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>
                {kind === "PERCENT" ? "Percent off (e.g. 15)" : "Naira off (e.g. 500)"}
              </Text>
              <Input
                value={value}
                onChangeText={(v) => setValue(v.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                placeholder={kind === "PERCENT" ? "15" : "500"}
              />
            </View>
            <View>
              <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Description (optional)</Text>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="What buyers see at checkout"
              />
            </View>
            <Pressable
              onPress={save}
              disabled={busy}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: t.cta, opacity: busy ? 0.7 : pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
                {busy ? "Creating…" : "Create"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stub: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stubBig: { fontSize: 22, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  saveBtn: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
});
