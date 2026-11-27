import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

// Help and support, built into the app: the website's FAQ (from
// GET /api/legal/support) and a message form that sends straight to the
// support inbox (POST /api/support/ticket). No browser, no email app.
const TOPICS = [
  "Order help", "Payments & wallet", "Verification", "Listings / products",
  "Bug report", "Feature request", "Account / login", "Something else",
].map((v) => ({ value: v, label: v }));

type Faq = { q: string; a: string };

export function SupportScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [topic, setTopic] = useState("Order help");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ faqs: Faq[] }>("/api/legal/support").then((d) => setFaqs(d.faqs ?? [])).catch(() => {});
  }, []);

  async function send() {
    if (message.trim().length < 5) return Alert.alert("Write a message", "Tell us a little about what you need.");
    if (!user && !email.trim()) return Alert.alert("Add your email", "So we know where to reply.");
    setBusy(true);
    try {
      await api.post("/api/support/ticket", { topic, message: message.trim(), ...(user ? {} : { email: email.trim() }) });
      setMessage("");
      Alert.alert("Message sent", "We read every message and reply within one business day.");
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen title="Help and support">
      <Text style={[type.h1, { color: t.text }]}>We're here to help.</Text>
      <Text style={[type.body, { color: t.textMuted, marginTop: 6, marginBottom: 16 }]}>
        Most questions are answered below. If you need a person, send us a message.
      </Text>

      {faqs.map((f) => {
        const isOpen = open === f.q;
        return (
          <Pressable
            key={f.q}
            onPress={() => setOpen(isOpen ? null : f.q)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={[type.bodyStrong, { color: t.text, flex: 1 }]}>{f.q}</Text>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={t.textMuted} />
            </View>
            {isOpen ? <Text style={[type.body, { color: t.textMuted, marginTop: 10, lineHeight: 21 }]}>{f.a}</Text> : null}
          </Pressable>
        );
      })}

      <Text style={[type.h2, { color: t.text, marginTop: 20, marginBottom: 10 }]}>Send us a message</Text>
      <View style={{ gap: 12 }}>
        <SelectField title="Topic" value={topic} onChange={setTopic} options={TOPICS} />
        {!user ? <Input placeholder="Your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /> : null}
        <Input placeholder="How can we help?" value={message} onChangeText={setMessage} multiline numberOfLines={5} style={{ minHeight: 110, textAlignVertical: "top" }} />
        <Button label={busy ? "Sending…" : "Send message"} onPress={send} loading={busy} />
      </View>
    </FormScreen>
  );
}
