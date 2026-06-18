import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";

// User-side verification flow. Mirrors the website's "Get verified"
// page so sellers and designers can apply for the verified badge from
// the app. Approval happens on the web admin dashboard — the mobile
// app only submits the request and shows the current tier status.

type VerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

// Tier ladder mirrors the website. Each tier is unlocked sequentially:
// finishing tier N is the prerequisite for tier N+1. Tier 0 is the
// starting state — every signup is here.
export type TierKey =
  | "email"
  | "phone"
  | "id"
  | "business"
  | "premium";

type Request = {
  status: VerificationStatus;
  reason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  legalName: string;
  governmentIdUrl: string | null;
  businessProofUrl: string | null;
  socialHandle: string | null;
  // Server-truth of which tiers are passed. We default to inferring
  // email-verified from the user object when the endpoint is missing.
  tiers?: Partial<Record<TierKey, boolean>>;
};

const BLANK: Request = {
  status: "NOT_STARTED",
  reason: null,
  submittedAt: null,
  decidedAt: null,
  legalName: "",
  governmentIdUrl: null,
  businessProofUrl: null,
  socialHandle: null,
  tiers: {},
};

const TIER_DEFS: Array<{
  key: TierKey;
  label: string;
  blurb: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}> = [
  { key: "email", label: "Email verified", blurb: "Confirmed your email address", icon: "mail-outline" },
  { key: "phone", label: "Phone verified", blurb: "Confirmed your phone number", icon: "call-outline" },
  { key: "id", label: "ID verified", blurb: "Government ID approved by admin", icon: "card-outline" },
  { key: "business", label: "Business verified", blurb: "Business documents approved", icon: "briefcase-outline" },
  { key: "premium", label: "Premium partner", blurb: "Featured + priority support", icon: "star-outline" },
];

