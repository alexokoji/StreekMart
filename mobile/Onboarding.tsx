// First-launch onboarding for the StreekMart mobile app.
//
// Shown once per install — the dismissal flag is persisted to AsyncStorage
// so subsequent launches go straight to the WebView. Returning users (who
// already have a session cookie in the WebView) never see this, because by
// definition they've already onboarded on a previous install.
//
// Design: four full-screen slides, each a deeper violet so the user feels
// they're "going further in" as they swipe. The first slide uses the brand
// icon; the rest use unicode emoji rendered large — Apple ships excellent
// emoji on iOS and Google ships its own on Android, so we get crisp
// illustrations without bundling any assets.

import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type OnboardingExit = "register" | "login" | "home";

type Slide = {
  key: string;
  title: string;
  body: string;
  icon?: number; // require()'d image asset
  emoji?: string;
  bg: string;
};

// Slide content. Ordered so the violet deepens with each step — feels like
// the user is descending into a richer experience. Last slide is the
// conversion moment, with both "Create account" and "I have an account"
// affordances.
const SLIDES: Slide[] = [
  {
    key: "welcome",
    title: "Welcome to\nStreekMart",
    body: "Nigeria's fashion-first marketplace — materials, ready-to-wear, and designer originals, all in one place.",
    icon: require("./assets/icon.png"),
    bg: "#7c3aed",
  },
  {
    key: "discover",
    title: "Discover bold looks",
    body: "Browse independent designers and sellers across the country. Smart search finds the piece you have in mind.",
    emoji: "🛍️",
    bg: "#6d28d9",
  },
  {
    key: "secure",
    title: "Every order, protected",
    body: "Delivery codes confirm your package on arrival. Pay-on-Delivery is available for trusted buyers — no risk, no chargebacks.",
    emoji: "🔐",
    bg: "#5b21b6",
  },
  {
    key: "sell",
    title: "Sell or design",
    body: "Open your storefront in minutes. Tiered verification, AI tools, and direct buyer chat — everything you need to grow.",
    emoji: "✨",
    bg: "#4c1d95",
  },
];

export function Onboarding({ onFinish }: { onFinish: (target: OnboardingExit) => void }) {
  const [index, setIndex] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);
  // Drives the dot indicator + parallax — same Animated.Value backing both
  // ensures the dot and the slide content move in lockstep.
  const scrollX = useRef(new Animated.Value(0)).current;

  const advance = useCallback(() => {
    if (index < SLIDES.length - 1) {
      // Light haptic on every page change — small detail that makes the
      // swipe feel mechanical instead of floaty.
      if (Platform.OS === "ios") {
        Haptics.selectionAsync().catch(() => {});
      }
      flatRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      // Final slide CTA. Triggers the conversion path — straight to /register
      // so first-time users land on signup with one tap. The matching haptic
      // is heavier (success) to mark the moment.
      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onFinish("register");
    }
  }, [index, onFinish]);

  const skip = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.selectionAsync().catch(() => {});
    }
    onFinish("home");
  }, [onFinish]);

  // FlatList viewable-items callback drives the dot indicator and the bottom
  // CTA copy. itemVisiblePercentThreshold: 60 means the dot doesn't flicker
  // mid-swipe — it only ticks over once the next slide is mostly in view.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.index;
      if (typeof first === "number") setIndex(first);
    },
  ).current;

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: SLIDES[index].bg }]}>
      <StatusBar style="light" backgroundColor={SLIDES[index].bg} />

      {/* Decorative blurred orbs anchored in opposite corners — gives the
          flat color background depth without bundling a gradient lib. */}
      <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View style={styles.topBar}>
          {!isLast ? (
            <TouchableOpacity onPress={skip} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Text style={styles.skip}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        <Animated.FlatList
          ref={flatRef as unknown as React.RefObject<Animated.FlatList<Slide>>}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item, index: i }) => {
            // Parallax: as the user swipes between pages, the icon slides
            // slightly slower than the page itself, giving depth. Range goes
            // from -40 (page coming in from the right) → 0 (centered) → 40
            // (page leaving to the left).
            const translateX = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [-40, 0, 40],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [0.4, 1, 0.4],
              extrapolate: "clamp",
            });
            return (
              <View style={styles.slide}>
                <Animated.View style={[styles.iconWrap, { transform: [{ translateX }], opacity }]}>
                  {item.icon ? (
                    <Image source={item.icon} style={styles.iconImage} />
                  ) : (
                    <Text style={styles.iconEmoji}>{item.emoji}</Text>
                  )}
                </Animated.View>
                <Animated.Text style={[styles.title, { opacity }]}>{item.title}</Animated.Text>
                <Animated.Text style={[styles.body, { opacity }]}>{item.body}</Animated.Text>
              </View>
            );
          }}
        />

        {/* Dot pagination. Active dot widens to a pill — same visual idiom
            as native iOS onboarding flows so the affordance reads
            instantly. */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [0.45, 1, 0.45],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            );
          })}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.85} style={styles.cta} onPress={advance}>
            <Text style={styles.ctaText}>
              {isLast ? "Create account" : "Next"}
            </Text>
          </TouchableOpacity>
          {isLast && (
            <TouchableOpacity
              onPress={() => onFinish("login")}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.signin}
            >
              <Text style={styles.signinText}>I already have an account</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  orb: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  orbTop: {
    top: -120,
    right: -120,
  },
  orbBottom: {
    bottom: -120,
    left: -120,
  },
  topBar: {
    height: 44,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  skip: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  iconWrap: {
    width: 168,
    height: 168,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  iconImage: {
    width: 168,
    height: 168,
    resizeMode: "contain",
    borderRadius: 36,
  },
  iconEmoji: {
    fontSize: 120,
    lineHeight: 144,
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 16,
  },
  body: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 360,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: "center",
  },
  cta: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    // Soft glow so the button feels lifted off the colored background.
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaText: {
    color: "#4c1d95",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  signin: {
    marginTop: 14,
    paddingVertical: 8,
  },
  signinText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
});
