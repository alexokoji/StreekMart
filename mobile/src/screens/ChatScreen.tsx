import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  body: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
};

// Polling cadence: 5s when the chat is focused. Fast enough that
// responses feel near-real-time without burning battery. The web app
// uses the same polling pattern.
const POLL_MS = 5_000;

export function ChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "Chat">>();
  const { id: chatId } = route.params;
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    nav.setOptions({ title: route.params.counterpartName ?? "Chat" });
  }, [nav, route.params.counterpartName]);

  const fetchNew = useCallback(async () => {
    try {
      const url = cursorRef.current
        ? `/api/chats/${chatId}/messages?after=${encodeURIComponent(cursorRef.current)}`
        : `/api/chats/${chatId}/messages`;
      const data = await api.get<{ newMessages?: Message[]; messages?: Message[] }>(url);
      const incoming: Message[] = (data.newMessages ?? data.messages ?? []) as Message[];
      if (incoming.length > 0) {
        cursorRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((cur) => {
          const seen = new Set(cur.map((m) => m.id));
          const merged = [...cur];
          for (const m of incoming) {
            if (!seen.has(m.id)) merged.push(m);
          }
          return merged;
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Initial fetch + poll loop. We don't have websockets so we lean on a
  // 5s tick; the server's GET supports an `after=` cursor so each tick
  // only pulls genuinely new rows.
  useEffect(() => {
    fetchNew();
    const handle = setInterval(fetchNew, POLL_MS);
    return () => clearInterval(handle);
  }, [fetchNew]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/chats/${chatId}/messages`, { body: body.trim() });
      setBody("");
      await fetchNew();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={t.cta} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = user && item.senderId === user.id;
            return (
              <View style={[
                styles.bubbleRow,
                { justifyContent: mine ? "flex-end" : "flex-start" },
              ]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? t.cta : t.card,
                      borderColor: t.border,
                      borderTopRightRadius: mine ? 4 : radius.md,
                      borderTopLeftRadius: mine ? radius.md : 4,
                    },
                  ]}
                >
                  <Text style={[type.body, { color: mine ? t.ctaText : t.text }]}>
                    {item.body ?? ""}
                  </Text>
                  <Text style={[type.micro, { color: mine ? "rgba(255,255,255,0.7)" : t.textMuted, marginTop: 4 }]}>
                    {new Date(item.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.composer, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Message..."
            placeholderTextColor={t.textFaint}
            multiline
            style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
          />
          <Pressable
            onPress={send}
            disabled={!body.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: body.trim() ? t.cta : t.border }]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700" }}>{sending ? "..." : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, justifyContent: "center" },
});