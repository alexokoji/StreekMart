import React, { useCallback, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { ListScaffold } from "../components/ListScaffold";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Shop / team managers and delivery riders, same as the website
// (GET/POST /api/managers, PATCH/DELETE /api/managers/:id). Each person gets
// their own login and only the actions you tick.
type Perm = "edit_products" | "manage_orders" | "manage_promotions" | "post" | "edit_post" | "use_sketch_studio" | "reply_messages" | "view_wallet" | "manage_deliveries";
const LABELS: Record<Perm, string> = {
  edit_products: "Add / edit products", manage_orders: "Manage orders", manage_promotions: "Run promotions",
  post: "Publish portfolio posts", edit_post: "Edit / delete posts", use_sketch_studio: "Use the Sketch Studio",
  reply_messages: "Reply to messages", view_wallet: "View the wallet (read-only)", manage_deliveries: "Pick up & confirm deliveries",
};
const RELEVANT: Record<"seller" | "designer", Perm[]> = {
  seller: ["edit_products", "manage_orders", "manage_promotions", "reply_messages", "view_wallet"],
  designer: ["post", "edit_post", "edit_products", "reply_messages", "view_wallet"],
};
type Row = { id: string; role: "manager" | "rider"; phone: string | null; manager: { name: string; email: string }; permissions: Perm[] };

export function ManagersScreen() {
  const t = useTheme();
  const { scope } = useRoute<RouteProp<RootStackParamList, "Managers">>().params;
  const relevant = RELEVANT[scope];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // new account form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "rider">("manager");
  const [perms, setPerms] = useState<Perm[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get<{ managers: Row[] }>("/api/managers");
      setRows(d.managers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function create() {
    if (name.trim().length < 2 || !email.includes("@") || password.length < 8) {
      return Alert.alert("Check the details", "Add a name, a valid email and a password of at least 8 characters.");
    }
    setBusy(true);
    try {
      await api.post("/api/managers", { name: name.trim(), email: email.trim(), password, role, permissions: role === "rider" ? [] : perms });
      setName(""); setEmail(""); setPassword(""); setPerms([]); setAdding(false);
      await load();
    } catch (err) {
      Alert.alert("Couldn't create the account", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: Row, p: Perm) {
    const next = row.permissions.includes(p) ? row.permissions.filter((x) => x !== p) : [...row.permissions, p];
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, permissions: next } : r)));
    try {
      await api.patch(`/api/managers/${row.id}`, { permissions: next });
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
      load();
    }
  }

  function revoke(row: Row) {
    Alert.alert(`Remove ${row.manager.name}?`, "They lose access to your shop straight away.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.delete(`/api/managers/${row.id}`); await load(); }
        catch (err) { Alert.alert("Couldn't remove", err instanceof Error ? err.message : "Try again."); }
      } },
    ]);
  }

  const header = (
    <View style={{ marginBottom: 8 }}>
      <Text style={[type.body, { color: t.textMuted, marginBottom: 12 }]}>
        Hand off day-to-day work. Each person gets their own login and only the actions you allow.
      </Text>
      {adding ? (
        <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 }}>
          <Text style={[type.h2, { color: t.text }]}>New account</Text>
          <SelectField title="Type" value={role} onChange={(v) => setRole(v as "manager" | "rider")} options={[{ value: "manager", label: scope === "seller" ? "Shop manager" : "Account manager" }, { value: "rider", label: "Delivery rider" }]} />
          <Input placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input placeholder="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          {role === "manager" ? relevant.map((p) => (
            <View key={p} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[type.body, { color: t.text, flex: 1 }]}>{LABELS[p]}</Text>
              <Switch value={perms.includes(p)} onValueChange={(v) => setPerms((c) => (v ? [...c, p] : c.filter((x) => x !== p)))} trackColor={{ true: t.cta }} />
            </View>
          )) : <Text style={[type.small, { color: t.textMuted }]}>Riders can pick up and confirm deliveries. Only verified sellers can add riders.</Text>}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Button label={busy ? "Creating…" : "Create"} onPress={create} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button label="Add a manager or rider" onPress={() => setAdding(true)} />
      )}
    </View>
  );

  return (
    <ListScaffold<Row>
      title={scope === "seller" ? "Shop managers" : "Team managers"}
      data={rows}
      keyExtractor={(r) => r.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => { setRefreshing(true); load(); }}
      ListHeader={header}
      emptyIcon="people-outline"
      emptyTitle="No managers yet"
      emptyMessage="Add someone to help run your shop."
      renderItem={({ item }) => {
        const open = openId === item.id;
        return (
          <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 }}>
            <Pressable onPress={() => setOpenId(open ? null : item.id)} accessibilityRole="button">
              <Text style={[type.bodyStrong, { color: t.text }]}>{item.manager.name} · {item.role === "rider" ? "Rider" : "Manager"}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{item.manager.email}</Text>
            </Pressable>
            {open ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {item.role === "manager" ? relevant.map((p) => (
                  <View key={p} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[type.body, { color: t.text, flex: 1 }]}>{LABELS[p]}</Text>
                    <Switch value={item.permissions.includes(p)} onValueChange={() => toggle(item, p)} trackColor={{ true: t.cta }} />
                  </View>
                )) : <Text style={[type.small, { color: t.textMuted }]}>Can pick up and confirm deliveries.</Text>}
                <Button label="Remove access" variant="danger" onPress={() => revoke(item)} />
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}
