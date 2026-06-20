import React from "react";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type LinkingOptions,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../state/ThemeContext";
import { BottomNav } from "./BottomNav";
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
import { GetStartedScreen } from "../screens/GetStartedScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AddressesScreen } from "../screens/AddressesScreen";
import { AddressFormScreen } from "../screens/AddressFormScreen";
import { CheckoutScreen } from "../screens/CheckoutScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { OrderDetailScreen } from "../screens/OrderDetailScreen";
import { SellerDashboardScreen } from "../screens/SellerDashboardScreen";
import { DesignerDashboardScreen } from "../screens/DesignerDashboardScreen";
import { WishlistScreen } from "../screens/WishlistScreen";
import { CategoriesScreen } from "../screens/CategoriesScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PaymentMethodsScreen } from "../screens/PaymentMethodsScreen";
import { ChatsScreen } from "../screens/ChatsScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { CouponsScreen } from "../screens/CouponsScreen";
import { MenuScreen } from "../screens/MenuScreen";
import { TrendingScreen } from "../screens/TrendingScreen";
import { ActionScreen, type ActionScreenParams } from "../screens/ActionScreen";
import { SellerProductsScreen } from "../screens/SellerProductsScreen";
import { AddProductScreen } from "../screens/AddProductScreen";
import { SellerPayoutsScreen } from "../screens/SellerPayoutsScreen";
import { SellerPromotionsScreen } from "../screens/SellerPromotionsScreen";
import { SellerSettingsScreen } from "../screens/SellerSettingsScreen";
import { NewPostScreen } from "../screens/NewPostScreen";
import { DesignerPostsScreen } from "../screens/DesignerPostsScreen";
import { DesignerCommissionsScreen } from "../screens/DesignerCommissionsScreen";
import { DesignerFollowersScreen } from "../screens/DesignerFollowersScreen";
import { DesignerEarningsScreen } from "../screens/DesignerEarningsScreen";
import { DesignerProfileScreen } from "../screens/DesignerProfileScreen";
import { SellerProfileScreen } from "../screens/SellerProfileScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { VerificationScreen } from "../screens/VerificationScreen";
import { PaymentScreen } from "../screens/PaymentScreen";
import { PostDetailScreen } from "../screens/PostDetailScreen";

// Tabs: Home | Feed | Search (centre FAB) | Cart | Account.
// Feed (designer posts) sits in the primary nav so buyers can pull up
// fresh designer content with one tap. Wishlist drops into the Account
// screen as a row — still one tap from Account.
export type TabParamList = {
  Home: undefined;
  Feed: undefined;
  Search: undefined;
  Cart: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  // Tabs is a nested navigator. Callers hitting a tab from a stack
  // screen use `goToTab(nav, "Cart")` (see ./goToTab.ts) which expands
  // to `nav.navigate("Tabs", { screen: "Cart" })`. React Navigation v7
  // requires this explicit form; the v6 implicit-resolution-up-tree
  // behaviour no longer applies.
  Tabs: NavigatorScreenParams<TabParamList>;
  GetStarted: undefined;
  Onboarding: undefined;
  ProductDetail: { id: string };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Settings: undefined;
  // Wishlist used to be a primary tab. It's now reached from the
  // Account screen + the Cart screen's heart action — still one tap
  // either way.
  Wishlist: undefined;
  Addresses: undefined;
  AddressForm: { id?: string };
  Checkout: undefined;
  Orders: undefined;
  OrderDetail: { id: string };
  SellerDashboard: undefined;
  DesignerDashboard: undefined;
  Categories: undefined;
  Notifications: undefined;
  PaymentMethods: undefined;
  Chats: undefined;
  Chat: { id: string; counterpartName?: string };
  Coupons: undefined;
  Menu: undefined;
  Trending: { rail?: string; title?: string } | undefined;
  // Shared in-app action page — only used as a fallback now that
  // dedicated routes exist for the dashboard quick actions.
  Action: ActionScreenParams;

  // Seller dashboard actions
  SellerProducts: undefined;
  AddProduct: undefined;
  SellerPayouts: undefined;
  SellerPromotions: undefined;
  SellerSettings: undefined;

  // Designer dashboard actions
  NewPost: undefined;
  DesignerPosts: undefined;
  DesignerCommissions: undefined;
  DesignerFollowers: undefined;
  DesignerEarnings: undefined;
  DesignerProfile: undefined;

  // Public seller / designer profile, reachable from product detail
  // and the Home > Designers rail. `id` can be the seller's user id
  // or slug — the server resolves either. The optional `name` and
  // `businessName` let the screen render headline copy immediately
  // while the fetch is in flight (and act as a safety net if every
  // endpoint 404s).
  SellerProfile: {
    id: string;
    name?: string;
    businessName?: string | null;
    avatarUrl?: string | null;
  };

  // Personal profile editor + verification request flow.
  EditProfile: undefined;
  Verification: undefined;

  // Hosted-checkout WebView for the payment gateway. Opened from
  // CheckoutScreen with the URL returned by /api/cart/checkout. We
  // close it ourselves once the WebView navigates to the gateway's
  // /cart/checkout/return?ref=… callback.
  Payment: { url: string; paymentReference?: string };

  // Designer post detail — Instagram-style single post with full
  // caption + comments thread. Reached from the Feed's comment icon
  // or "View comments" link.
  PostDetail: { id: string };
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
      GetStarted: "welcome",
      Onboarding: "onboarding",
      ProductDetail: "products/:id",
      Login: "login",
      Register: "register",
      ForgotPassword: "forgot-password",
      Settings: "settings",
      Wishlist: "wishlist",
      Addresses: "account/addresses",
      AddressForm: "account/addresses/edit",
      Checkout: "checkout",
      Orders: "account/orders",
      OrderDetail: "account/orders/:id",
      SellerDashboard: "seller",
      DesignerDashboard: "designer",
      Categories: "categories",
      Notifications: "account/notifications",
      PaymentMethods: "account/payment-methods",
      Chats: "messages",
      Chat: "messages/:id",
      Coupons: "account/coupons",
      Menu: "menu",
      Trending: "trending",
    },
  },
};

