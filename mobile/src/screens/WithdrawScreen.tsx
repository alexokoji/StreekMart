import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { BANKS } from "../lib/banks";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Withdraw wallet funds to a bank account. Same endpoints as the web wallet:
//   GET  /api/banks            banks (Korapay's own list when live)
//   POST /api/banks/resolve    the name the BANK has on the account
//   POST /api/wallet/payout    { amountCents, bankCode, accountNumber, accountName }
// The account name is looked up from the bank and shown for confirmation, so a
// mistyped bank or number is caught before any money moves. When lookups aren't
// available (test mode) a name can be typed instead.
type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "verified"; name: string }
  | { kind: "failed"; message: string }
  | { kind: "manual"; message: string };

export function WithdrawScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Withdraw">>();
  const maxNaira = Math.floor((params?.availableCents ?? 0) / 100);

  const [amount, setAmount] = useState(maxNaira > 0 ? String(maxNaira) : "");
  const [banks, setBanks] = useState<{ value: string; label: string }[]>(BANKS);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [typedName, setTypedName] = useState("");
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    api
      .get<{ banks: { value: string; label: string }[] }>("/api/banks")
      .then((d) => d.banks?.length && setBanks(d.banks))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      setCheck({ kind: "idle" });
      return;
    }
    const mine = ++seq.current;
    setCheck({ kind: "checking" });
    const timer = setTimeout(async () => {
      try {
        const r = await api.post<{ ok: boolean; accountName?: string; error?: string; unavailable?: boolean }>(
          "/api/banks/resolve",
          { bankCode, accountNumber },
        );
        if (mine !== seq.current) return;
        if (r.ok && r.accountName) setCheck({ kind: "verified", name: r.accountName });
        else if (r.unavailable) setCheck({ kind: "manual", message: r.error ?? "Verification isn't available." });
        else setCheck({ kind: "failed", message: r.error ?? "Couldn't verify this account." });
      } catch {
        if (mine === seq.current) setCheck({ kind: "failed", message: "Couldn't reach the bank. Try again." });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [bankCode, accountNumber]);

  const accountName = check.kind === "verified" ? check.name : check.kind === "manual" ? typedName.trim() : "";
  const ready = check.kind === "verified" || (check.kind === "manual" && typedName.trim().length >= 2);

  async function submit() {
    setError(null);
    const naira = Number(amount);
    if (!Number.isFinite(naira) || naira <= 0) return setError("Enter a valid amount.");
    if (!ready) return setError("Choose your bank and enter your 10-digit account number first.");
    setBusy(true);
    try {
      await api.post("/api/wallet/payout", {
        amountCents: Math.round(naira * 100),
        bankCode,
        accountNumber,
        accountName,
      });
      Alert.alert("Withdrawal on its way", "We'll send it to your bank shortly.", [
        { text: "Done", onPress: () => nav.goBack() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen title="Withdraw">
      <Text style={[type.body, { color: t.textMuted, marginBottom: 14 }]}>
        Available to withdraw: ₦{maxNaira.toLocaleString("en-NG")}. A withdrawal fee may apply, and funds
        from undelivered orders are released after delivery is confirmed.
      </Text>
      <View style={{ gap: 12 }}>
        <Input placeholder="Amount (₦)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <SelectField title="Choose your bank" placeholder="Choose your bank" value={bankCode} onChange={setBankCode} options={banks} />
        <Input
          placeholder="Account number (10 digits)"
          keyboardType="numeric"
          maxLength={10}
          value={accountNumber}
          onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ""))}
        />
        {check.kind === "checking" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={t.cta} />
            <Text style={[type.body, { color: t.textMuted }]}>Checking with your bank…</Text>
          </View>
        )}
        {check.kind === "verified" && (
          <View style={{ backgroundColor: t.success.bg, padding: 12, borderRadius: radius.md }}>
            <Text style={[type.body, { color: t.success.fg }]}>
              Account name: <Text style={{ fontWeight: "800" }}>{check.name}</Text>. Check this is you before you continue.
            </Text>
          </View>
        )}
        {check.kind === "failed" && (
          <View style={{ backgroundColor: t.danger.bg, padding: 12, borderRadius: radius.md }}>
            <Text style={[type.body, { color: t.danger.fg }]}>{check.message}</Text>
          </View>
        )}
        {check.kind === "manual" && (
          <>
            <Text style={[type.small, { color: t.warning.fg }]}>{check.message} Enter the account name exactly as the bank has it.</Text>
            <Input placeholder="Account name" value={typedName} onChangeText={setTypedName} autoCapitalize="words" />
          </>
        )}
        {error && <Text style={[type.body, { color: t.danger.fg }]}>{error}</Text>}
        <Button label={busy ? "Sending…" : "Confirm withdrawal"} onPress={submit} loading={busy} disabled={!ready} />
      </View>
    </FormScreen>
  );
}
