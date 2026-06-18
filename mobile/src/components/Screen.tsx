// Themed Screen wrapper — every screen wraps its content in <Screen> so
// the background, safe-area insets, and scroll behaviour stay consistent.

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../state/ThemeContext";

export function Screen({
  children,
  scroll = false,
  refreshControl,
  contentStyle,
  edges = ["top"],
  keyboard = false,
  padding = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: ViewStyle;
  edges?: Array<"top" | "bottom" | "left" | "right">;
  keyboard?: boolean;
  padding?: boolean;
}) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        padding ? styles.padded : null,
        contentStyle,
      ]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding ? styles.padded : null, contentStyle]}>
      {children}
    </View>
  );

  const inner = keyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: t.bg }]}>
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { padding: 16, paddingBottom: 32 },
});
