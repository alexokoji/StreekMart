// Client-side dominant-color extractor.
//
// Renders the user's image to a downscaled canvas, samples its pixels, and
// runs lightweight k-means to return the top N hex codes. Runs in the
// browser only — never imported from server code.
//
// Why this exists: image search needs to send *something* to the server, and
// we don't want to ship raw images for every search. Extracting 4 dominant
// colors keeps the request tiny (a few bytes) and gives the bot enough to
// match against products with stored color palettes.

const CANVAS_SIZE = 100; // downscale max dimension; pixel sampling cap = CANVAS_SIZE^2

type RGB = [number, number, number];

export async function extractDominantColors(
  source: File | string,
  count = 4,
): Promise<string[]> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const pixels = sampleCanvasPixels(img);
    if (pixels.length === 0) return [];
    const centers = kmeans(pixels, count, 8);
    return centers.map(rgbToHex);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

function sampleCanvasPixels(img: HTMLImageElement): RGB[] {
  const ratio = img.width / img.height;
  const w = ratio >= 1 ? CANVAS_SIZE : Math.round(CANVAS_SIZE * ratio);
  const h = ratio >= 1 ? Math.round(CANVAS_SIZE / ratio) : CANVAS_SIZE;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Tainted canvas — image was loaded cross-origin without CORS. Bail.
    return [];
  }

  // Skip near-transparent and almost-pure-white/black pixels (background, noise).
  const out: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 12) continue;       // near-black
    if (min > 245) continue;      // near-white
    out.push([r, g, b]);
  }
  return out;
}

// Tiny k-means in RGB space. Not perceptually accurate but plenty for the
// "give me 4 dominant colors" use case at small canvas sizes.
function kmeans(points: RGB[], k: number, iterations: number): RGB[] {
  if (points.length <= k) return points;

  // Seed: spread evenly across the points (deterministic so runs are stable).
  const step = Math.floor(points.length / k);
  let centers: RGB[] = Array.from({ length: k }, (_, i) => points[i * step]);

  for (let iter = 0; iter < iterations; iter++) {
    const buckets: RGB[][] = Array.from({ length: k }, () => []);
    for (const p of points) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const d = sqDist(p, centers[i]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      buckets[best].push(p);
    }
    const next: RGB[] = centers.map((c, i) => mean(buckets[i]) ?? c);
    if (centersEqual(centers, next)) break;
    centers = next;
  }
  // Sort by bucket size descending so the "most dominant" color is first.
  // We re-cluster once to count.
  const counts = new Array(k).fill(0);
  for (const p of points) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const d = sqDist(p, centers[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    counts[best]++;
  }
  return centers
    .map((c, i) => ({ c, n: counts[i] }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.c);
}

function sqDist(a: RGB, b: RGB): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function mean(points: RGB[]): RGB | null {
  if (points.length === 0) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of points) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  return [
    Math.round(r / points.length),
    Math.round(g / points.length),
    Math.round(b / points.length),
  ];
}

function centersEqual(a: RGB[], b: RGB[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2]) return false;
  }
  return true;
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
