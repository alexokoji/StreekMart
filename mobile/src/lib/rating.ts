import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

// Lightweight wrapper around expo-store-review. The native dialog has
// its own per-year rate limit (Apple) / per-quarter limit (Google) so
// repeated calls are safe -- the OS just refuses. We layer our own
// quietude on top: never trigger more than once per 30 days from the
// app side, and only on positive moments (delivery confirmation, order
// completion, etc.).
const KEY = "streekmart:rating-prompt-last-at";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export async function maybePromptForRating(): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return;
    const last = await AsyncStorage.getItem(KEY);
    if (last && Date.now() - Number(last) < COOLDOWN_MS) return;
    await StoreReview.requestReview();
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* silent -- this is a delight feature, never block on it */
  }
}