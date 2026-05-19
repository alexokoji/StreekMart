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
}): Promise<{ url: string; publicId: string; bytes: number; width?: number; height?: number }> {
  const cl = getCloudinary();
  const result: UploadApiResponse = await new Promise((resolve, reject) => {
    const stream = cl.uploader.upload_stream(
      {
        folder: args.folder,
        public_id: args.publicId,
        resource_type: "image",
        // Cloudinary auto-generates a unique public_id when none is supplied,
        // so we don't need `unique_filename`/`overwrite` flags here — they
        // were no-ops without `use_filename: true`. Leaving them out keeps
        // the request payload minimal so a stricter Cloudinary plan or a
        // signature mismatch can't trip on unexpected fields.
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

// Helper to build an optimised delivery URL with auto-format / auto-quality.
// Components that already store the secure_url can use this if they want a
// transformed variant (e.g. thumbnail). Stored URLs already work as-is —
// this is just an opt-in.
export function buildOptimisedUrl(secureUrl: string, transform = "f_auto,q_auto"): string {
  // Cloudinary URLs look like:
  //   https://res.cloudinary.com/<cloud>/image/upload/<public_id>.<ext>
  // We splice the transform in just after `/upload/`.
  return secureUrl.replace("/upload/", `/upload/${transform}/`);
}
