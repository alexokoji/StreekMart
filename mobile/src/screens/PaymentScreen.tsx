import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../state/ThemeContext";
import { type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Opens the gateway's hosted-checkout URL inside an in-app WebView
// (same shell the web's CheckoutForm redirects to after the buyer
// presses "Pay & place orders"). When the gateway redirects back to
// `/cart/checkout/return?ref=…` we close the WebView and route the
// buyer to Orders so they see the freshly-created PAID row as soon as
// the webhook lands.
export function PaymentScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Payment">>();
  const { url, paymentReference } = route.params;
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // Pressing the OS back button while the WebView has its own history
  // should go back inside the WebView first — only pop the stack when
  // we're already on the first page. Matches how the web's redirect
  // flow lets the user retry a step without losing the order.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      webRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  function onNavChange(e: WebViewNavigation) {
    // Korapay (and the stub gateway) bounce the buyer back to
    // /cart/checkout/return?ref=<paymentReference> after the
    // transaction. Once that URL fires we know the gateway is done;
    // close the WebView and surface the buyer's Orders list.
    if (e.url.includes("/cart/checkout/return")) {
      nav.replace("Orders");
    }
  }

  function cancel() {
    Alert.alert(
      "Cancel payment?",
      "Your order won't be placed until payment is confirmed.",
      [
        { text: "Keep paying", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => nav.goBack(),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable onPress={cancel} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
            Secure payment
          </Text>
          {paymentReference ? (
            <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>
              Ref {paymentReference}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => webRef.current?.reload()}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <Ionicons name="refresh" size={22} color={t.text} />
        </Pressable>
      </View>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <WebView
          ref={webRef}
          source={{ uri: url }}
          onNavigationStateChange={onNavChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          // Korapay's hosted checkout sometimes opens 3-D Secure pages
          // inside iframes — keeping these on lets those flows complete
          // without falling back to the system browser.
          allowsInlineMediaPlayback
          mixedContentMode="always"
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
        />
        {loading ? (
          <View style={styles.spinnerOverlay} pointerEvents="none">
            <ActivityIndicator color={t.cta} size="large" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
