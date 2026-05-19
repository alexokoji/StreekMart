// Client-side image downscaler used by ImageUploader.
//
// Phones routinely produce 5–12 MB JPEGs that would otherwise hit Vercel's
// ~4.5 MB body cap. We resize anything bigger than a sensible "looks good
// at any common viewport" dimension and re-encode at a reasonable JPEG
// quality. The original file is returned unchanged when:
//
//   - it's already small enough,
//   - the browser can't decode it (HEIC on some Android, malformed),
//   - it's an animated format (GIF) where canvas would drop the animation,
//   - the user is on a browser without HTMLImageElement / canvas (server
//     rendering tests; production browsers all have it).
//
// `targetMaxBytes` is the soft target — once the encoded output dips below
// it we stop iterating. The hard server cap is 4 MB (MAX_BYTES in
// /api/upload), so we aim a bit lower to leave room for the multipart
// envelope.

const MAX_DIMENSION = 2000;        // px — long edge after downscaling
const TARGET_MAX_BYTES = 3.2 * 1024 * 1024;
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024; // don't bother re-encoding small files
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

export async function downscaleImage(file: File): Promise<File> {
  // Animated GIFs lose every frame after the first when drawn to a 2D
  // canvas. Return the original and let the server's size check reject it
  // if it's too big.
  if (file.type === "image/gif") return file;

  if (file.size <= SKIP_BELOW_BYTES) return file;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  let bitmap: HTMLImageElement | null = null;
  try {
    bitmap = await loadImage(file);
  } catch {
    // Couldn't decode (HEIC on browsers without support, corrupt bytes).
    // Let the upload route surface a real error.
    return file;
  }

  const { naturalWidth, naturalHeight } = bitmap;
  if (!naturalWidth || !naturalHeight) return file;

  const longest = Math.max(naturalWidth, naturalHeight);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const targetW = Math.round(naturalWidth * scale);
  const targetH = Math.round(naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  // Pick a re-encode mime. PNG stays PNG when it has transparency hints
  // (the only safe heuristic without decoding alpha — keeping it small
  // here means falling back to JPEG, which would lose alpha). For
  // everything else, JPEG gives the best size/quality.
  const outMime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const outExt = outMime === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");

  // Iterate quality until we're under the target. JPEG: lower quality
  // helps. PNG: quality is ignored, so we only get one pass — the resize
  // alone has to be enough.
  let blob: Blob | null = null;
  if (outMime === "image/png") {
    blob = await canvasToBlob(canvas, outMime);
  } else {
    for (const q of QUALITY_STEPS) {
      blob = await canvasToBlob(canvas, outMime, q);
      if (blob && blob.size <= TARGET_MAX_BYTES) break;
    }
  }
  if (!blob) return file;

  // If somehow we ended up larger than what we started with (rare — small
  // PNGs that compress poorly as JPEG), keep the original.
  if (blob.size >= file.size) return file;

  return new File([blob], `${baseName}.${outExt}`, {
    type: outMime,
    lastModified: Date.now(),
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}
