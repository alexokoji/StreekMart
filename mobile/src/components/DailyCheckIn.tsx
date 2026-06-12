import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";

type State = {
  canClaimToday: boolean;
  streak: number;
  pointsBalance: number;
  todayPoints: number;
  weeklyBonus: number;
};

// Pulled into AccountScreen. Shows balance + streak + a claim button.
// The /api/points/check-in endpoint returns identical shape for GET and
// computes streak server-side so the UI stays cheap.
export function DailyCheckIn() {
  const t = useTheme();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<State>("/api/points/check-in");
      setState(data);
    } catch {
      setState(null);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function claim() {
    setBusy(true);
    try {
      const r = await api.post<{ awarded: number; bonusEarned: boolean }>("/api/points/check-in");
      Alert.alert("Claimed", r.bonusEarned ? `+${r.awarded} points (weekly bonus unlocked!)` : `+${r.awarded} points`);
      await load();
    } catch (err) {
      Alert.alert("Couldn't claim", err instanceof Error ? err.message : "Try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  return (
    <View style={[styles.card, { backgroundColor: t.cta }]}>
      <Text style={[type.micro, { color: t.ctaText, opacity: 0.85 }]}>DAILY REWARDS</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <Text style={[type.display, { color: t.ctaText }]}>{state.pointsBalance.toLocaleString()}</Text>
        <Text style={[type.small, { color: t.ctaText, opacity: 0.85 }]}>points</Text>
      </View>
      <Text style={[type.small, { color: t.ctaText, opacity: 0.85, marginTop: 4 }]}>
        {state.streak > 0 ? `${state.streak}-day streak` : "Start a streak today"}
      </Text>
      {state.canClaimToday ? (
        <Pressable
          onPress={claim}
          disabled={busy}
          style={[styles.btn, { backgroundColor: t.ctaText, opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={{ color: t.cta, fontWeight: "700" }}>
            {busy ? "Claiming..." : `Claim today's ${state.todayPoints} points`}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.btn, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          <Text style={{ color: t.ctaText, fontWeight: "600" }}>Already claimed today</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: radius.lg, marginTop: 14 },
  btn: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, alignItems: "center" },
});