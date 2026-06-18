import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

// Single text field with optional left icon glyph and an optional
// right-side affordance (e.g. eye toggle for passwords). Visual style is
// a soft-grey filled pill with the icon tinted to the muted text colour
// -- mirrors the auth flow shots from the new Figma reference but with
// our violet brand instead of coral on the focus ring.
export type InputProps = TextInputProps & {
  // Left icon -- pass a glyph character (single emoji / unicode symbol)
  // or any React node. Hidden when undefined.
  leftIcon?: React.ReactNode;
  // Optional element rendered at the right edge of the field. Used for
  // the password "eye" toggle on Login/Register.
  rightAccessory?: React.ReactNode;
  containerStyle?: ViewStyle;
  // Adds a subtle violet border + slight shadow when true, matching the
  // "selected card" treatment from the Checkout screen.
  highlighted?: boolean;
};

export function Input({
  leftIcon,
  rightAccessory,
  containerStyle,
  highlighted,
  ...rest
}: InputProps) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6",
          borderColor: highlighted ? t.cta : "transparent",
          borderWidth: highlighted ? 1.5 : 0,
        },
        containerStyle,
      ]}
    >
      {leftIcon != null && (
        <View style={styles.leftIcon}>
          {typeof leftIcon === "string" ? (
            <Text style={{ color: t.textMuted, fontSize: 16 }}>{leftIcon}</Text>
          ) : (
            leftIcon
          )}
        </View>
      )}
      <TextInput
        placeholderTextColor={t.textMuted}
        {...rest}
        style={[styles.input, { color: t.text }, rest.style]}
      />
      {rightAccessory != null && <View style={styles.right}>{rightAccessory}</View>}
    </View>
  );
}

// Password-specific input. Wraps Input with a built-in show/hide toggle.
export function PasswordInput(props: Omit<InputProps, "secureTextEntry" | "rightAccessory">) {
  const t = useTheme();
  const [revealed, setRevealed] = useState(false);
  return (
    <Input
      {...props}
      secureTextEntry={!revealed}
      autoCapitalize="none"
      autoCorrect={false}
      rightAccessory={
        <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={10}>
          <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={18} color={t.textMuted} />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 54,
    borderRadius: radius.md,
  },
  leftIcon: { marginRight: 10, width: 22, alignItems: "center" },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0, // RN adds vertical padding on Android by default; flatten so height controls
  },
  right: { marginLeft: 10 },
});
