import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { StreekMark } from "../components/StreekMark";
import { Fabric, type FabricKind } from "../components/Fabric";
import { fontFamily, radius } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Entry screen for everyone who is signed out, on every launch: four slides
// that explain what StreekMart is, then the way in (create account, log in
// or browse as a guest). It's intentionally always dark so it follows on
// from the splash without a jump, and independent of the phone's theme.
const INK = "#17121F";
const CREAM = "#F6F3ED";
const MUTED = "#B7B0C8";
const GOLD = "#F2C14E";
const VIOLET = "#7C3AED";

type Slide = { key: string; eyebrow: string; title: string; body: string; art: "shop" | "safe" | "designers" | "sell" };

const SLIDES: Slide[] = [
  {
    key: "shop",
    eyebrow: "WELCOME TO STREEKMART",
    title: "Fashion, fabrics and style, all in one place",
    body: "Shop Ankara, lace, Adire and ready-to-wear from verified sellers and designers across Nigeria.",
    art: "shop",
  },
  {
    key: "safe",
    eyebrow: "SHOP WITH CONFIDENCE",
    title: "Your money stays safe until it arrives",
    body: "We hold your payment while your order is on its way. Share your delivery code with the rider only when it's in your hands.",
    art: "safe",
  },
  {
    key: "designers",
    eyebrow: "DESIGNERS AND CUSTOM",
    title: "Follow designers. Order something made for you",
    body: "Follow the designers you love, preorder new pieces and commission custom outfits, all in the app.",
    art: "designers",
  },
  {
    key: "sell",
    eyebrow: "FOR SELLERS AND DESIGNERS",
    title: "Open your shop and get paid",
    body: "List your pieces, manage orders and withdraw to your bank. Get verified for a trust badge and lower fees.",
    art: "sell",
  },
];

export function OnboardingScreen() {
  const nav = useNavigation<Nav>();
  const { width, height } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const artH = Math.min(Math.max(height * 0.44, 280), 420);

  function onEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }
  function goTo(i: number) {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.top}>
        <View style={styles.brand}>
          <StreekMark size={30} />
          <Text style={styles.brandText}>
            Streek<Text style={{ color: GOLD }}>Mart</Text>
          </Text>
        </View>
        {!last ? (
          <Pressable onPress={() => goTo(SLIDES.length - 1)} hitSlop={12} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skip} />
        )}
      </SafeAreaView>

      <Animated.FlatList
        ref={listRef as never}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const input = [(i - 1) * width, i * width, (i + 1) * width];
          const artX = scrollX.interpolate({ inputRange: input, outputRange: [width * 0.35, 0, -width * 0.35] });
          const artO = scrollX.interpolate({ inputRange: input, outputRange: [0, 1, 0] });
          const textY = scrollX.interpolate({ inputRange: input, outputRange: [40, 0, 40] });
          return (
            <View style={{ width }}>
              <Animated.View style={[styles.artWrap, { height: artH, opacity: artO, transform: [{ translateX: artX }] }]}>
                {/* Illustrations are drawn at 360pt tall; shrink to fit short phones. */}
                <View style={{ height: 360, transform: [{ scale: Math.min(1, artH / 360) }], transformOrigin: "top" }}>
                  <Art kind={item.art} />
                </View>
              </Animated.View>
              <Animated.View style={[styles.copy, { opacity: artO, transform: [{ translateY: textY }] }]}>
                <Text style={styles.eyebrow}>{item.eyebrow}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      <SafeAreaView edges={["bottom"]} style={styles.bottom}>
        <Dots scrollX={scrollX} width={width} />
        {last ? (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => nav.navigate("Register")}
              style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Create account</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate("Login")}
              style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>I already have an account</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.reset({ index: 0, routes: [{ name: "Tabs" }] })}
              hitSlop={8}
              style={styles.guest}
              accessibilityRole="button"
            >
              <Text style={styles.guestText}>Browse as a guest</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => goTo(index + 1)}
            style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

function Dots({ scrollX, width }: { scrollX: Animated.Value; width: number }) {
  return (
    <View style={styles.dots}>
      {SLIDES.map((s, i) => {
        const input = [(i - 1) * width, i * width, (i + 1) * width];
        const w = scrollX.interpolate({ inputRange: input, outputRange: [8, 26, 8], extrapolate: "clamp" });
        const o = scrollX.interpolate({ inputRange: input, outputRange: [0.35, 1, 0.35], extrapolate: "clamp" });
        return <Animated.View key={s.key} style={[styles.dot, { width: w, opacity: o }]} />;
      })}
    </View>
  );
}

// ---------- illustrations ----------

