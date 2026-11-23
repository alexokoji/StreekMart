import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { BANKS } from "../lib/banks";
import { type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Withdraw wallet funds to a bank account. Same endpoint and fields as the
// web wallet panel: POST /api/wallet/payout { amountCents, bankCode,
// accountNumber, accountName }. The server enforces available balance, the
// tier-based fee and the escrow hold, and explains any refusal.
export function WithdrawScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Withdraw">>();
  const maxNaira = Math.floor((params?.availableCents ?? 0) / 100);

  const [amount, setAmount] = useState(maxNaira > 0 ? String(maxNaira) : "");
  const [bankCode, setBankCode] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = bankCode === "other" ? customCode.trim() : bankCode;

  async function submit() {
    setError(null);
    const naira = Number(amount);
    if (!Number.isFinite(naira) || naira <= 0) return setError("Enter a valid amount.");
    if (!code) return setError("Choose your bank.");
    if (accountNumber.trim().length < 6) return setError("Enter your account number.");
    if (accountName.trim().length < 2) return setError("Enter the account name.");
    setBusy(true);
    try {
      await api.post("/api/wallet/payout", {
        amountCents: Math.round(naira * 100),
        bankCode: code,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
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
        Available to withdraw: ₦{maxNaira.toLocaleString("en-NG")}. A withdrawal fee applies and
        funds from undelivered orders are released after delivery is confirmed.
      </Text>
      <View style={{ gap: 12 }}>
        <Input
          placeholder="Amount (₦)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <SelectField
          title="Choose your bank"
          placeholder="Choose your bank"
          value={bankCode}
          onChange={setBankCode}
          options={[...BANKS, { value: "other", label: "Another bank (enter code)" }]}
        />
        {bankCode === "other" && (
          <Input
            placeholder="Bank code"
            keyboardType="numeric"
            value={customCode}
            onChangeText={setCustomCode}
          />
        )}
        <Input
          placeholder="Account number"
          keyboardType="numeric"
          value={accountNumber}
          onChangeText={setAccountNumber}
        />
        <Input
          placeholder="Account name"
          value={accountName}
          onChangeText={setAccountName}
          autoCapitalize="words"
        />
        {error && <Text style={[type.body, { color: t.danger.fg }]}>{error}</Text>}
        <Button label={busy ? "Sending…" : "Confirm withdrawal"} onPress={submit} loading={busy} />
      </View>
    </FormScreen>
  );
}
