// Dropdown-style category picker.
//
// Fetches /api/categories on focus and presents the list in a bottom
// sheet. Used by the AddProduct form where the seller has to pick from
// the existing category set (matches the website's behaviour — a free
// text field would let typos creep into the catalog).

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

type Category = { id?: string; name: string; group?: string | null };

export function CategoryPicker({
  value,
  onChange,
  placeholder = "Pick a category",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ categories: Category[] }>("/api/categories");
      setCategories(data.categories ?? []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && categories.length === 0) load();
  }, [open, categories.length, load]);

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : categories;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" },
        ]}
      >
        <Text style={[type.body, { color: value ? t.text : t.textMuted, flex: 1 }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: t.bg }]}>
            <View style={styles.sheetHead}>
              <Text style={[type.h2, { color: t.text }]}>Pick a category</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={t.text} />
              </Pressable>
            </View>
            <View
              style={[
                styles.search,
                { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" },
              ]}
            >
              <Ionicons name="search" size={18} color={t.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search categories"
                placeholderTextColor={t.textMuted}
                style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 0 }}
                autoCapitalize="none"
              />
            </View>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={t.cta} size="large" />
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.centered}>
                <Ionicons name="albums-outline" size={36} color={t.textMuted} />
                <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>
                  {query ? "No matches" : "No categories yet"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(c, i) => c.id ?? `${c.name}-${i}`}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const selected = item.name === value;
                  return (
                    <Pressable
                      onPress={() => {
                        onChange(item.name);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          backgroundColor: selected ? t.accentSoft : pressed ? t.card : "transparent",
                        },
                      ]}
                    >
                      <Text style={[type.body, { color: t.text, flex: 1 }]}>{item.name}</Text>
                      {item.group ? (
                        <Text style={[type.small, { color: t.textMuted }]}>{item.group}</Text>
                      ) : null}
                      {selected ? (
                        <Ionicons name="checkmark" size={20} color={t.accent} style={{ marginLeft: 8 }} />
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 54,
    borderRadius: radius.md,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 12,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.pill,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  centered: { padding: 32, alignItems: "center" },
});
