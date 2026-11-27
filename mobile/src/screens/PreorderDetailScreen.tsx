import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { preorderStatusLabel } from "../lib/preorders";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// One preorder, with the actions each side can take. Same endpoints as the
// website (GET/PATCH /api/preorders/:id, POST /api/preorders/:id/pay-delivery):
//   buyer:    pay delivery once it's ready, confirm delivery with the code, cancel
//   fulfiller: mark ready, ship with a tracking code, cancel
type Preorder = {
  id: string;
  status: string;
  priceCents: number;
  leadDays: number;
  notes: string | null;
  estimatedReadyAt: string | null;
  deliveryFeeCents: number | null;
  shippingAddress: string | null;
  trackingCode: string | null;
  deliveryCode: string | null;
  cancellationReason: string | null;
  buyer: { id: string; name: string };
  designer: { id: string; name: string };
  post: { title: string } | null;
  product: { name: string } | null;
};

export function PreorderDetailScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { id, role } = useRoute<RouteProp<RootStackParamList, "PreorderDetail">>().params;
  const isBuyer = role === "buyer";
  const [p, setP] = useState<Preorder | null>(null);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [fee, setFee] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ preorder: Preorder }>(`/api/preorders/${id}`);
      setP(d.preorder);
    } catch (err) {
      Alert.alert("Couldn't load", err instanceof Error ? err.message : "Try again.", [{ text: "OK", onPress: () => nav.goBack() }]);
    }
  }, [id, nav]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.patch(`/api/preorders/${id}`, body);
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function payDelivery() {
    const feeNaira = Number(fee);
    if (address.trim().length < 8 || !(feeNaira > 0)) return Alert.alert("Add the details", "Enter your delivery address and the delivery fee you agreed.");
    setBusy(true);
    try {
      const r = await api.post<{ checkoutUrl?: string }>(`/api/preorders/${id}/pay-delivery`, {
        shippingAddress: address.trim(),
        feeCents: Math.round(feeNaira * 100),
      });
      // The gateway's hosted payment page opens in the app's payment screen.
      if (r.checkoutUrl) nav.navigate("Payment", { url: r.checkoutUrl });
      else await load();
    } catch (err) {
      Alert.alert("Couldn't start payment", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    Alert.alert("Cancel this preorder?", "This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel preorder", style: "destructive", onPress: () => patch({ kind: "TRANSITION", to: "CANCELLED" }) },
    ]);
  }

  if (!p) return <FormScreen title="Preorder"><ActivityIndicator color={t.cta} style={{ marginTop: 40 }} /></FormScreen>;

  const title = p.product?.name ?? p.post?.title ?? "Preorder";
  const open = p.status !== "COMPLETED" && p.status !== "CANCELLED";
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 12, gap: 8 }}>{children}</View>
  );

  return (
    <FormScreen title="Preorder">
      <Card>
        <Text style={[type.h2, { color: t.text }]}>{title}</Text>
        <Text style={[type.body, { color: t.textMuted }]}>
          {isBuyer ? `From ${p.designer.name}` : `For ${p.buyer.name}`} · ₦{Math.round(p.priceCents / 100).toLocaleString("en-NG")} · ready in about {p.leadDays} days
        </Text>
        <Text style={[type.bodyStrong, { color: t.accent }]}>{preorderStatusLabel(p.status)}</Text>
        {p.notes ? <Text style={[type.body, { color: t.textMuted }]}>Notes: {p.notes}</Text> : null}
        {p.trackingCode ? <Text style={[type.body, { color: t.text }]}>Tracking: {p.trackingCode}</Text> : null}
        {p.cancellationReason ? <Text style={[type.body, { color: t.danger.fg }]}>{p.cancellationReason}</Text> : null}
      </Card>

      {isBuyer && p.deliveryCode && (p.status === "AWAITING_SHIPMENT" || p.status === "SHIPPED") ? (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text }]}>Your delivery code</Text>
          <Text style={{ color: t.cta, fontSize: 32, fontWeight: "800", letterSpacing: 6 }}>{p.deliveryCode}</Text>
          <Text style={[type.small, { color: t.textMuted }]}>Give this to the rider when your piece arrives.</Text>
        </Card>
      ) : null}

      {isBuyer && p.status === "READY" ? (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text }]}>Your piece is ready. Pay for delivery</Text>
          <Input placeholder="Delivery address" value={address} onChangeText={setAddress} multiline />
          <Input placeholder="Delivery fee (₦)" value={fee} onChangeText={setFee} keyboardType="numeric" />
          <Button label={busy ? "Starting…" : "Pay delivery"} onPress={payDelivery} loading={busy} />
        </Card>
      ) : null}

      {isBuyer && p.status === "SHIPPED" ? (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text }]}>Got your piece?</Text>
          <Input placeholder="6-digit delivery code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
          <Button label="Confirm delivery" onPress={() => patch({ kind: "CONFIRM", code })} loading={busy} disabled={code.length !== 6} />
        </Card>
      ) : null}

      {!isBuyer && p.status === "AWAITING_READY" ? (
        <Button label="Mark as ready" onPress={() => patch({ kind: "READY" })} loading={busy} style={{ marginBottom: 12 }} />
      ) : null}

      {!isBuyer && p.status === "AWAITING_SHIPMENT" ? (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text }]}>Ship it</Text>
          <Input placeholder="Tracking code" value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
          <Button label="Mark as shipped" onPress={() => patch({ kind: "SHIP", trackingCode: tracking.trim() })} loading={busy} disabled={tracking.trim().length === 0} />
        </Card>
      ) : null}

      {open ? <Button label="Cancel preorder" variant="secondary" onPress={cancel} disabled={busy} /> : null}
    </FormScreen>
  );
}
