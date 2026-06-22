import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";

// Mirrors the editable subset of /api/account/profile — see the web
// PATCH route for the source of truth. acceptingCommissions, website
// and instagram aren't first-class user fields, so they don't persist
// here; the web profile page is the same way.
type DesignerProfile = {
  name: string;
  businessName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
};

const EMPTY: DesignerProfile = {
  name: "",
  businessName: null,
  bio: null,
  avatarUrl: null,
  coverImageUrl: null,
};

export function DesignerProfileScreen() {
  const t = useTheme();
  const [profile, setProfile] = useState<DesignerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);

  const load = useCallback(async () => {
    try {
      // Same source the web uses — GET /api/me returns the current
      // user with every field this screen needs.
      const data = await api.get<{ user: DesignerProfile | null }>("/api/me");
      setProfile(
        data.user
          ? {
              name: data.user.name ?? "",
              businessName: data.user.businessName ?? null,
              bio: data.user.bio ?? null,
              avatarUrl: data.user.avatarUrl ?? null,
              coverImageUrl: data.user.coverImageUrl ?? null,
            }
          : EMPTY,
      );
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
      patch(kind === "avatar" ? "avatarUrl" : "coverImageUrl", url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!profile) return;
    if (!profile.name.trim()) {
      Alert.alert("Almost there", "Add a display name.");
      return;
    }
    setSaving(true);
    try {
      // /api/account/profile is the canonical PATCH route; only the
      // fields the server schema accepts go on the wire.
      await api.patch("/api/account/profile", {
        name: profile.name.trim(),
        bio: profile.bio ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        coverImageUrl: profile.coverImageUrl ?? "",
        // businessName is server-side locked once set — only send it
        // when the user actually has a value to commit.
        ...(profile.businessName?.trim()
          ? { businessName: profile.businessName.trim() }
          : {}),
      });
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
          {profile.coverImageUrl ? (
            <Image source={{ uri: profile.coverImageUrl }} style={styles.bannerImg} contentFit="cover" />
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
              value={profile.name}
              onChangeText={(v) => patch("name", v)}
              placeholder="The name on your portfolio"
            />
          </Field>
          <Field label="Business name">
            <Input
              value={profile.businessName ?? ""}
              onChangeText={(v) => patch("businessName", v)}
              placeholder="Brand or shop name"
              editable={!profile.businessName}
            />
            {profile.businessName ? (
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                Locked. Submit a change request from your shop settings to update it.
              </Text>
            ) : null}
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
