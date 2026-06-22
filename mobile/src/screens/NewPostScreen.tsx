import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { Chip } from "../components/Chip";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUGGESTED_TAGS = ["Ankara", "Lookbook", "Aso-oke", "Bridal", "Streetwear", "Editorial"];

export function NewPostScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleTag(tag: string) {
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  }

  async function pickImage() {
    const [asset] = await pickImages({ multiple: false });
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset);
      setImage(url);
    } catch (err) {
      Alert.alert("Couldn't upload", err instanceof Error ? err.message : "Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!title.trim()) {
      Alert.alert("Almost there", "Add a title.");
      return;
    }
    setBusy(true);
    try {
      // /api/posts POST contract: title, body, images (array), tags
      // (array). Image goes through the upload pipeline first; the
      // returned URL is pushed onto the images array. Same shape the
      // web's PostEditor sends.
      await api.post("/api/posts", {
        title: title.trim(),
        body: body.trim(),
        images: image ? [image] : [],
        tags,
      });
      Alert.alert("Posted", "Your post is live.", [{ text: "OK", onPress: () => nav.goBack() }]);
    } catch (err) {
      Alert.alert("Couldn't publish", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="New post" />
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
          onPress={pickImage}
          disabled={uploading}
          style={({ pressed }) => [
            styles.heroSlot,
            {
              backgroundColor: t.card,
              borderColor: t.border,
              opacity: pressed || uploading ? 0.85 : 1,
            },
          ]}
        >
          {image ? (
            <>
              <Image source={{ uri: image }} style={styles.heroImg} contentFit="cover" />
              <View style={[styles.swapHint, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Replace</Text>
              </View>
            </>
          ) : (
            <View style={styles.heroEmpty}>
              <Ionicons
                name={uploading ? "cloud-upload-outline" : "image-outline"}
                size={42}
                color={t.textMuted}
              />
              <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]}>
                {uploading ? "Uploading…" : "Add a hero photo"}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                Tap to choose from your library
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ marginTop: 18 }}>
          <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Title</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Name your drop" />
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Caption</Text>
          <View style={[styles.textarea, { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" }]}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Tell the story behind this look"
              placeholderTextColor={t.textMuted}
              multiline
              style={{ color: t.text, fontSize: 15, minHeight: 110, textAlignVertical: "top" }}
            />
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>Tags</Text>
          <View style={styles.chipWrap}>
            {SUGGESTED_TAGS.map((tag) => (
              <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
        </View>

        <Pressable
          onPress={publish}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: busy ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
            {busy ? "Publishing…" : "Publish post"}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 80 },
  heroSlot: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  heroImg: { width: "100%", height: "100%" },
  heroEmpty: { flex: 1, alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  swapHint: {
    position: "absolute",
    bottom: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
  },
  textarea: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
