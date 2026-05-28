import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isCloudinaryEnabled, uploadBufferToCloudinary } from "@/lib/cloudinary";

// Force Node runtime — fs/promises + crypto + cloudinary all need it.
export const runtime = "nodejs";

// POST /api/chats/[id]/attachment   (multipart/form-data, field name: "file")
//
// Generic chat attachment upload. Accepts any file type up to 8 MB. The
// existing `/api/upload` route is image-specific and downscales aggressively;
// this one is the "anything goes" sibling for chat-style sends — voice
// notes (audio), short videos, PDFs, docs, etc.
//
// Returns { url, mime, size, name } so the client can POST the message
// with full metadata in one round-trip.

// 8 MB cap — twice the image route's limit so voice notes / short videos
// fit comfortably. Vercel's Hobby tier rejects multipart bodies above
// ~4.5 MB at the proxy, so production users on Hobby will hit that ceiling
// first. Move to a presigned-upload flow if you need much larger files.
const MAX_BYTES = 8 * 1024 * 1024;

function inferResourceType(mime: string): "image" | "video" | "raw" | "auto" {
  if (mime.startsWith("image/")) return "image";
  // Cloudinary's video pipeline handles audio too (MediaRecorder webm /
  // mp4 / opus all land here).
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "video";
  return "raw";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Participant gate — uploads scoped to chats the user is in.
  const member = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId: params.id, userId: session.sub } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("[chat-attachment] formData() failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message
            ? `Couldn't read the upload (${err.message}).`
            : "Couldn't read the upload.",
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const mime = file.type || "application/octet-stream";
  const originalName = file.name || "attachment";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isCloudinaryEnabled()) {
    try {
      const result = await uploadBufferToCloudinary({
        buffer: bytes,
        folder: `upclo/chat/${params.id}`,
        resourceType: inferResourceType(mime),
        originalFilename: originalName,
      });
      return NextResponse.json({
        url: result.url,
        mime,
        size: result.bytes,
        name: originalName,
      });
    } catch (err) {
      console.error("[chat-attachment] Cloudinary upload failed:", err);
      const detail =
        err instanceof Error && err.message
          ? err.message
          : "Attachment upload failed.";
      return NextResponse.json(
        { error: `Attachment upload failed: ${detail}` },
        { status: 502 },
      );
    }
  }

  // Production fallback should refuse silently — saving to a read-only
  // serverless filesystem would create dead URLs. Tells the operator to
  // wire Cloudinary.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "File hosting isn't configured on the server. Set CLOUDINARY_* env vars and redeploy.",
      },
      { status: 503 },
    );
  }

  // Dev fallback — write to public/uploads/. Preserves the original
  // extension where the filename has one.
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";
  const filename = `${session.sub.slice(0, 6)}_${randomBytes(8).toString("hex")}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    mime,
    size: bytes.byteLength,
    name: originalName,
  });
}
