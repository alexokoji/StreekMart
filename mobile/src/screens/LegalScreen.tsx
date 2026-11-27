import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Terms and Privacy Policy, drawn natively from the same text the website
// shows (GET /api/legal/privacy|terms). Nothing opens a browser.
type Block = { t: "h2" | "h3" | "p" | "li"; x: string };
type Doc = { title: string; updated: string; blocks: Block[] };

export function LegalScreen() {
  const t = useTheme();
  const { doc } = useRoute<RouteProp<RootStackParamList, "Legal">>().params;
  const [data, setData] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Doc>(`/api/legal/${doc}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this page."));
  }, [doc]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={doc === "terms" ? "Terms" : "Privacy policy"} />
      {!data && !error ? (
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[type.body, { color: t.textMuted, padding: 20 }]}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          <Text style={[type.display, { color: t.text }]}>{data!.title}</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 6, marginBottom: 8 }]}>
            Last updated: {data!.updated}
          </Text>
          {data!.blocks.map((b, i) =>
            b.t === "h2" ? (
              <Text key={i} style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 6 }]}>{b.x}</Text>
            ) : b.t === "h3" ? (
              <Text key={i} style={[type.bodyStrong, { color: t.text, fontSize: 16, marginTop: 16, marginBottom: 4 }]}>{b.x}</Text>
            ) : b.t === "li" ? (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                <Text style={[type.bodyLg, { color: t.textMuted }]}>•</Text>
                <Text style={[type.bodyLg, { color: t.textMuted, flex: 1, lineHeight: 23 }]}>{b.x}</Text>
              </View>
            ) : (
              <Text key={i} style={[type.bodyLg, { color: t.textMuted, lineHeight: 23, marginBottom: 10 }]}>{b.x}</Text>
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}
