import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";

// Seller / designer verification — same two-step flow as the website's
// VerificationPanel, on the same endpoints:
//   GET  /api/verifications            the user's requests
//   POST /api/verifications            file a Tier 2 or Tier 3 request
// Tier 2 (blue check): NIN / passport / driver's licence + a photo of it.
// Tier 3 (gold check): CAC document + optional storefront photo.
// Tier values come from /api/me (sellerTier / designerTier).

type Kind = "SELLER" | "DESIGNER";
type Req = {
  id: string;
  kind: Kind;
  tier: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  createdAt: string;
};
type Me = {
  isSeller: boolean;
  isDesigner: boolean;
  sellerTier: number;
  designerTier: number;
};

const ID_TYPES = [
  { value: "NIN", label: "National ID number (NIN)" },
  { value: "PASSPORT", label: "International passport" },
  { value: "DRIVERS_LICENSE", label: "Driver's licence" },
];

export function VerificationScreen() {
  const t = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [kind, setKind] = useState<Kind>("SELLER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([
        api.get<{ user: Me | null }>("/api/me"),
        api.get<{ requests: Req[] }>("/api/verifications"),
      ]);
      if (m.user) {
        setMe(m.user);
        setKind((cur) => (cur === "SELLER" && !m.user!.isSeller && m.user!.isDesigner ? "DESIGNER" : cur));
      }
      setRequests(r.requests ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your verification status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <FormScreen title="Verification">
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      </FormScreen>
    );
  }
  if (!me || (!me.isSeller && !me.isDesigner)) {
    return (
      <FormScreen title="Verification">
        <Text style={[type.body, { color: t.textMuted }]}>
          {error ?? "Verification is for sellers and designers. Become one from your account first."}
        </Text>
      </FormScreen>
    );
  }

  const tier = kind === "SELLER" ? me.sellerTier : me.designerTier;
  const mine = requests.filter((r) => r.kind === kind);
  const pending2 = mine.find((r) => r.tier === 2 && r.status === "PENDING");
  const pending3 = mine.find((r) => r.tier === 3 && r.status === "PENDING");

  return (
    <FormScreen title="Verification">
      {me.isSeller && me.isDesigner && (
        <View style={styles.switch}>
          {(["SELLER", "DESIGNER"] as Kind[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[styles.seg, { backgroundColor: kind === k ? t.cta : t.card, borderColor: t.border }]}
            >
              <Text style={{ color: kind === k ? t.ctaText : t.text, fontWeight: "700" }}>
                {k === "SELLER" ? "Seller" : "Designer"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.banner, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="shield-checkmark-outline" size={26} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]}>
            Tier {tier}
            {tier === 1 ? " · unverified" : tier === 2 ? " · verified" : " · gold verified"}
          </Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
            {tier === 1
              ? "Verify your identity to list products, pay lower fees and earn the verified badge."
              : tier === 2
                ? "Upgrade to Tier 3 for the gold badge, 100 listings and a 1.5% withdrawal fee."
                : "Top tier: gold badge, 100 listings and the lowest withdrawal fee."}
          </Text>
        </View>
      </View>

      <Tier2Card kind={kind} tier={tier} pending={!!pending2} onDone={load} />
      <Tier3Card kind={kind} tier={tier} pending={!!pending3} onDone={load} />

      {mine.length > 0 && (
        <>
          <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 8 }]}>History</Text>
          {mine.map((r) => (
            <View key={r.id} style={[styles.hist, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>Tier {r.tier}</Text>
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  {new Date(r.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                </Text>
              </View>
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 12,
                  color: r.status === "APPROVED" ? t.success.fg : r.status === "REJECTED" ? t.danger.fg : t.warning.fg,
                }}
              >
                {r.status}
              </Text>
            </View>
          ))}
        </>
      )}
    </FormScreen>
  );
}

function Card({ title, locked, children }: { title: string; locked?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: locked ? 0.65 : 1 }]}>
      <Text style={[type.h2, { color: t.text }]}>{title}</Text>
      {locked ? <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>{locked}</Text> : <View style={{ gap: 12, marginTop: 12 }}>{children}</View>}
    </View>
  );
}

function DocPicker({ label, url, busy, onPick }: { label: string; url: string | null; busy: boolean; onPick: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPick} style={[styles.doc, { borderColor: t.border, backgroundColor: t.bg }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : busy ? (
        <ActivityIndicator color={t.cta} />
      ) : (
        <>
          <Ionicons name="camera-outline" size={22} color={t.textMuted} />
          <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function useUpload() {
  const [busy, setBusy] = useState(false);
  const pick = async (set: (u: string) => void) => {
    const [asset] = await pickImages({ multiple: false, allowsEditing: false });
    if (!asset) return;
    setBusy(true);
    try {
      set(await uploadImage(asset));
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, pick };
}

function Tier2Card({ kind, tier, pending, onDone }: { kind: Kind; tier: number; pending: boolean; onDone: () => void }) {
  const [idType, setIdType] = useState("NIN");
  const [idNumber, setIdNumber] = useState("");
  const [doc, setDoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = useUpload();

  const done = tier >= 2;
  async function submit() {
    if (idNumber.trim().length < 4) return Alert.alert("Almost there", "Enter your ID number.");
    if (!doc) return Alert.alert("Almost there", "Upload a clear photo of your ID.");
    setBusy(true);
    try {
      await api.post("/api/verifications", { kind, tier: 2, idType, idNumber: idNumber.trim(), idDocumentUrl: doc });
      Alert.alert("Submitted", "We'll review your ID and let you know.");
      onDone();
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title="Tier 2 · Verify your identity"
      locked={done ? "Done. Your identity is verified." : pending ? "Pending review. We'll notify you when it's decided." : undefined}
    >
      <SelectField title="ID type" value={idType} onChange={setIdType} options={ID_TYPES} />
      <Input placeholder="ID number" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />
      <DocPicker label="Photo of your ID" url={doc} busy={up.busy} onPick={() => up.pick(setDoc)} />
      <Button label={busy ? "Submitting…" : "Submit for review"} onPress={submit} loading={busy} />
    </Card>
  );
}

function Tier3Card({ kind, tier, pending, onDone }: { kind: Kind; tier: number; pending: boolean; onDone: () => void }) {
  const [cac, setCac] = useState<string | null>(null);
  const [store, setStore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upCac = useUpload();
  const upStore = useUpload();

  async function submit() {
    if (!cac) return Alert.alert("Almost there", "Upload your CAC certificate.");
    setBusy(true);
    try {
      await api.post("/api/verifications", { kind, tier: 3, cacDocumentUrl: cac, ...(store ? { storeImageUrl: store } : {}) });
      Alert.alert("Submitted", "We'll review your business documents.");
      onDone();
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title="Tier 3 · Verify your business"
      locked={
        tier >= 3
          ? "Done. You have the gold badge."
          : tier < 2
            ? "Unlocks after Tier 2 is approved."
            : pending
              ? "Pending review. We'll notify you when it's decided."
              : undefined
      }
    >
      <DocPicker label="CAC certificate" url={cac} busy={upCac.busy} onPick={() => upCac.pick(setCac)} />
      <DocPicker label="Storefront photo (optional)" url={store} busy={upStore.busy} onPick={() => upStore.pick(setStore)} />
      <Button label={busy ? "Submitting…" : "Submit for review"} onPress={submit} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: "row", gap: 8, marginBottom: 12 },
  seg: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  banner: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: radius.md, marginBottom: 14 },
  card: { padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  doc: { height: 130, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hist: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
});
