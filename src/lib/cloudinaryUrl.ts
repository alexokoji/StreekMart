// String-only Cloudinary URL helpers. Lives separate from lib/cloudinary.ts
// (which imports the server-side SDK) so client components can pull these
// without dragging the SDK into the browser bundle.

// Splice a transform string into a Cloudinary delivery URL just after
// `/upload/`. Non-Cloudinary URLs fall through untouched.
export function buildOptimisedUrl(secureUrl: string, transform = "f_auto,q_auto"): string {
  if (!secureUrl || !secureUrl.includes("/upload/")) return secureUrl;
  return secureUrl.replace("/upload/", `/upload/${transform}/`);
}

// Delivery-time watermark for designer feed posts. Composites a small
// "StreekMart" wordmark into the bottom-right of the image so screenshots
// keep attribution. Applied via URL transform so the original asset stays
// pristine — tuning the watermark is a one-line code change, no re-upload.
//
// Transform anatomy:
//   l_text:<font>_<size>_<weight>:<text>   → text overlay layer
//   co_white                                → text colour
//   o_42                                    → 42% opacity (subtle)
//   g_south_east,x_24,y_24                  → bottom-right inset
//   f_auto,q_auto                           → format + quality auto
export function buildWatermarkedUrl(secureUrl: string): string {
  if (!secureUrl || !secureUrl.includes("/upload/")) return secureUrl;
  if (secureUrl.includes("l_text:")) return secureUrl; // already watermarked
  const wm = "l_text:Arial_38_bold:StreekMart,co_white,o_42,g_south_east,x_24,y_24";
  return secureUrl.replace("/upload/", `/upload/${wm}/f_auto,q_auto/`);
}