export function VerificationScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<"id" | "proof" | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ request: Request | null }>("/api/verification/me");
      setData(
        r.request ?? {
          ...BLANK,
          legalName: user?.name ?? "",
          tiers: { email: !!user?.emailVerifiedAt },
        },
      );
    } catch {
      // Endpoint absent — infer what we can from the user record.
      setData({
        ...BLANK,
        legalName: user?.name ?? "",
        tiers: { email: !!user?.emailVerifiedAt },
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function patch<K extends keyof Request>(key: K, val: Request[K]) {
    setData((cur) => (cur ? { ...cur, [key]: val } : cur));
  }

  async function pickDoc(kind: "id" | "proof") {
    const [asset] = await pickImages({ multiple: false, allowsEditing: false });
    if (!asset) return;
    setUploading(kind);
    try {
      const url = await uploadImage(asset);
      patch(kind === "id" ? "governmentIdUrl" : "businessProofUrl", url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    if (!data) return;
    if (!data.legalName.trim()) {
      Alert.alert("Almost there", "Add the legal name on your ID.");
      return;
    }
    if (!data.governmentIdUrl) {
      Alert.alert("Almost there", "Upload a photo of a government ID.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/verification/requests", {
        legalName: data.legalName.trim(),
        governmentIdUrl: data.governmentIdUrl,
        businessProofUrl: data.businessProofUrl,
        socialHandle: data.socialHandle?.trim() || null,
      });
      Alert.alert(
        "Submitted",
        "We'll review your request and let you know within 2 business days.",
      );
      await load();
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Verification" />
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }

  const canEdit = data.status === "NOT_STARTED" || data.status === "REJECTED";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Verification" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <StatusBanner status={data.status} reason={data.reason} decidedAt={data.decidedAt} submittedAt={data.submittedAt} />

        <TierLadder tiers={data.tiers ?? {}} pending={data.status === "PENDING"} />

        <Text style={[type.body, { color: t.text, marginTop: 18, lineHeight: 22 }]}>
          A verified badge tells buyers your shop is real. Submit a clear photo of a government ID
          plus something that proves you run the business (CAC certificate, utility bill in the
          business name, etc.).
        </Text>

        <SectionHeader label="Legal name" />
        <Input
          value={data.legalName}
          onChangeText={(v) => patch("legalName", v)}
          editable={canEdit}
          placeholder="Name on your government ID"
        />

        <SectionHeader label="Government ID" />
        <DocSlot
          kind="id"
          url={data.governmentIdUrl}
          uploading={uploading === "id"}
          canEdit={canEdit}
          onPick={() => pickDoc("id")}
          hint="National ID, passport, driver's licence"
        />

        <SectionHeader label="Business proof (optional)" />
        <DocSlot
          kind="proof"
          url={data.businessProofUrl}
          uploading={uploading === "proof"}
          canEdit={canEdit}
          onPick={() => pickDoc("proof")}
          hint="CAC certificate, utility bill, or invoice"
        />

        <SectionHeader label="Social handle (optional)" />
        <Input
          leftIcon={<Ionicons name="logo-instagram" size={18} color={t.textMuted} />}
          value={data.socialHandle ?? ""}
          onChangeText={(v) => patch("socialHandle", v.replace(/^@/, ""))}
          editable={canEdit}
          autoCapitalize="none"
          placeholder="instagram, X, or TikTok handle"
        />

        {canEdit ? (
          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.cta, opacity: submitting ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
              {submitting ? "Submitting…" : data.status === "REJECTED" ? "Resubmit" : "Submit for review"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function TierLadder({
  tiers,
  pending,
}: {
  tiers: Partial<Record<TierKey, boolean>>;
  pending: boolean;
}) {
  const t = useTheme();
  // The "current" tier is the highest one that's NOT passed yet (so the
  // user knows what's still required). If they're pending, we don't
  // highlight a current — the queue is in admin's hands.
  let currentIdx = TIER_DEFS.findIndex((d) => !tiers[d.key]);
  if (currentIdx === -1) currentIdx = TIER_DEFS.length; // all done
  const passedCount = TIER_DEFS.filter((d) => tiers[d.key]).length;

  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.ladderHead}>
        <Text style={[type.h2, { color: t.text }]}>Verification tiers</Text>
        <Text style={[type.small, { color: t.textMuted }]}>
          {passedCount} / {TIER_DEFS.length} complete
        </Text>
      </View>
      <View style={[styles.ladderCard, { backgroundColor: t.card, borderColor: t.border }]}>
        {TIER_DEFS.map((def, i) => {
          const passed = !!tiers[def.key];
          const isCurrent = !pending && i === currentIdx;
          const last = i === TIER_DEFS.length - 1;
          const dotColor = passed ? t.success.fg : isCurrent ? t.cta : t.border;
          const labelColor = passed ? t.text : isCurrent ? t.text : t.textMuted;
          return (
            <View key={def.key} style={[styles.tierRow, !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.tierRail}>
                <View
                  style={[
                    styles.tierDot,
                    {
                      backgroundColor: dotColor,
                      borderColor: isCurrent ? t.cta : "transparent",
                      borderWidth: isCurrent ? 3 : 0,
                    },
                  ]}
                >
                  {passed ? <Ionicons name="checkmark" size={14} color={t.ctaText} /> : null}
                </View>
                {!last ? <View style={[styles.tierLine, { backgroundColor: passed ? t.success.fg : t.border }]} /> : null}
              </View>
              <View style={[styles.tierIcon, { backgroundColor: passed ? t.success.bg : isCurrent ? t.accentSoft : t.bg }]}>
                <Ionicons
                  name={def.icon}
                  size={18}
                  color={passed ? t.success.fg : isCurrent ? t.accent : t.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: labelColor }]}>{def.label}</Text>
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{def.blurb}</Text>
              </View>
              {passed ? (
                <View style={[styles.tierChip, { backgroundColor: t.success.bg }]}>
                  <Text style={{ color: t.success.fg, fontSize: 10, fontWeight: "800" }}>PASSED</Text>
                </View>
              ) : isCurrent ? (
                <View style={[styles.tierChip, { backgroundColor: t.accentSoft }]}>
                  <Text style={{ color: t.accent, fontSize: 10, fontWeight: "800" }}>CURRENT</Text>
                </View>
              ) : pending ? (
                <View style={[styles.tierChip, { backgroundColor: t.warning.bg }]}>
                  <Text style={{ color: t.warning.fg, fontSize: 10, fontWeight: "800" }}>PENDING</Text>
                </View>
              ) : (
                <View style={[styles.tierChip, { backgroundColor: t.bg, borderColor: t.border, borderWidth: 1 }]}>
                  <Text style={{ color: t.textMuted, fontSize: 10, fontWeight: "800" }}>LOCKED</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StatusBanner({
  status,
  reason,
  submittedAt,
  decidedAt,
}: {
  status: VerificationStatus;
  reason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
}) {
  const t = useTheme();
  const cfg = {
    NOT_STARTED: { fg: t.text, bg: t.accentSoft, icon: "shield-outline" as const, title: "Not verified yet", sub: "Submit your details below to apply." },
    PENDING: { fg: t.warning.fg, bg: t.warning.bg, icon: "time-outline" as const, title: "Under review", sub: submittedAt ? `Submitted ${new Date(submittedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}` : "Hang tight — we usually review within 2 business days." },
    APPROVED: { fg: t.success.fg, bg: t.success.bg, icon: "shield-checkmark" as const, title: "Verified", sub: decidedAt ? `Approved ${new Date(decidedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}` : "Your shop has the verified badge." },
    REJECTED: { fg: t.danger.fg, bg: t.danger.bg, icon: "close-circle-outline" as const, title: "Needs another look", sub: reason ?? "We couldn't verify with the documents provided. You can resubmit below." },
  }[status];

  return (
    <View style={[styles.banner, { backgroundColor: cfg.bg }]}>
      <View style={[styles.bannerIcon, { backgroundColor: "rgba(255,255,255,0.45)" }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: cfg.fg }]}>{cfg.title}</Text>
        <Text style={[type.small, { color: cfg.fg, opacity: 0.85, marginTop: 2 }]}>
          {cfg.sub}
        </Text>
      </View>
    </View>
  );
}

function DocSlot({
  url,
  uploading,
  canEdit,
  onPick,
  hint,
}: {
  kind: "id" | "proof";
  url: string | null;
  uploading: boolean;
  canEdit: boolean;
  onPick: () => void;
  hint: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPick}
      disabled={!canEdit || uploading}
      style={[styles.docSlot, { backgroundColor: t.card, borderColor: t.border }]}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.docImg} contentFit="cover" />
      ) : (
        <View style={styles.docEmpty}>
          <Ionicons
            name={uploading ? "cloud-upload-outline" : "document-attach-outline"}
            size={28}
            color={t.textMuted}
          />
          <Text style={[type.body, { color: t.text, marginTop: 8 }]}>
            {uploading ? "Uploading…" : "Tap to upload"}
          </Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 2, textAlign: "center" }]}>
            {hint}
          </Text>
        </View>
      )}
      {url && canEdit ? (
        <View style={[styles.replaceHint, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Ionicons name="camera-outline" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Replace</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Text style={[type.micro, { color: t.textMuted, letterSpacing: 1.2, marginTop: 22, marginBottom: 8 }]}>
      {label.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 80 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  docSlot: {
    height: 170,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  docImg: { width: "100%", height: "100%" },
  docEmpty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, borderStyle: "dashed" },
  replaceHint: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ladderHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  ladderCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  tierRail: { width: 24, alignItems: "center" },
  tierDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tierLine: { width: 2, flex: 1, minHeight: 28, marginTop: 2 },
  tierIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tierChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
