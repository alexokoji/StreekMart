// Shared image-pick + upload helper.
//
// Wraps expo-image-picker so each screen gets:
//   - Modern SDK 56 mediaTypes (the old MediaTypeOptions enum is
//     deprecated; we use the array form).
//   - A "Choose from library" + "Take a photo" prompt, with the right
//     permission check per option.
//   - Optional multi-select.
//   - A uniform uploadImage(uri) → URL exchange that posts to the
//     server's upload endpoint and returns the hosted URL.

import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
// SDK 56 split expo-file-system into the new File-based API and a
// legacy namespace. uploadAsync (with native multipart upload) lives
// in the legacy module — that's still the cleanest cross-platform
// path so we use it explicitly.
import * as FileSystem from "expo-file-system/legacy";

// `FileSystem.FileSystemUploadType.MULTIPART` is sometimes undefined
// at runtime in SDK 56 (Metro mishandles the re-exported enum across
// the /legacy submodule boundary). The native upload module reads the
// numeric value directly, so hard-coding 1 sidesteps the issue.
// Source: expo-file-system/src/legacy/FileSystem.types.ts
//   enum FileSystemUploadType { BINARY_CONTENT = 0, MULTIPART = 1 }
const UPLOAD_TYPE_MULTIPART = 1;
import Constants from "expo-constants";
import { getAuthToken } from "../api/client";

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "https://www.streekmart.online";

// Single canonical endpoint — same path the web ImageUploader posts to.
// POST multipart/form-data with field "file", returns { url, size, mime,
// width?, height? }. Defined in src/app/api/upload/route.ts on the web.
const UPLOAD_ENDPOINT = "/api/upload";

export type PickedAsset = ImagePicker.ImagePickerAsset;

export type PickOptions = {
  multiple?: boolean;
  // Square crop for avatars, 16:9 for banners, undefined for natural.
  aspect?: [number, number];
  allowsEditing?: boolean;
};

// Prompt the user to choose camera or library, request the matching
// permission, then return the picked asset(s). Resolves to [] when the
// user cancels or denies a permission.
export async function pickImages(opts: PickOptions = {}): Promise<PickedAsset[]> {
  return new Promise((resolve) => {
    Alert.alert("Add photo", "Choose a source", [
      {
        text: "Take a photo",
        onPress: async () => resolve(await runCamera(opts)),
      },
      {
        text: "Choose from library",
        onPress: async () => resolve(await runLibrary(opts)),
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve([]) },
    ]);
  });
}

async function runCamera(opts: PickOptions): Promise<PickedAsset[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Camera off", "Allow camera access in your phone settings to take a photo.");
    return [];
  }
  const picked = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    aspect: opts.aspect,
    allowsEditing: opts.allowsEditing ?? !!opts.aspect,
  });
  if (picked.canceled || picked.assets.length === 0) return [];
  return picked.assets;
}

async function runLibrary(opts: PickOptions): Promise<PickedAsset[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Photos off", "Allow photo library access in your phone settings.");
    return [];
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsMultipleSelection: opts.multiple ?? false,
    selectionLimit: opts.multiple ? 8 : 1,
    aspect: opts.aspect,
    allowsEditing: opts.allowsEditing ?? (!!opts.aspect && !opts.multiple),
  });
  if (picked.canceled || picked.assets.length === 0) return [];
  return picked.assets;
}

// Upload a picked asset to the server.
//
// React Native 0.74+ ships with a stricter FormData polyfill, and
// fetch()'ing a file:// URI is unreliable across iOS/Android/Expo Go —
// we hit "Unsupported FormDataPart implementation" or "couldn't read"
// errors depending on the path. The robust solution is
// FileSystem.uploadAsync, which uses the native multipart upload stack
// on each platform (NSURLSession on iOS, OkHttp on Android) and never
// touches JS FormData. It also supports the same file:// URIs we get
// from expo-image-picker without any conversion step.
export async function uploadImage(asset: PickedAsset): Promise<string> {
  const token = await getAuthToken();

  const result = await FileSystem.uploadAsync(`${API_URL}${UPLOAD_ENDPOINT}`, asset.uri, {
    httpMethod: "POST",
    uploadType: UPLOAD_TYPE_MULTIPART,
    fieldName: "file",
    mimeType: asset.mimeType ?? "image/jpeg",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Body is always returned as text; parse defensively.
  let body: unknown = null;
  try {
    body = JSON.parse(result.body);
  } catch {
    body = null;
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${result.status}`,
    );
  }
  const url = (body as { url?: string } | null)?.url;
  if (typeof url === "string" && url.length > 0) {
    // Cloudinary returns an absolute https URL. The dev fallback returns
    // a relative "/uploads/<file>" path — prefix it with API_URL so
    // <Image source={{ uri }} /> can fetch it from the mobile device.
    return url.startsWith("/") ? `${API_URL}${url}` : url;
  }
  throw new Error("Upload succeeded but the server didn't return a URL.");
}
