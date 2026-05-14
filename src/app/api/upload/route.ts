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

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — enough for a phone photo, not enough to DoS the disk

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  // Auth — only logged-in users can upload. Prevents the URL becoming an
  // anonymous file dump.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type "${file.type}". Use JPEG, PNG, WebP, GIF, or AVIF.` },
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
        mime: file.type,
        width: result.width,
        height: result.height,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Image upload failed." },
        { status: 502 },
      );
    }
  }

  // Dev fallback — write to public/uploads/. Requires a writable filesystem,
  // so this path will not work on Vercel/Fly serverless. Only safe for `npm
  // run dev` or a deploy with a persistent disk.
  const ext = EXT_FROM_MIME[file.type] ?? "bin";
  const filename = `${session.sub.slice(0, 6)}_${randomBytes(8).toString("hex")}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    size: bytes.byteLength,
    mime: file.type,
  });
}
