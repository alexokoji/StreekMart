import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";

type DesignerProfile = {
  displayName: string;
  tagline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  website: string | null;
  instagram: string | null;
  acceptingCommissions: boolean;
};

const EMPTY: DesignerProfile = {
  displayName: "",
  tagline: null,
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  website: null,
  instagram: null,
  acceptingCommissions: true,
};

export function DesignerProfileScreen() {
  const t = useTheme();
  const [profile, setProfile] = useState<DesignerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ profile: DesignerProfile }>("/api/designer/profile");
      setProfile(data.profile ?? EMPTY);
    } catch {
      setProfile(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch<K extends keyof DesignerProfile>(key: K, val: DesignerProfile[K]) {
    setProfile((cur) => (cur ? { ...cur, [key]: val } : cur));
  }

  async function pickImage(kind: "avatar" | "banner") {
    const [asset] = await pickImages({
      multiple: false,
      aspect: kind === "avatar" ? [1, 1] : [16, 9],
      allowsEditing: true,
    });
    if (!asset) return;
    setUploading(kind);
    try {
      const url = await uploadImage(asset);
      patch(kind === "avatar" ? "avatarUrl" : "bannerUrl", url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!profile) return;
    if (!profile.displayName.trim()) {
      Alert.alert("Almost there", "Add a display name.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/designer/profile", profile);
      Alert.alert("Saved", "Designer profile updated.");
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Designer profile" />
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Designer profile" />
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
        <Pressable
          onPress={() => pickImage("banner")}
          disabled={uploading !== null}
          style={[styles.banner, { backgroundColor: t.card, borderColor: t.border }]}
        >
          {profile.bannerUrl ? (
            <Image source={{ uri: profile.bannerUrl }} style={styles.bannerImg} contentFit="cover" />
          ) : (
            <View style={styles.bannerEmpty}>
              <Ionicons name="image-outline" size={32} color={t.textMuted} />
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                {uploading === "banner" ? "Uploading…" : "Add cover photo"}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.avatarWrap}>
          <Pressable
            onPress={() => pickImage("avatar")}
            disabled={uploading !== null}
            style={[styles.avatar, { backgroundColor: t.cta, borderColor: t.bg }]}
          >
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={36} color={t.ctaText} />
            )}
            <View style={[styles.avatarPip, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Ionicons name="camera" size={12} color={t.ctaText} />
            </View>
          </Pressable>
        </View>

        <View style={{ marginTop: 16 }}>
          <Field label="Display name">
            <Input
              value={profile.displayName}
              onChangeText={(v) => patch("displayName", v)}
              placeholder="The name on your portfolio"
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={profile.tagline ?? ""}
              onChangeText={(v) => patch("tagline", v)}
              placeholder="One-line about your work"
            />
          </Field>
          <Field label="Bio">
            <View style={[styles.textarea, { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" }]}>
              <TextInput
                value={profile.bio ?? ""}
                onChangeText={(v) => patch("bio", v)}
                placeholder="Your story, influences, materials…"
                placeholderTextColor={t.textMuted}
                multiline
                style={{ color: t.text, fontSize: 15, minHeight: 100, textAlignVertical: "top" }}
              />
            </View>
          </Field>

          <Field label="Website">
            <Input
              leftIcon={<Ionicons name="globe-outline" size={18} color={t.textMuted} />}
              value={profile.website ?? ""}
              onChangeText={(v) => patch("website", v)}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="yourbrand.com"
            />
          </Field>
          <Field label="Instagram handle">
            <Input
              leftIcon={<Ionicons name="logo-instagram" size={18} color={t.textMuted} />}
              value={profile.instagram ?? ""}
              onChangeText={(v) => patch("instagram", v.replace(/^@/, ""))}
              autoCapitalize="none"
              placeholder="yourbrand"
            />
          </Field>

          <View style={[styles.toggleRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={[styles.toggleIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="color-palette-outline" size={18} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]}>Open for commissions</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                Buyers can request custom pieces from your profile.
              </Text>
            </View>
            <Switch
              value={profile.acceptingCommissions}
              onValueChange={(v) => patch("acceptingCommissions", v)}
              trackColor={{ true: t.cta, false: t.border }}
            />
          </View>

          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.cta, opacity: saving ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
              {saving ? "Saving…" : "Save profile"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  banner: {
    height: 140,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  bannerImg: { width: "100%", height: "100%" },
  bannerEmpty: { flex: 1, alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  avatarWrap: { alignItems: "flex-start", marginTop: -38, paddingHorizontal: 6 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  toggleIcon: {
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
