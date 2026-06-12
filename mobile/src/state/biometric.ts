import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

// User preference -- whether to require biometric on every cold start.
// Stored in AsyncStorage (NOT SecureStore) because losing this on
// reinstall is fine; the actual auth token lives in SecureStore and
// works without biometric if the user turns it off.
const KEY = "streekmart:biometric-enabled";

export type BiometricState = {
  // True if the device has any biometric hardware enrolled
  // (Face ID, Touch ID, or Android fingerprint).
  hardwareAvailable: boolean;
  // True if the user has TOGGLED the feature on in Settings.
  userOptedIn: boolean;
  // The friendly label used in the prompt -- "Face ID" / "Touch ID" /
  // "Fingerprint" depending on platform + enrolment.
  friendlyName: string;
};

export async function readBiometricState(): Promise<BiometricState> {
  const [hasHardware, supported, enrolled, stored] = await Promise.all([
    LocalAuthentication.hasHardwareAsync().catch(() => false),
    LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as LocalAuthentication.AuthenticationType[]),
    LocalAuthentication.isEnrolledAsync().catch(() => false),
    AsyncStorage.getItem(KEY).catch(() => null),
  ]);
  const hardwareAvailable = hasHardware && enrolled;
  let friendlyName = "Biometric";
  if (supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    friendlyName = "Face ID";
  } else if (supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    friendlyName = "Fingerprint";
  }
  return {
    hardwareAvailable,
    userOptedIn: stored === "1",
    friendlyName,
  };
}

export async function setBiometricEnabled(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? "1" : "0");
}

// Prompt for biometric. Returns true if authenticated (or if biometric
// isn't applicable -- caller treats that as a pass too).
export async function promptBiometric(reason: string): Promise<boolean> {
  const state = await readBiometricState();
  if (!state.hardwareAvailable || !state.userOptedIn) return true;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Use password",
    disableDeviceFallback: false,
  });
  return res.success;
}