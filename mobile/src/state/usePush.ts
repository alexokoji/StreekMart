// Push notifications hook.
//
// On a fresh session (user signed in, permission granted, not yet
// registered), request the Expo push token and POST it to
// /api/push/register so server-side fan-outs reach this install.
//
// Re-runs the registration when the user changes (e.g. after logout/login)
// so a logged-in user always has their own row associated with the token.

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredForUser: string | null = null;

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId) {
      registeredForUser = null;
      return;
    }
    if (registeredForUser === userId) return;
    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) return; // simulators don't get push
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== "granted") {
          const res = await Notifications.requestPermissionsAsync();
          status = res.status;
        }
        if (status !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "StreekMart",
            importance: Notifications.AndroidImportance.DEFAULT,
            lightColor: "#7c3aed",
          });
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;
        const token = tokenResult.data;
        if (!token) return;

        await api.post("/api/push/register", { token, platform: Platform.OS });
        registeredForUser = userId;
      } catch {
        // Fail silently — the user can manually retry from Settings.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

// Manual trigger used by the Settings screen's "Re-enable push" button.
export async function refreshPushRegistration(userId: string): Promise<
  "registered" | "denied" | "unsupported"
> {
  if (!Device.isDevice) return "unsupported";
  const res = await Notifications.requestPermissionsAsync();
  if (res.status !== "granted") return "denied";
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  await api.post("/api/push/register", {
    token: tokenResult.data,
    platform: Platform.OS,
  });
  registeredForUser = userId;
  return "registered";
}
