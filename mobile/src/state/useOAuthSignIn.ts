// OAuth sign-in hook.
//
// Wraps the three provider SDKs behind a single `signIn(provider)`
// call. The provider tokens are posted to /api/auth/oauth/{provider}
// via AuthContext.loginWithOAuth, which expects the backend to verify
// them and return a session.
//
// Platform setup checklist (do this once before the buttons work):
//
//   GOOGLE
//   1. Create OAuth 2.0 Client IDs in Google Cloud Console:
//      - Web   → for the backend's id_token verification
//      - iOS   → bundle ID: com.streekmart.app
//      - Android → package: com.streekmart.app + SHA-1 from your keystore
//   2. Paste them into app.json -> extra.oauth.
//   3. iOS only: add the reverse-client-ID as a URL scheme in app.json
//      ios.infoPlist.CFBundleURLTypes (auth-session will instruct you
//      with the exact value when you first run the prompt).
//
//   APPLE  (iOS only — button auto-hides on Android)
//   1. In Apple Developer, enable "Sign In with Apple" for the App ID.
//   2. The `usesAppleSignIn` flag + the `expo-apple-authentication`
//      plugin in app.json take care of the entitlement on build.
//   3. For backend verification, create a Services ID + private key
//      to verify identity tokens server-side.
//
//   FACEBOOK
//   1. Create an app at developers.facebook.com → get the App ID.
//   2. Set the redirect URI to the Expo scheme — auth-session will
//      print the exact URI when you first run the prompt.
//   3. Paste the App ID into app.json -> extra.oauth.facebookAppId.

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth, type OAuthProvider } from "./AuthContext";

WebBrowser.maybeCompleteAuthSession();

type OAuthConfig = {
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
  facebookAppId?: string;
};

function readConfig(): OAuthConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as { oauth?: OAuthConfig };
  return extra.oauth ?? {};
}

function isGoogleConfigured(cfg: OAuthConfig): boolean {
  if (Platform.OS === "ios") return !!cfg.googleIosClientId;
  if (Platform.OS === "android") return !!cfg.googleAndroidClientId;
  return !!cfg.googleWebClientId;
}

export function useOAuthSignIn() {
  const { loginWithOAuth } = useAuth();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const cfg = readConfig();

  // useIdTokenAuthRequest must be called unconditionally at render time
  // — passing empty strings when not configured is safe; the prompt
  // call below short-circuits before invoking it.
  const [, googleResp, promptGoogle] = Google.useIdTokenAuthRequest({
    iosClientId: cfg.googleIosClientId,
    androidClientId: cfg.googleAndroidClientId,
    clientId: cfg.googleWebClientId,
  });
  const [, fbResp, promptFb] = Facebook.useAuthRequest({
    clientId: cfg.facebookAppId ?? "",
  });

  // Guards against the useEffect firing on the initial null response.
  const googleSeen = useRef<unknown>(null);
  const fbSeen = useRef<unknown>(null);

  useEffect(() => {
    if (!googleResp || googleSeen.current === googleResp) return;
    googleSeen.current = googleResp;
    if (googleResp.type === "success") {
      const idToken = (googleResp.params as { id_token?: string }).id_token;
      if (idToken) {
        loginWithOAuth("google", { idToken })
          .catch((err) =>
            Alert.alert("Google sign-in failed", err instanceof Error ? err.message : "Try again."),
          )
          .finally(() => setBusy(null));
        return;
      }
    }
    if (googleResp.type === "error") {
      Alert.alert("Google sign-in failed", googleResp.error?.message ?? "Try again.");
    }
    setBusy(null);
  }, [googleResp, loginWithOAuth]);

  useEffect(() => {
    if (!fbResp || fbSeen.current === fbResp) return;
    fbSeen.current = fbResp;
    if (fbResp.type === "success") {
      const accessToken = fbResp.authentication?.accessToken;
      if (accessToken) {
        loginWithOAuth("facebook", { accessToken })
          .catch((err) =>
            Alert.alert("Facebook sign-in failed", err instanceof Error ? err.message : "Try again."),
          )
          .finally(() => setBusy(null));
        return;
      }
    }
    if (fbResp.type === "error") {
      Alert.alert("Facebook sign-in failed", fbResp.error?.message ?? "Try again.");
    }
    setBusy(null);
  }, [fbResp, loginWithOAuth]);

  const signIn = useCallback(
    async (provider: OAuthProvider) => {
      if (busy) return;

      if (provider === "google") {
        if (!isGoogleConfigured(cfg)) {
          Alert.alert(
            "Not configured",
            "Google sign-in client IDs aren't set. Add them to app.json under extra.oauth.",
          );
          return;
        }
        setBusy("google");
        try {
          await promptGoogle();
        } catch (err) {
          setBusy(null);
          Alert.alert("Google sign-in failed", err instanceof Error ? err.message : "Try again.");
        }
        return;
      }

      if (provider === "facebook") {
        if (!cfg.facebookAppId) {
          Alert.alert(
            "Not configured",
            "Facebook App ID isn't set. Add it to app.json under extra.oauth.",
          );
          return;
        }
        setBusy("facebook");
        try {
          await promptFb();
        } catch (err) {
          setBusy(null);
          Alert.alert("Facebook sign-in failed", err instanceof Error ? err.message : "Try again.");
        }
        return;
      }

      // Apple: native Sign in with Apple is iOS-only. We hide the button
      // on Android in the screens, so this is a defensive check.
      if (provider === "apple") {
        if (Platform.OS !== "ios") {
          Alert.alert("Apple sign-in", "Sign in with Apple is only available on iOS.");
          return;
        }
        try {
          const available = await AppleAuthentication.isAvailableAsync();
          if (!available) {
            Alert.alert("Unavailable", "Sign in with Apple isn't available on this device.");
            return;
          }
          setBusy("apple");
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            ],
          });
          if (!cred.identityToken || !cred.authorizationCode) {
            throw new Error("Apple didn't return a token. Try again.");
          }
          await loginWithOAuth("apple", {
            identityToken: cred.identityToken,
            authorizationCode: cred.authorizationCode,
            email: cred.email,
            fullName: cred.fullName
              ? {
                  givenName: cred.fullName.givenName,
                  familyName: cred.fullName.familyName,
                }
              : null,
          });
        } catch (err) {
          // ERR_REQUEST_CANCELED is fired when the user backs out — silent.
          const code = (err as { code?: string } | null)?.code;
          if (code !== "ERR_REQUEST_CANCELED") {
            Alert.alert(
              "Apple sign-in failed",
              err instanceof Error ? err.message : "Try again.",
            );
          }
        } finally {
          setBusy(null);
        }
      }
    },
    [busy, cfg, promptGoogle, promptFb, loginWithOAuth],
  );

  return {
    signIn,
    busy,
    // Hide the Apple button on platforms where it can't run.
    appleSupported: Platform.OS === "ios",
  };
}
