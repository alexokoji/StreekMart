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
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
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

const POLL_MS = 5_000;

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (sameDay(iso, today.toISOString())) return "Today";
  if (sameDay(iso, yest.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" });
}

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

  const counterpartName = route.params.counterpartName ?? "Chat";

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

  const initial = counterpartName.slice(0, 1).toUpperCase();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title={counterpartName} />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader
        title={counterpartName}
        rightAction={
          <View style={[styles.headerAvatar, { backgroundColor: t.accent }]}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{initial}</Text>
          </View>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, gap: 4, paddingBottom: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <View style={[styles.bigAvatar, { backgroundColor: t.accent }]}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 24 }}>{initial}</Text>
              </View>
              <Text style={[type.bodyStrong, { color: t.text, marginTop: 12 }]}>
                Say hi to {counterpartName}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4, textAlign: "center" }]}>
                Be clear about what you're after — most sellers reply within a few hours.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = user && item.senderId === user.id;
            const prev = messages[index - 1];
            const showDay = !prev || !sameDay(prev.createdAt, item.createdAt);
            const groupedWithPrev =
              prev && prev.senderId === item.senderId && sameDay(prev.createdAt, item.createdAt);
            return (
              <View>
                {showDay ? (
                  <View style={styles.dayDivider}>
                    <Text style={[type.micro, { color: t.textMuted, letterSpacing: 1 }]}>
                      {dayLabel(item.createdAt).toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start", marginTop: groupedWithPrev ? 2 : 6 }]}>
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine ? t.cta : t.card,
                        borderColor: mine ? t.cta : t.border,
                        borderTopRightRadius: mine ? (groupedWithPrev ? 8 : 4) : radius.md,
                        borderTopLeftRadius: mine ? radius.md : (groupedWithPrev ? 8 : 4),
                      },
                    ]}
                  >
                    {item.body ? (
                      <Text style={[type.body, { color: mine ? t.ctaText : t.text }]}>
                        {item.body}
                      </Text>
                    ) : null}
                    <Text style={[type.micro, { color: mine ? "rgba(255,255,255,0.75)" : t.textMuted, marginTop: 4, textAlign: "right" }]}>
                      {new Date(item.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg }}>
          <View style={[styles.composer, { borderTopColor: t.border }]}>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" },
              ]}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Type a message"
                placeholderTextColor={t.textMuted}
                multiline
                style={[styles.input, { color: t.text }]}
              />
            </View>
            <Pressable
              onPress={send}
              disabled={!body.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: body.trim() ? t.cta : t.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {sending ? (
                <Text style={{ color: t.ctaText, fontSize: 20, fontWeight: "800" }}>…</Text>
              ) : (
                <Ionicons name="send" size={20} color={t.ctaText} />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyChat: { padding: 32, alignItems: "center" },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDivider: { alignItems: "center", paddingVertical: 10 },
  bubbleRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
