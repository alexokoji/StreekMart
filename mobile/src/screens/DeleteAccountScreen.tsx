import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

// Delete my data, from inside the app. Calls the same endpoint as the website
// (POST /api/account/deletion-request): the user retypes their email to
// confirm, the account and its data are removed, and they're signed out.
export function DeleteAccountScreen() {
  const t = useTheme();
  const { user, logout } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = !!user && confirm.trim().toLowerCase() === user.email.trim().toLowerCase();

  function ask() {
    Alert.alert(
      "Delete everything?",
      "This permanently deletes your account, orders, messages and everything else tied to it. It can't be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete my data", style: "destructive", onPress: go },
      ],
    );
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/account/deletion-request", { confirmEmail: confirm.trim() });
      // The server has removed the account; clear the session on this phone.
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <FormScreen title="Delete my data">
      <View style={{ backgroundColor: t.danger.bg, borderRadius: radius.lg, padding: 14, marginBottom: 16 }}>
        <Text style={[type.bodyStrong, { color: t.danger.fg }]}>This can't be undone</Text>
        <Text style={[type.body, { color: t.danger.fg, marginTop: 4, lineHeight: 21 }]}>
          Your profile, orders, messages, wishlist and wallet history are permanently removed. If you
          sell on StreekMart, your listings and order history go with it. Finish any open orders and
          withdraw your balance first.
        </Text>
      </View>
      <Text style={[type.body, { color: t.textMuted, marginBottom: 10 }]}>
        To confirm, type your email address{user ? ` (${user.email})` : ""}.
      </Text>
      <View style={{ gap: 12 }}>
        <Input placeholder="Your email" value={confirm} onChangeText={setConfirm} autoCapitalize="none" keyboardType="email-address" />
        {error ? <Text style={[type.body, { color: t.danger.fg }]}>{error}</Text> : null}
        <Button label={busy ? "Deleting…" : "Delete my data"} variant="danger" onPress={ask} loading={busy} disabled={!matches} />
      </View>
    </FormScreen>
  );
}
