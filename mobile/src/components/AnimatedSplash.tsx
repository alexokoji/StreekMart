import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { StreekMark } from "./StreekMark";
import { fontFamily } from "../theme/tokens";

// The splash the user actually sees. The native splash (ink background +
// the mark) holds until this mounts, then this takes over on the same
// background so the hand-off is seamless: the mark settles in, the wordmark
// and tagline rise, then the whole thing fades out once the app is ready.
const MIN_VISIBLE_MS = 1800;

export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const mark = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(Date.now());
  const finishing = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(mark, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.timing(word, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [mark, word]);

  useEffect(() => {
    if (!ready || finishing.current) return;
    finishing.current = true;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    const timer = setTimeout(() => {
      Animated.timing(out, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => onFinish());
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, out, onFinish]);

  const markScale = mark.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const wordY = word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View
      style={[styles.root, { opacity: out }]}
      pointerEvents="auto"
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="22%" cy="16%" r="75%">
            <Stop offset="0" stopColor="#7C3AED" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
          </RadialGradient>
          <Pattern id="dots" patternUnits="userSpaceOnUse" width={32} height={32}>
            <Circle cx={16} cy={16} r={2.4} fill="#F6F3ED" fillOpacity={0.07} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
        <Rect width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      <View style={styles.center}>
        <Animated.View style={{ opacity: mark, transform: [{ scale: markScale }] }}>
          <StreekMark size={150} />
        </Animated.View>
        <Animated.View style={{ opacity: word, transform: [{ translateY: wordY }], alignItems: "center" }}>
          <Text style={styles.wordmark}>
            Streek<Text style={{ color: "#F2C14E" }}>Mart</Text>
          </Text>
          <Text style={styles.tagline}>FASHION, FABRICS AND STYLE</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill as object, backgroundColor: "#17121F", zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22, paddingBottom: 24 },
  wordmark: { color: "#F6F3ED", fontSize: 46, fontFamily: fontFamily.serif, letterSpacing: -0.5 },
  tagline: { color: "#B7B0C8", fontSize: 11, letterSpacing: 2.2, marginTop: 6, fontFamily: fontFamily.bold },
});
