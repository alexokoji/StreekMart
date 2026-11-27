import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

// Ask to become a seller and/or designer. Same flow as the website's account
// type page (GET/POST /api/account/role-change): an admin reviews the request.
type State = { isSeller: boolean; isDesigner: boolean; pending: { toIsSeller: boolean; toIsDesigner: boolean } | null };

export function AccountTypeScreen() {
  const t = useTheme();
  const { refresh } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [toSeller, setToSeller] = useState(false);
  const [toDesigner, setToDesigner] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.get<State>("/api/account/role-change");
      setState(s);
      setToSeller(s.isSeller);
      setToDesigner(s.isDesigner);
      refresh().catch(() => {});
    } catch (err) {
      Alert.alert("Couldn't load", err instanceof Error ? err.message : "Try again.");
    }
  }, [refresh]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submit() {
    if (!state) return;
    if (toSeller === state.isSeller && toDesigner === state.isDesigner) {
      return Alert.alert("Nothing to change", "Pick the account type you want first.");
    }
    setBusy(true);
    try {
      await api.post("/api/account/role-change", { toIsSeller: toSeller, toIsDesigner: toDesigner, reason: reason.trim() || undefined });
      Alert.alert("Request sent", "An admin will review it and you'll be notified once it's decided.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <FormScreen title="Account type"><ActivityIndicator color={t.cta} style={{ marginTop: 40 }} /></FormScreen>;
  }
  if (state.pending) {
    const want = [state.pending.toIsSeller && "Seller", state.pending.toIsDesigner && "Designer"].filter(Boolean).join(" and ") || "Buyer only";
    return (
      <FormScreen title="Account type">
        <View style={{ backgroundColor: t.warning.bg, borderRadius: radius.lg, padding: 16 }}>
          <Text style={[type.bodyStrong, { color: t.warning.fg }]}>Waiting for review</Text>
          <Text style={[type.body, { color: t.warning.fg, marginTop: 4 }]}>
            You asked to be {want}. An admin will review it and you'll be notified.
          </Text>
        </View>
      </FormScreen>
    );
  }

  const Option = ({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) => (
    <Pressable
      onPress={() => set(!on)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: t.card, borderColor: on ? t.cta : t.border, borderWidth: on ? 2 : 1, borderRadius: radius.lg, padding: 14, marginBottom: 10 }}
    >
      <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? t.cta : t.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{label}</Text>
        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{hint}</Text>
      </View>
    </Pressable>
  );

  return (
    <FormScreen title="Account type">
      <Text style={[type.body, { color: t.textMuted, marginBottom: 14 }]}>
        Everyone can buy. Choose what else you want to do on StreekMart. An admin reviews each request.
      </Text>
      <Option label="Seller" hint="List and sell products, manage orders, get paid." on={toSeller} set={setToSeller} />
      <Option label="Designer" hint="Publish posts and lookbooks, take preorders and custom commissions." on={toDesigner} set={setToDesigner} />
      <View style={{ gap: 12, marginTop: 6 }}>
        <Input placeholder="Why do you want this? (optional)" value={reason} onChangeText={setReason} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
        <Button label={busy ? "Sending…" : "Send request"} onPress={submit} loading={busy} />
      </View>
    </FormScreen>
  );
}
