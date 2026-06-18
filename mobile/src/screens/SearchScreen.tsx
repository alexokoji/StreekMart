import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ProductCard, type ProductCardData } from "../components/ProductCard";
import { useTheme } from "../state/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { api, getAuthToken } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SearchResult = ProductCardData;

const FAB_CLEARANCE = 110;

const QUICK_TAGS = [
  "Aso-oke",
  "Ankara",
  "Cosmetics",
  "Sneakers",
  "Bags",
  "Lace",
  "Headwraps",
  "Tailoring",
];

export function SearchScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  async function pickImageAndSearch() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });
      if (picked.canceled || !picked.assets[0]) return;
      setImageSearching(true);
      setResults([]);
      setSuggestions([]);
      const asset = picked.assets[0];
      const form = new FormData();
      const uri = asset.uri;
      const name = uri.split("/").pop() ?? "upload.jpg";
      const mime = asset.mimeType ?? "image/jpeg";
      form.append("file", { uri, name, type: mime } as unknown as Blob);
      const apiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "https://www.streekmart.online";
      const token = await getAuthToken();
      const res = await fetch(apiUrl + "/api/search/image-upload", {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        setHasSubmitted(true);
        setResults(
          data.results.map((r: { id: string; name: string; price: number; salePrice: number | null; image: string | null; sellerName: string }) => ({
            id: r.id,
            name: r.name,
            price: r.price,
            salePrice: r.salePrice,
            image: r.image,
            sellerName: r.sellerName,
          })),
        );
      }
    } catch (err) {
      console.error("[image-search] failed", err);
    } finally {
      setImageSearching(false);
    }
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const data = await api.get<{ suggestions: string[] }>("/api/search/suggest", { q });
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const submit = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setBusy(true);
    setHasSubmitted(true);
    try {
      const data = await api.post<{ results: SearchResult[] }>("/api/search", {
        query,
        source: "text",
      });
      setResults(data.results ?? []);
      setSuggestions([]);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.header}>
        <Text style={[styles.headline, { color: t.text }]}>Search</Text>
      </View>

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchInputWrap,
            { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" },
          ]}
        >
          <Ionicons name="search" size={18} color={t.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={q}
            onChangeText={(v) => {
              setQ(v);
              if (v.length === 0) {
                setHasSubmitted(false);
                setResults([]);
              }
            }}
            onSubmitEditing={() => submit(q)}
            returnKeyType="search"
            placeholder="What are you shopping for?"
            placeholderTextColor={t.textMuted}
            style={[styles.searchInput, { color: t.text }]}
          />
          {q.length > 0 ? (
            <Pressable
              onPress={() => {
                setQ("");
                setHasSubmitted(false);
                setResults([]);
              }}
              hitSlop={8}
            >
              <Text style={{ color: t.textMuted, fontSize: 18 }}>×</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={pickImageAndSearch}
          disabled={imageSearching}
          style={({ pressed }) => [
            styles.cameraBtn,
            { backgroundColor: t.cta, opacity: imageSearching || pressed ? 0.85 : 1 },
          ]}
        >
          {imageSearching ? (
            <Text style={{ color: t.ctaText, fontSize: 18 }}>…</Text>
          ) : (
            <Ionicons name="camera" size={22} color={t.ctaText} />
          )}
        </Pressable>
      </View>

      {busy ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: FAB_CLEARANCE }}
          columnWrapperStyle={{ gap: 12 }}
          ListHeaderComponent={
            <Text style={[type.small, { color: t.textMuted, marginBottom: 4, paddingHorizontal: 4 }]}>
              {results.length} result{results.length === 1 ? "" : "s"} for "{q}"
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => nav.navigate("ProductDetail", { id: item.id })}
              />
            </View>
          )}
        />
      ) : suggestions.length > 0 ? (
        <View style={{ padding: 16 }}>
          <Text style={[type.micro, { color: t.textMuted, letterSpacing: 1.2, marginBottom: 10 }]}>
            SUGGESTIONS
          </Text>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setQ(s);
                submit(s);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: t.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="search" size={18} color={t.textMuted} style={{ marginRight: 10 }} />
              <Text style={[type.body, { color: t.text, flex: 1 }]}>{s}</Text>
              <Ionicons name="arrow-forward" size={16} color={t.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : hasSubmitted ? (
        <View style={styles.centered}>
          <Ionicons name="search-circle-outline" size={56} color={t.textMuted} />
          <Text style={[type.bodyStrong, { color: t.text, marginTop: 12, textAlign: "center" }]}>
            Nothing matched "{q}"
          </Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6, textAlign: "center" }]}>
            Try a shorter phrase or one of the trending tags below.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[type.micro, { color: t.textMuted, letterSpacing: 1.2, marginTop: 6, marginBottom: 10 }]}>
            TRENDING
          </Text>
          <View style={styles.chipWrap}>
            {QUICK_TAGS.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => {
                  setQ(tag);
                  submit(tag);
                }}
                style={({ pressed }) => [
                  styles.tagChip,
                  { backgroundColor: t.accentSoft, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: t.accent, fontWeight: "700" }}>{tag}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[type.small, { color: t.textMuted, marginTop: 24, textAlign: "center", paddingHorizontal: 24 }]}>
            Or tap the camera to search by photo — we'll find lookalikes from sellers near you.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headline: { fontSize: 24, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 48,
    borderRadius: radius.pill,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { padding: 40, alignItems: "center" },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
