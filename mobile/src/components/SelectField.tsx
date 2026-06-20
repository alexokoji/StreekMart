// Generic single-select dropdown rendered as a bottom sheet.
//
// Same visual language as CategoryPicker (tap a field, sheet slides up,
// pick a row, sheet closes). Used wherever the value comes from a small
// known list — pricing units, product status, payment kinds — so each
// caller doesn't have to roll its own modal.

import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Pick one",
  title = "Pick one",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[
          styles.field,
          {
            backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6",
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[type.body, { color: selected ? t.text : t.textMuted, flex: 1 }]}
          numberOfLines={1}
        >
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: t.bg }]}>
            <View style={styles.sheetHead}>
              <Text style={[type.h2, { color: t.text }]}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={t.text} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: active ? t.accentSoft : pressed ? t.card : "transparent",
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: t.text }]}>{item.label}</Text>
                      {item.hint ? (
                        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                          {item.hint}
                        </Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color={t.accent} style={{ marginLeft: 8 }} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
});
