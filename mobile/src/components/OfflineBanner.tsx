import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Network from "expo-network";
import { useTheme } from "../state/ThemeContext";
import { type } from "../theme/tokens";

// Thin banner that renders at the top of HomeScreen when the device
// reports no connectivity. Polls every 8s -- expo-network doesn't expose
// a subscription on managed builds so a poll is the simplest stable
// signal.
export function OfflineBanner() {
  const t = useTheme();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) setOnline(!!state.isConnected && !!state.isInternetReachable);
      } catch {
        if (!cancelled) setOnline(true); // optimistic on error
      }
    }
    check();
    const handle = setInterval(check, 8_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  if (online) return null;

  return (
    <View style={[styles.banner, { backgroundColor: t.warning.bg }]}>
      <Text style={[type.small, { color: t.warning.fg, fontWeight: "600", textAlign: "center" }]}>
        You're offline -- showing the last known data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 12, paddingVertical: 8 },
});