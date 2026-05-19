import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { isCloudinaryEnabled, uploadBufferToCloudinary } from "@/lib/cloudinary";

// Force Node runtime — we use fs/promises and crypto, both unavailable on edge.
export const runtime = "nodejs";

// POST /api/upload   (multipart/form-data, field name: "file")
//
// Saves a single uploaded image and returns its URL.
//
// In production (Cloudinary keys set), bytes go to Cloudinary and we return
// the secure HTTPS URL. In dev (no keys), bytes go to public/uploads/ on the
// local filesystem so the developer doesn't need a Cloudinary account just
// to run the app. The component contract (POST → { url }) is identical
// across both backends.

// 4 MB cap. Lower than what a raw phone photo would be, but Vercel's
// Hobby tier rejects multipart bodies over ~4.5 MB at the proxy before our
// route runs. The client downscales aggressively (see ImageUploader's
// downscaleImage) so almost everything fits well under this — the cap is
// a safety net for whatever slips through.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

// Some Android pickers and a few in-app browsers (Instagram, Messenger) hand
// images through with an empty or "application/octet-stream" `file.type`.
// Sniff the extension instead so a legitimate JPEG from those flows isn't
// rejected as "Unsupported image type".
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function resolveMime(file: File): string | null {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export async function POST(req: Request) {
  // Auth — only logged-in users can upload. Prevents the URL becoming an
  // anonymous file dump.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch (err) {
    // Body too big at the proxy, malformed multipart, or stream aborted —
    // all show up as a formData() throw. Surface the real reason so the
    // client doesn't get the misleading "Missing 'file' field" instead.
    console.error("[upload] formData() failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? `Couldn't read the upload (${err.message}).`
            : "Couldn't read the upload. The file may be too large for your network or the host.",
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  const mime = resolveMime(file);
  if (!mime) {
    return NextResponse.json(
      {
        error: `Unsupported image type${file.type ? ` "${file.type}"` : ""}. Use JPEG, PNG, WebP, GIF, or AVIF.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Production path — push to Cloudinary and return the CDN URL.
  if (isCloudinaryEnabled()) {
    try {
      const result = await uploadBufferToCloudinary({
        buffer: bytes,
        folder: `upclo/${session.sub.slice(0, 8)}`,
      });
      return NextResponse.json({
        url: result.url,
        size: result.bytes,
        mime,
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      // Surface the Cloudinary message verbatim — "Invalid API key", "Invalid
      // signature", credential typos, network blocks etc. are all helpful to
      // see in the dashboard rather than masked as a generic failure.
      console.error("[upload] Cloudinary upload failed:", err);
      const detail =
        err instanceof Error && err.message
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message: unknown }).message)
            : "Image upload failed.";
      return NextResponse.json(
        { error: `Image upload failed: ${detail}` },
        { status: 502 },
      );
    }
  }

  // Production without Cloudinary configured would silently write to a
  // read-only / ephemeral filesystem and hand back a /uploads/<file> URL
  // that Next.js never serves in standalone mode — the image appears to
  // upload but renders broken. Fail loudly so the operator notices the
  // missing env vars instead of debugging mystery 404s.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[upload] CLOUDINARY_* env vars are not set; refusing to use the dev filesystem fallback in production.",
    );
    return NextResponse.json(
      {
        error:
          "Image hosting isn't configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET, then redeploy.",
      },
      { status: 503 },
    );
  }

  // Dev fallback — write to public/uploads/. Only runs locally.
  const ext = EXT_FROM_MIME[mime] ?? "bin";
  const filename = `${session.sub.slice(0, 6)}_${randomBytes(8).toString("hex")}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    size: bytes.byteLength,
    mime,
  });
}
