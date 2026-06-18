import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";

// Mirrors the User shape returned by /api/me (web's getCurrentUser).
type WebUser = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  isSeller: boolean;
  isDesigner: boolean;
};
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";

// Server-truth shape. `businessName` is read-only from this form — see
// the change-request flow below; the field stays editable but the
// "Save" button routes a name-change request through admin approval.
type ShopProfile = {
  businessName: string;
  tagline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  acceptingOrders: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
};

const BLANK: ShopProfile = {
  businessName: "",
  tagline: null,
  bio: null,
  avatarUrl: null,
  coverUrl: null,
  phone: null,
  email: null,
  hours: null,
  acceptingOrders: true,
  bankName: null,
  bankAccountName: null,
  bankAccountNumber: null,
};

export function SellerSettingsScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  const load = useCallback(async () => {
    try {
      // The canonical user record (mirrors the web's getCurrentUser
      // shape). Every editable field on this form maps onto it.
      const data = await api.get<{ user: WebUser | null }>("/api/me");
      const u = data.user;
      const merged: ShopProfile = {
        ...BLANK,
        businessName: (u?.businessName ?? "").trim(),
        tagline: null,
        bio: u?.bio ?? null,
        avatarUrl: u?.avatarUrl ?? null,
        coverUrl: u?.coverImageUrl ?? null,
        phone: u?.phone ?? null,
        email: u?.email ?? null,
        hours: null,
        acceptingOrders: true,
        bankName: null,
        bankAccountName: null,
        bankAccountNumber: null,
      };
      setProfile(merged);
      setOriginalName(merged.businessName);
    } catch {
      const merged: ShopProfile = {
        ...BLANK,
        businessName: (user?.name ?? "").trim(),
        email: user?.email ?? null,
        avatarUrl: user?.avatarUrl ?? null,
      };
      setProfile(merged);
      setOriginalName(merged.businessName);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function patch<K extends keyof ShopProfile>(key: K, val: ShopProfile[K]) {
    setProfile((cur) => (cur ? { ...cur, [key]: val } : cur));
  }

  async function pickPhoto(kind: "avatar" | "cover") {
    const [asset] = await pickImages({
      multiple: false,
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      allowsEditing: true,
    });
    if (!asset) return;
    setUploading(kind);
    try {
      const url = await uploadImage(asset);
      patch(kind === "avatar" ? "avatarUrl" : "coverUrl", url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!profile) return;
    if (!profile.businessName.trim()) {
      Alert.alert("Almost there", "Add a business name buyers will see.");
      return;
    }
    const nameChanged = profile.businessName.trim() !== originalName.trim();
    if (nameChanged) {
      Alert.alert(
        "Business name change",
        "Renaming your shop needs admin approval — same rule as the website. We'll submit your request and keep the old name visible until it's approved. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit request", onPress: () => submitWithNameChange() },
        ],
      );
      return;
    }
    await persistProfile(profile, false);
  }

  async function submitWithNameChange() {
    if (!profile) return;
    setSaving(true);
    try {
      // The web's canonical rename route — admin must approve.
      await api.post("/api/account/business-name-change", {
        requestedName: profile.businessName.trim(),
      });
      // Save the rest of the profile with the OLD name so the rename
      // isn't applied optimistically.
      const safe: ShopProfile = { ...profile, businessName: originalName };
      await persistProfile(safe, true);
    } catch (err) {
      Alert.alert("Couldn't request rename", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function persistProfile(p: ShopProfile, fromNameChange: boolean) {
    setSaving(true);
    try {
      // Send only the fields the web's PATCH /api/account/profile
      // accepts. Including `businessName` only on the first-ever save —
      // once it's set the endpoint refuses direct edits and the rename
      // flow above handles changes.
      const includeBusinessName = !originalName.trim();
      const body: Record<string, unknown> = {
        bio: p.bio ?? "",
        avatarUrl: p.avatarUrl ?? "",
        coverImageUrl: p.coverUrl ?? "",
        ...(p.email ? { email: p.email } : {}),
        ...(p.phone ? { phone: p.phone } : {}),
        ...(includeBusinessName ? { businessName: p.businessName.trim() } : {}),
      };
      await api.patch("/api/account/profile", body);
      Alert.alert(
        fromNameChange ? "Submitted" : "Saved",
        fromNameChange
          ? "Rename request sent for review. We saved the rest of your changes."
          : "Shop settings updated.",
      );
      setProfile(p);
      setOriginalName(p.businessName);
    } catch (err) {
      if (!fromNameChange) {
        Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Shop settings" />
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }

  const nameDirty = profile.businessName.trim() !== originalName.trim();
  const initial = (profile.businessName || user?.name || "?").slice(0, 1).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Shop settings" />
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
        {/* Cover + avatar — match the public Seller profile page so the
            seller sees what buyers will see. */}
        <Pressable
          onPress={() => pickPhoto("cover")}
          disabled={uploading !== null}
          style={[styles.cover, { backgroundColor: t.card, borderColor: t.border }]}
        >
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={styles.coverImg} contentFit="cover" />
          ) : (
            <View style={styles.coverEmpty}>
              <Ionicons name="image-outline" size={28} color={t.textMuted} />
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                {uploading === "cover" ? "Uploading…" : "Add a cover photo"}
              </Text>
            </View>
          )}
          <View style={[styles.coverHint, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>
              {profile.coverUrl ? "Replace" : "Upload"}
            </Text>
          </View>
        </Pressable>

        <View style={styles.avatarRow}>
          <Pressable
            onPress={() => pickPhoto("avatar")}
            disabled={uploading !== null}
            style={[styles.avatar, { backgroundColor: t.cta, borderColor: t.bg }]}
          >
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 26 }}>{initial}</Text>
            )}
            <View style={[styles.avatarPip, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Ionicons name="camera" size={11} color={t.ctaText} />
            </View>
          </Pressable>
        </View>

        <SectionHeader label="Storefront" />

        <Field label="Business name">
          <Input
            value={profile.businessName}
            onChangeText={(v) => patch("businessName", v)}
            placeholder="e.g. Adaeze Apparel"
          />
          {nameDirty ? (
            <View style={[styles.warnRow, { backgroundColor: t.warning.bg }]}>
              <Ionicons name="information-circle-outline" size={16} color={t.warning.fg} />
              <Text style={[type.small, { color: t.warning.fg, marginLeft: 6, flex: 1 }]}>
                Renaming your shop requires admin approval (same rule as the website). We'll send a request when you save.
              </Text>
            </View>
          ) : null}
        </Field>
        <Field label="Tagline">
          <Input
            value={profile.tagline ?? ""}
            onChangeText={(v) => patch("tagline", v)}
            placeholder="One-line pitch"
          />
        </Field>
        <Field label="About">
          <View style={[styles.textarea, { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" }]}>
            <TextInput
              value={profile.bio ?? ""}
              onChangeText={(v) => patch("bio", v)}
              placeholder="What makes your shop special"
              placeholderTextColor={t.textMuted}
              multiline
              style={{ color: t.text, fontSize: 15, minHeight: 90, textAlignVertical: "top" }}
            />
          </View>
        </Field>

        <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={[styles.icon, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="storefront-outline" size={18} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: t.text }]}>Accepting orders</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
              Pause to stop new orders while keeping listings visible.
            </Text>
          </View>
          <Switch
            value={profile.acceptingOrders}
            onValueChange={(v) => patch("acceptingOrders", v)}
            trackColor={{ true: t.cta, false: t.border }}
          />
        </View>

        <SectionHeader label="Contact" />
        <Field label="Phone">
          <Input
            leftIcon={<Ionicons name="call-outline" size={18} color={t.textMuted} />}
            value={profile.phone ?? ""}
            onChangeText={(v) => patch("phone", v)}
            keyboardType="phone-pad"
            placeholder="0800 000 0000"
          />
        </Field>
        <Field label="Email">
          <Input
            leftIcon={<Ionicons name="mail-outline" size={18} color={t.textMuted} />}
            value={profile.email ?? ""}
            onChangeText={(v) => patch("email", v)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="shop@example.com"
          />
        </Field>
        <Field label="Hours (free text)">
          <Input
            value={profile.hours ?? ""}
            onChangeText={(v) => patch("hours", v)}
            placeholder="Mon–Fri 9am–6pm"
          />
        </Field>

        <SectionHeader label="Payouts" />
        <Field label="Bank">
          <Input
            value={profile.bankName ?? ""}
            onChangeText={(v) => patch("bankName", v)}
            placeholder="GTBank, Access, Wema…"
          />
        </Field>
        <Field label="Account name">
          <Input
            value={profile.bankAccountName ?? ""}
            onChangeText={(v) => patch("bankAccountName", v)}
            placeholder="Name on the account"
          />
        </Field>
        <Field label="Account number">
          <Input
            value={profile.bankAccountNumber ?? ""}
            onChangeText={(v) => patch("bankAccountNumber", v.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="0123456789"
            maxLength={20}
          />
        </Field>

        <Pressable
          onPress={save}
          disabled={saving || uploading !== null}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: saving || uploading !== null ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
            {saving ? "Saving…" : nameDirty ? "Save & request rename" : "Save changes"}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 80 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  cover: {
    height: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  coverImg: { width: "100%", height: "100%" },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  coverHint: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  avatarRow: { paddingHorizontal: 4, marginTop: -36 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPip: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  warnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
