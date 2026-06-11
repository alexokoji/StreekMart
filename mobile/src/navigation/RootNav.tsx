import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme, type LinkingOptions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { HomeScreen } from "../screens/HomeScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { CartScreen } from "../screens/CartScreen";
import { AccountScreen } from "../screens/AccountScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { ProductDetailScreen } from "../screens/ProductDetailScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

export type RootStackParamList = {
  Tabs: undefined;
  ProductDetail: { id: string };
  Login: undefined;
  Register: undefined;
  Settings: undefined;
  Search: undefined;
};

export type TabParamList = {
  Home: undefined;
  Feed: undefined;
  Search: undefined;
  Cart: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["streekmart://", "https://streekmart.online", "https://www.streekmart.online"],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: "",
          Feed: "feed",
          Search: "search",
          Cart: "cart",
          Account: "account",
        },
      },
      ProductDetail: "products/:id",
      Login: "login",
      Register: "register",
      Settings: "settings",
    },
  },
};

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.bgElevated,
          borderTopColor: t.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        tabBarActiveTintColor: t.cta,
        tabBarInactiveTintColor: t.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="home" />,
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="feed" />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="search" />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="cart" />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="me" />,
        }}
      />
    </Tab.Navigator>
  );
}

// Tiny emoji-based tab glyphs — keeps the icon set dep-free. Easy to swap
// to `@expo/vector-icons` later without touching the screen registration.
function TabGlyph({ color, glyph }: { color: string; glyph: "home" | "feed" | "search" | "cart" | "me" }) {
  const ch =
    glyph === "home"
      ? "⌂"
      : glyph === "feed"
        ? "≡"
        : glyph === "search"
          ? "⌕"
          : glyph === "cart"
            ? "🛒"
            : "◉";
  return (
    <View style={styles.glyphWrap}>
      <Text style={{ color, fontSize: 22, lineHeight: 24 }}>{ch}</Text>
    </View>
  );
}

export function RootNav() {
  const t = useTheme();
  const { user } = useAuth();
  void user; // tabs are public — auth gates happen per-screen

  const navTheme = t.scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <>
      <StatusBar style={t.statusBarStyle === "dark" ? "dark" : "light"} />
      <NavigationContainer
        linking={linking}
        theme={{
          ...navTheme,
          colors: {
            ...navTheme.colors,
            background: t.bg,
            card: t.bgElevated,
            text: t.text,
            border: t.border,
            primary: t.cta,
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: t.bgElevated },
            headerTintColor: t.text,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ title: "Product" }}
          />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign in" }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

// Cheap "+" floating action button rendered above the tab bar on the Home
// screen — exported for screens that want to spawn the universal create
// affordance (left for a future iteration).
export function FloatingActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, { backgroundColor: t.cta }]}
    >
      <Text style={{ color: t.ctaText, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glyphWrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 90,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    elevation: 5,
  },
});