// Tab navigator uses the custom BottomNav (defined in ./BottomNav.tsx)
// which renders the centre Search as a raised FAB. Tab styling lives
// inside that component, so the navigator's screenOptions only needs
// to hide the default header.
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

// `initialRouteName` lets App.tsx land first-launch users on GetStarted /
// Onboarding while returning users go straight to Tabs. Defaults to
// Tabs so deep links and unit tests don't need to set it.
export function RootNav({
  initialRouteName = "Tabs",
}: {
  initialRouteName?: keyof RootStackParamList;
}) {
  const t = useTheme();
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
          initialRouteName={initialRouteName}
          screenOptions={{
            headerStyle: { backgroundColor: t.bgElevated },
            headerTintColor: t.text,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: t.bg },
            // Default native-stack on Android leaves the container
            // transparent during the pop animation, which reads as a
            // white flash on dark mode. Picking an explicit slide gives
            // both platforms a continuous animated transition and
            // forces the container to render the theme background
            // straight through the gesture.
            animation: "slide_from_right",
            animationDuration: 250,
            animationTypeForReplace: "push",
            navigationBarColor: t.bg,
            statusBarTranslucent: false,
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          {/* Get Started + Onboarding render their own header / no header
              so we hide the stack's. */}
          <Stack.Screen name="GetStarted" component={GetStartedScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          {/* All redesigned screens render their own BackHeader, so hide the
              native stack header to avoid a double-header. */}
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Addresses" component={AddressesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AddressForm" component={AddressFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerDashboard" component={DesignerDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Chats" component={ChatsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Coupons" component={CouponsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Trending" component={TrendingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Action" component={ActionScreen} options={{ headerShown: false }} />

          {/* Seller dashboard screens */}
          <Stack.Screen name="SellerProducts" component={SellerProductsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerPayouts" component={SellerPayoutsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerPromotions" component={SellerPromotionsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SellerSettings" component={SellerSettingsScreen} options={{ headerShown: false }} />

          {/* Designer dashboard screens */}
          <Stack.Screen name="NewPost" component={NewPostScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerPosts" component={DesignerPostsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerCommissions" component={DesignerCommissionsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerFollowers" component={DesignerFollowersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerEarnings" component={DesignerEarningsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DesignerProfile" component={DesignerProfileScreen} options={{ headerShown: false }} />

          <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Verification" component={VerificationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

// FloatingActionButton + tab-glyph styles were removed when the bottom
// nav moved to BottomNav.tsx, which owns the centre FAB itself. If any
// screen needs a standalone FAB later, add a tiny FAB component to
// src/components and import it directly.