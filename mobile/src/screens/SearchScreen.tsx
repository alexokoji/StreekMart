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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { ProductCard, type ProductCardData } from "../components/ProductCard";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SearchResult = ProductCardData;

export function SearchScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced suggestion lookup
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

  const submit = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setBusy(true);
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
    },
    [],
  );

  return (
    <Screen padding={false} keyboard>
      <View style={[styles.searchHeader, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => submit(q)}
          autoFocus
          returnKeyType="search"
          placeholder="What are you shopping for?"
          placeholderTextColor={t.textMuted}
          style={[styles.searchInput, { color: t.text, backgroundColor: t.bg }]}
        />
      </View>

      {busy ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
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
          <Text style={[type.small, { color: t.textMuted, marginBottom: 8 }]}>Suggestions</Text>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setQ(s);
                submit(s);
              }}
              style={[styles.suggestion, { borderColor: t.border }]}
            >
              <Text style={[type.body, { color: t.text }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={[type.body, { color: t.textMuted }]}>
            Type a few words to start.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { padding: 32, alignItems: "center" },
  searchHeader: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    fontSize: 14,
  },
  suggestion: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
