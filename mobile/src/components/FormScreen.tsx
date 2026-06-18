// Shared wrapper for form screens.
//
// React Native ScrollViews don't move out of the way when the
// soft keyboard appears — anything below the focused input gets
// covered. Wrapping in KeyboardAvoidingView with the right behavior
// per platform and a `keyboardVerticalOffset` accounting for the
// BackHeader fixes this on iOS, and using "height" behavior on
// Android (matching Expo's recommended pattern) handles it there.
//
// Use this in place of the raw <View><BackHeader /><ScrollView /></View>
// pattern on every form screen.

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BackHeader } from "./BackHeader";
import { useTheme } from "../state/ThemeContext";

export function FormScreen({
  title,
  rightAction,
  children,
  contentStyle,
  // Extra room above the keyboard so the focused input + a peek of the
  // field below it stays visible. Override per screen if needed.
  bottomPad = 80,
  scrollViewProps,
}: {
  title?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bottomPad?: number;
  scrollViewProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle">;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={title} rightAction={rightAction} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16 },
});