function Art({ kind }: { kind: Slide["art"] }) {
  switch (kind) {
    case "shop":
      return <ShopArt />;
    case "safe":
      return <SafeArt />;
    case "designers":
      return <DesignersArt />;
    default:
      return <SellArt />;
  }
}

function Tile({ kind, w, h, rot, price, left, top, z }: { kind: FabricKind; w: number; h: number; rot: string; price?: string; left: number; top: number; z?: number }) {
  return (
    <View style={[styles.tile, { width: w, height: h, left, top, zIndex: z ?? 1, transform: [{ rotate: rot }] }]}>
      <Fabric kind={kind} />
      <View style={styles.heart}>
        <Ionicons name="heart-outline" size={16} color={INK} />
      </View>
      {price ? (
        <View style={styles.priceChip}>
          <Text style={styles.priceText}>{price}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ShopArt() {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  return (
    <View style={styles.art}>
      <Tile kind="adire" w={150} h={200} rot="-10deg" left={cx - 215} top={46} />
      <Tile kind="diamond" w={150} h={200} rot="10deg" left={cx + 65} top={46} />
      <Tile kind="ankara" w={176} h={236} rot="0deg" price="₦18,500" left={cx - 88} top={18} z={3} />
      <View style={[styles.chipFloat, { left: cx - 175, top: 270 }]}>
        <Ionicons name="shield-checkmark" size={14} color={INK} />
        <Text style={styles.chipFloatText}>Verified sellers</Text>
      </View>
      <View style={[styles.chipFloat, { left: cx + 30, top: 290 }]}>
        <Ionicons name="cube-outline" size={14} color={INK} />
        <Text style={styles.chipFloatText}>Delivered to you</Text>
      </View>
    </View>
  );
}

function SafeArt() {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  return (
    <View style={styles.art}>
      <View style={[styles.codeCard, { left: cx - 150 }]}>
        <Text style={styles.codeLabel}>YOUR DELIVERY CODE</Text>
        <View style={styles.codeRow}>
          {["K", "7", "R", "2"].map((c) => (
            <View key={c} style={styles.codeBox}>
              <Text style={styles.codeChar}>{c}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.codeHint}>Tell the rider at your door</Text>
      </View>
      <View style={[styles.shield, { left: cx - 40 }]}>
        <Ionicons name="shield-checkmark" size={44} color={INK} />
      </View>
      <View style={[styles.chipFloat, { left: cx - 120, top: 316 }]}>
        <Ionicons name="lock-closed" size={14} color={INK} />
        <Text style={styles.chipFloatText}>Payment held safely</Text>
      </View>
    </View>
  );
}

function DesignersArt() {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  const av: Array<[FabricKind, number, number]> = [["ankara", cx - 150, 40], ["diamond", cx - 40, 14], ["adire", cx + 70, 40]];
  return (
    <View style={styles.art}>
      {av.map(([k, x, y]) => (
        <View key={k} style={[styles.avRing, { left: x, top: y }]}>
          <View style={styles.avInner}>
            <Fabric kind={k} />
          </View>
          <View style={styles.verDot}>
            <Ionicons name="checkmark" size={12} color={INK} />
          </View>
        </View>
      ))}
      <View style={[styles.commCard, { left: cx - 150 }]}>
        <View style={styles.commIcon}>
          <Ionicons name="brush-outline" size={22} color={CREAM} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commTitle}>Custom order</Text>
          <Text style={styles.commSub}>Describe it, agree a price, get it made</Text>
        </View>
        <View style={styles.followBtn}>
          <Text style={styles.followText}>Follow</Text>
        </View>
      </View>
      <View style={[styles.chipFloat, { left: cx - 52, top: 262 }]}>
        <Ionicons name="time-outline" size={14} color={INK} />
        <Text style={styles.chipFloatText}>Preorders</Text>
      </View>
    </View>
  );
}

function SellArt() {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  return (
    <View style={styles.art}>
      <View style={[styles.wallet, { left: cx - 150 }]}>
        <Text style={styles.walletLabel}>Available to withdraw</Text>
        <Text style={styles.walletAmt}>₦184,300</Text>
        <Svg width="100%" height={70} viewBox="0 0 300 70" preserveAspectRatio="none" style={{ marginTop: 8 }}>
          <Defs>
            <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#A78BFA" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#A78BFA" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d="M0 56 L30 50 L60 54 L90 40 L120 44 L150 30 L180 36 L210 24 L240 28 L270 14 L300 6 V70 H0Z" fill="url(#sg)" />
          <Path d="M0 56 L30 50 L60 54 L90 40 L120 44 L150 30 L180 36 L210 24 L240 28 L270 14 L300 6" fill="none" stroke="#C4B5FD" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={[styles.orderCard, { left: cx - 120 }]}>
        <View style={styles.orderDot} />
        <Text style={styles.orderText}>New order to fulfil</Text>
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </View>
      <View style={[styles.chipFloat, { left: cx + 10, top: 6 }]}>
        <Ionicons name="ribbon" size={14} color={INK} />
        <Text style={styles.chipFloatText}>Verified badge</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandText: { color: CREAM, fontSize: 24, fontFamily: fontFamily.serif },
  skip: { minWidth: 64, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  skipText: { color: MUTED, fontSize: 15, fontFamily: fontFamily.bold },
  artWrap: { justifyContent: "flex-start", marginTop: 6 },
  art: { flex: 1 },
  copy: { paddingHorizontal: 26, paddingTop: 10, gap: 10 },
  eyebrow: { color: GOLD, fontSize: 11, letterSpacing: 1.6, fontFamily: fontFamily.extrabold },
  title: { color: CREAM, fontSize: 36, lineHeight: 38, fontFamily: fontFamily.serif },
  body: { color: MUTED, fontSize: 16, lineHeight: 24, fontFamily: fontFamily.medium },
  bottom: { paddingHorizontal: 22, paddingBottom: 14, gap: 18 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center", height: 10 },
  dot: { height: 8, borderRadius: 4, backgroundColor: CREAM },
  primary: { height: 58, borderRadius: 29, backgroundColor: VIOLET, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontFamily: fontFamily.extrabold },
  secondary: { height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: "rgba(246,243,237,0.5)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: CREAM, fontSize: 16, fontFamily: fontFamily.bold },
  guest: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  guestText: { color: MUTED, fontSize: 15, fontFamily: fontFamily.bold, textDecorationLine: "underline" },

  tile: { position: "absolute", borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: "rgba(246,243,237,0.18)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  heart: { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" },
  priceChip: { position: "absolute", left: 10, bottom: 10, backgroundColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  priceText: { color: CREAM, fontSize: 13, fontFamily: fontFamily.extrabold },
  chipFloat: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: GOLD, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, zIndex: 5 },
  chipFloatText: { color: INK, fontSize: 12, fontFamily: fontFamily.extrabold },

  codeCard: { position: "absolute", top: 40, width: 300, backgroundColor: "#2B2338", borderRadius: 28, padding: 20, alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: "rgba(246,243,237,0.12)" },
  codeLabel: { color: MUTED, fontSize: 11, letterSpacing: 1.4, fontFamily: fontFamily.extrabold },
  codeRow: { flexDirection: "row", gap: 10 },
  codeBox: { width: 56, height: 70, borderRadius: 16, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  codeChar: { color: GOLD, fontSize: 36, fontFamily: fontFamily.extrabold },
  codeHint: { color: MUTED, fontSize: 13, fontFamily: fontFamily.medium },
  shield: { position: "absolute", top: 196, width: 80, height: 80, borderRadius: 40, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: INK },

  avRing: { position: "absolute", width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: VIOLET, padding: 4 },
  avInner: { flex: 1, borderRadius: 40, overflow: "hidden" },
  verDot: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: INK },
  commCard: { position: "absolute", top: 156, width: 300, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#2B2338", borderRadius: 24, padding: 14, borderWidth: 1, borderColor: "rgba(246,243,237,0.12)" },
  commIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: VIOLET, alignItems: "center", justifyContent: "center" },
  commTitle: { color: CREAM, fontSize: 15, fontFamily: fontFamily.extrabold },
  commSub: { color: MUTED, fontSize: 12, fontFamily: fontFamily.medium, marginTop: 2 },
  followBtn: { height: 34, borderRadius: 17, backgroundColor: "#EEE8FB", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  followText: { color: "#4C1D95", fontSize: 12, fontFamily: fontFamily.extrabold },

  wallet: { position: "absolute", top: 30, width: 300, backgroundColor: "#2B1760", borderRadius: 28, padding: 18, borderWidth: 1, borderColor: "rgba(246,243,237,0.12)" },
  walletLabel: { color: "#DDD6FE", fontSize: 13, fontFamily: fontFamily.bold },
  walletAmt: { color: "#fff", fontSize: 34, fontFamily: fontFamily.extrabold, marginTop: 4 },
  orderCard: { position: "absolute", top: 250, width: 240, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2B2338", borderRadius: 20, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: "rgba(246,243,237,0.12)" },
  orderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  orderText: { flex: 1, color: CREAM, fontSize: 14, fontFamily: fontFamily.bold },
});
