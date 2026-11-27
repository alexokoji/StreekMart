import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Pay-by-bank-transfer for direct-pay sellers, both sides of it.
//  Buyer: sees the seller's bank details, the exact amount and the reference to
//         put in the narration, then uploads their receipt.
//  Seller: sees the receipt, the amount and reference to match against their bank
//         alert, then confirms (marks the order paid) or rejects with a reason.
// Same endpoints as the website's /pay/transfer/:reference page.
type Data = {
  reference: string;
  role: "buyer" | "seller";
  status: string | null;
  rejectReason: string | null;
  proofUrl: string | null;
  senderName: string | null;
  amount: number;
  buyer: { name: string };
  seller: { name: string; bankName: string; accountNumber: string; accountName: string };
  orders: { id: string; quantity: number; totalPrice: number; product: { name: string; image: string | null } }[];
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export function TransferScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { reference } = useRoute<RouteProp<RootStackParamList, "Transfer">>().params;
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [sender, setSender] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setD(await api.get<Data>(`/api/orders/transfer/${encodeURIComponent(reference)}`));
    } catch (err) {
      Alert.alert("Couldn't load this payment", err instanceof Error ? err.message : "Try again.");
    }
  }, [reference]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function post(path: string, body: object, done?: () => void) {
    setBusy(true);
    try {
      await api.post(`/api/orders/transfer/${encodeURIComponent(reference)}/${path}`, body);
      await load();
      done?.();
    } catch (err) {
      Alert.alert("Couldn't do that", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseReceipt() {
    const [asset] = await pickImages({});
    if (!asset) return;
    setBusy(true);
    try {
      setReceipt(await uploadImage(asset));
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <FormScreen title="Bank transfer">
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      </FormScreen>
    );
  }

  const confirmed = d.status === "CONFIRMED";
  const buyer = d.role === "buyer";
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );
  const Line = ({ k, v }: { k: string; v: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, gap: 12 }}>
      <Text style={[type.small, { color: t.textMuted }]}>{k}</Text>
      <Text selectable style={[type.bodyStrong, { color: t.text, flexShrink: 1, textAlign: "right" }]}>{v}</Text>
    </View>
  );

  return (
    <FormScreen title={buyer ? "Pay by bank transfer" : "Check this payment"}>
      <Card>
        <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>This transfer pays for</Text>
        {d.orders.map((o) => (
          <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            {o.product.image ? (
              <Image source={{ uri: o.product.image }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
            ) : null}
            <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={2}>{o.product.name} × {o.quantity}</Text>
            <Text style={[type.bodyStrong, { color: t.text }]}>{naira(o.totalPrice)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Line k="Amount" v={naira(d.amount)} />
        <Line k="Bank" v={d.seller.bankName} />
        <Line k="Account number" v={d.seller.accountNumber} />
        <Line k="Account name" v={d.seller.accountName} />
        <Line k="Reference" v={d.reference} />
        <Text style={[type.small, { color: t.textMuted, marginTop: 8 }]}>
          {buyer
            ? `Send exactly ${naira(d.amount)} and put ${d.reference} in the transfer narration. That code is how ${d.seller.name} matches your payment to this order. Press and hold any detail to copy it.`
            : `Look for a credit of exactly ${naira(d.amount)} with ${d.reference} in the narration${d.senderName ? `, from ${d.senderName}` : ""}.`}
        </Text>
      </Card>

      {confirmed ? (
        <Card>
          <Text style={[type.bodyStrong, { color: t.success.fg }]}>Payment confirmed.</Text>
          <Button
            label="View order"
            variant="secondary"
            style={{ marginTop: 10 }}
            onPress={() => nav.navigate(buyer ? "OrderDetail" : "SellerOrderDetail", { id: d.orders[0].id })}
          />
        </Card>
      ) : buyer ? (
        <Card>
          {d.status === "PROOF_SUBMITTED" ? (
            <Text style={[type.body, { color: t.text, marginBottom: 10 }]}>
              Receipt sent. {d.seller.name} will confirm once the money shows in their account.
            </Text>
          ) : null}
          {d.status === "REJECTED" ? (
            <Text style={[type.body, { color: t.danger.fg, marginBottom: 10 }]}>
              The seller couldn't confirm this payment: {d.rejectReason}. Upload a new receipt or contact the seller.
            </Text>
          ) : null}
          {receipt ? (
            <Image source={{ uri: receipt }} style={{ width: "100%", height: 220, borderRadius: radius.md, marginBottom: 10 }} contentFit="contain" />
          ) : null}
          <Button label={receipt ? "Choose a different receipt" : "Upload receipt"} variant="secondary" onPress={chooseReceipt} loading={busy && !receipt} />
          <Text style={[type.small, { color: t.textMuted, marginTop: 12, marginBottom: 6 }]}>Name on the sending account (optional)</Text>
          <Input value={sender} onChangeText={setSender} placeholder="So the seller can spot it" />
          <Button
            label={d.status === "PROOF_SUBMITTED" ? "Replace receipt" : "I've paid, send receipt"}
            disabled={!receipt}
            loading={busy && !!receipt}
            style={{ marginTop: 10 }}
            onPress={() => post("proof", { proofUrl: receipt, senderName: sender.trim() || undefined }, () => setReceipt(null))}
          />
        </Card>
      ) : (
        <Card>
          {d.proofUrl ? (
            <Image source={{ uri: d.proofUrl }} style={{ width: "100%", height: 280, borderRadius: radius.md }} contentFit="contain" />
          ) : (
            <Text style={[type.body, { color: t.textMuted }]}>
              The buyer hasn't uploaded a receipt yet. If the money has already reached your account you can still confirm it.
            </Text>
          )}
          <Text style={[type.small, { color: t.textMuted, marginTop: 10 }]}>
            Only confirm after you've seen the money in your bank app. A receipt image alone can be faked.
          </Text>
          <Button label="Money received, confirm payment" loading={busy} style={{ marginTop: 12 }} onPress={() => post("review", { action: "confirm" })} />
          <Text style={[type.small, { color: t.textMuted, marginTop: 14, marginBottom: 6 }]}>Or reject, with a reason</Text>
          <Input value={reason} onChangeText={setReason} placeholder="e.g. the amount didn't arrive" />
          <Button
            label="Reject payment"
            variant="danger"
            disabled={!reason.trim()}
            style={{ marginTop: 10 }}
            onPress={() => post("review", { action: "reject", reason: reason.trim() }, () => setReason(""))}
          />
        </Card>
      )}
    </FormScreen>
  );
}
