// Push notifications hook.
//
// On a fresh session (user signed in, permission granted, not yet
// registered), request the Expo push token and POST it to
// /api/push/register so server-side fan-outs reach this install.
//
// SDK 53+ caveat: Expo removed remote push functionality from Expo Go
// entirely. The `expo-notifications` module crashes at import time
// inside Expo Go because internal initialization calls the push API.
// To keep Expo Go previews working, we lazy-require the module only
// when running outside Expo Go (dev / production builds).

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api } from "../api/client";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Lazy-loaded notifications module. Stays undefined inside Expo Go.
type NotificationsModule = typeof import("expo-notifications");
let _Notifications: NotificationsModule | null = null;

function getNotifications(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (_Notifications) return _Notifications;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _Notifications = require("expo-notifications") as NotificationsModule;
  _Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 53+: shouldShowAlert was split into shouldShowBanner +
      // shouldShowList. Set both to true to preserve the prior behavior.
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return _Notifications;
}

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
        const Notifications = getNotifications();
        if (!Notifications) return; // Expo Go — skip silently.
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
  const Notifications = getNotifications();
  if (!Notifications) return "unsupported";
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
