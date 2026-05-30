// Thin wrapper around the Cloudinary v2 SDK.
//
// We isolate the SDK import behind `getCloudinary()` so the rest of the
// codebase doesn't need to know about its global singleton config. Calling
// `getCloudinary()` is a no-op after the first call.

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

export function isCloudinaryEnabled(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

// Stream a buffer up to Cloudinary. Returns the secure HTTPS URL of the
// stored asset. Errors bubble up so the route handler can map them to a
// 5xx response.
export async function uploadBufferToCloudinary(args: {
  buffer: Buffer;
  folder: string;
  publicId?: string;
  // "image" → product photos / avatars (existing behaviour).
  // "video" → MediaRecorder audio/video clips (Cloudinary stores both
  //           under the video pipeline; audio gets transcoded server-side).
  // "raw"  → opaque file payloads (PDF, docx, zip etc.) served as
  //          downloads.
  // "auto" → let Cloudinary detect from the bytes. Cheapest for "user
  //          could upload anything" surfaces like chat attachments.
  resourceType?: "image" | "video" | "raw" | "auto";
  // Original filename, used by Cloudinary to derive an extension on the
  // delivered URL when resourceType is "raw" so a PDF actually downloads
  // as foo.pdf and not foo.bin.
  originalFilename?: string;
}): Promise<{ url: string; publicId: string; bytes: number; width?: number; height?: number }> {
  const cl = getCloudinary();
  const result: UploadApiResponse = await new Promise((resolve, reject) => {
    const stream = cl.uploader.upload_stream(
      {
        folder: args.folder,
        public_id: args.publicId,
        resource_type: args.resourceType ?? "image",
        ...(args.originalFilename
          ? { use_filename: true, unique_filename: true, filename_override: args.originalFilename }
          : {}),
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error("Cloudinary upload failed"));
        else resolve(res);
      },
    );
    stream.end(args.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
  };
}

// String-only URL helpers (buildOptimisedUrl, buildWatermarkedUrl) live in
// lib/cloudinaryUrl.ts so client components can import them without
// dragging the Cloudinary SDK into the browser bundle. Re-export here for
// callers that already import everything from this module.
export { buildOptimisedUrl, buildWatermarkedUrl } from "./cloudinaryUrl";
