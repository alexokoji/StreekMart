// Helper for navigating to a bottom-tab route from a stack-typed nav
// prop. React Navigation v7 no longer auto-resolves tab names from a
// parent stack — the explicit nested form is required, and this util
// wraps it so call sites stay readable.
//
//   goToTab(nav, "Cart")
//
// is equivalent to:
//
//   nav.navigate("Tabs", { screen: "Cart" })
//
// The nav prop is typed loosely (just needs a `navigate` method) so any
// caller — NativeStackNavigationProp, NavigationProp, or composite —
// can pass theirs straight through.

import type { TabParamList } from "./RootNav";

type AnyNav = { navigate: (route: string, params?: object) => void };

export function goToTab<T extends keyof TabParamList>(nav: AnyNav, tab: T): void {
  nav.navigate("Tabs", { screen: tab });
}
