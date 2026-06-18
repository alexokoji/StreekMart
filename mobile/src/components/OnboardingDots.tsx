import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../state/ThemeContext";

// Pill-style page indicator. The active dot is wider than the inactive
// ones so the current step reads at a glance. Used on the multi-step
// onboarding flow.
export function OnboardingDots({ count, active }: { count: number; active: number }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? t.cta : t.border,
                width: isActive ? 22 : 8,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
