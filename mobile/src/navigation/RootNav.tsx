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
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { AddressesScreen } from "../screens/AddressesScreen";
import { AddressFormScreen } from "../screens/AddressFormScreen";
import { CheckoutScreen } from "../screens/CheckoutScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { OrderDetailScreen } from "../screens/OrderDetailScreen";
import { SellerDashboardScreen } from "../screens/SellerDashboardScreen";
import { DesignerDashboardScreen } from "../screens/DesignerDashboardScreen";
import { AdminDashboardScreen } from "../screens/AdminDashboardScreen";
import { WishlistScreen } from "../screens/WishlistScreen";
import { CategoriesScreen } from "../screens/CategoriesScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PaymentMethodsScreen } from "../screens/PaymentMethodsScreen";
import { ChatsScreen } from "../screens/ChatsScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { CouponsScreen } from "../screens/CouponsScreen";

export type RootStackParamList = {
  Tabs: undefined;
  ProductDetail: { id: string };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Settings: undefined;
  Search: undefined;
  Addresses: undefined;
  AddressForm: { id?: string };
  Checkout: undefined;
  Orders: undefined;
  OrderDetail: { id: string };
  SellerDashboard: undefined;
  DesignerDashboard: undefined;
  AdminDashboard: undefined;
  Wishlist: undefined;
  Categories: undefined;
  Notifications: undefined;
  PaymentMethods: undefined;
  Chats: undefined;
  Chat: { id: string; counterpartName?: string };
  Coupons: undefined;
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
      ForgotPassword: "forgot-password",
      Settings: "settings",
      Addresses: "account/addresses",
      AddressForm: "account/addresses/edit",
      Checkout: "checkout",
      Orders: "account/orders",
      OrderDetail: "account/orders/:id",
      SellerDashboard: "seller",
      DesignerDashboard: "designer",
      AdminDashboard: "admin",
      Wishlist: "wishlist",
      Categories: "categories",
      Notifications: "account/notifications",
      PaymentMethods: "account/payment-methods",
      Chats: "messages",
      Chat: "messages/:id",
      Coupons: "account/coupons",
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="home" /> }} />
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="feed" /> }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="search" /> }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="cart" /> }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="me" /> }} />
    </Tab.Navigator>
  );
}

function TabGlyph({ color, glyph }: { color: string; glyph: "home" | "feed" | "search" | "cart" | "me" }) {
  const ch =
    glyph === "home" ? "[H]"
    : glyph === "feed" ? "[F]"
    : glyph === "search" ? "[S]"
    : glyph === "cart" ? "[C]"
    : "[M]";
  return (
    <View style={styles.glyphWrap}>
      <Text style={{ color, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{ch}</Text>
    </View>
  );
}

export function RootNav() {
  const t = useTheme();
  const { user } = useAuth();
  void user;
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
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "Product" }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign in" }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Forgot password" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
          <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: "Addresses" }} />
          <Stack.Screen name="AddressForm" component={AddressFormScreen} options={{ title: "Address" }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
          <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "My orders" }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order" }} />
          <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: "Seller" }} />
          <Stack.Screen name="DesignerDashboard" component={DesignerDashboardScreen} options={{ title: "Designer" }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: "Admin" }} />
          <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Wishlist" }} />
          <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: "Categories" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: "Payment methods" }} />
          <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: "Messages" }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
          <Stack.Screen name="Coupons" component={CouponsScreen} options={{ title: "Coupons" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export function FloatingActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.fab, { backgroundColor: t.cta }]}>
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