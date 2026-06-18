import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Personal profile editor — distinct from the shop settings screen.
// Available to every signed-in user (buyer, seller, designer) so they
// can change their display name, contact details, and avatar.
export function EditProfileScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickAvatar() {
    const [asset] = await pickImages({
      multiple: false,
      aspect: [1, 1],
      allowsEditing: true,
    });
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset);
      setAvatarUrl(url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      Alert.alert("Almost there", "Add a display name.");
      return;
    }
    setSaving(true);
    try {
      // PATCH /api/account/profile is the canonical web endpoint —
      // accepts name, bio, avatarUrl, coverImageUrl, email, password,
      // slug, phone. Send only what we changed.
      await api.patch("/api/account/profile", {
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        avatarUrl: avatarUrl ?? "",
      });
      await refresh();
      Alert.alert("Saved", "Profile updated.", [{ text: "OK", onPress: () => nav.goBack() }]);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  const initial = (user?.name?.[0] ?? "?").toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Edit profile" />
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
        <View style={styles.avatarRow}>
          <Pressable
            onPress={pickAvatar}
            disabled={uploading}
            style={[styles.avatar, { backgroundColor: t.cta, borderColor: t.bg }]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 36 }}>{initial}</Text>
            )}
            <View style={[styles.avatarPip, { backgroundColor: t.accent, borderColor: t.bg }]}>
              <Ionicons name="camera" size={14} color={t.ctaText} />
            </View>
          </Pressable>
          <Text style={[type.small, { color: t.textMuted, marginTop: 8 }]}>
            {uploading ? "Uploading…" : "Tap to change profile picture"}
          </Text>
        </View>

        <Field label="Display name">
          <Input
            leftIcon={<Ionicons name="person-outline" size={18} color={t.textMuted} />}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
        </Field>
        <Field label="Email">
          <Input
            leftIcon={<Ionicons name="mail-outline" size={18} color={t.textMuted} />}
            value={user?.email ?? ""}
            editable={false}
            placeholder="email@example.com"
          />
          <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
            Email changes go through verification on the website.
          </Text>
        </Field>
        <Field label="Phone">
          <Input
            leftIcon={<Ionicons name="call-outline" size={18} color={t.textMuted} />}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0800 000 0000"
          />
        </Field>

        <Pressable
          onPress={save}
          disabled={saving || uploading}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: saving || uploading ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
            {saving ? "Saving…" : "Save profile"}
          </Text>
        </Pressable>
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
  avatarRow: { alignItems: "center", marginTop: 10, marginBottom: 22 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPip: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
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
