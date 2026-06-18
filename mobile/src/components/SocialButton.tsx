import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { AppleIcon, FacebookIcon, GoogleIcon } from "./brandIcons";

export type OAuthProvider = "google" | "apple" | "facebook";

// Circular brand-icon button. Shows a spinner while `loading` so the
// user knows the OAuth sheet is opening / a token is being exchanged.
export function SocialButton({
  provider,
  onPress,
  loading,
  disabled,
}: {
  provider: OAuthProvider;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: t.border,
          backgroundColor: t.card,
          opacity: isDisabled ? 0.55 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.text} size="small" />
      ) : (
        <Glyph provider={provider} />
      )}
    </Pressable>
  );
}

function Glyph({ provider }: { provider: OAuthProvider }) {
  const t = useTheme();
  if (provider === "google") return <GoogleIcon size={26} />;
  if (provider === "facebook") return <FacebookIcon size={26} />;
  // Apple silhouette adapts to the current scheme so it's visible on both light + dark.
  return <AppleIcon size={26} color={t.scheme === "dark" ? "#fff" : "#000"} />;
}

const styles = StyleSheet.create({
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
