import { NextResponse } from "next/server";

// GET /.well-known/assetlinks.json
// Lets Android open streekmart links (e.g. a seller's /shop/<name> link)
// straight in the app when it's installed. Android requires the app's signing
// certificate fingerprint here. Set ANDROID_APP_CERT_SHA256 to one or more
// SHA-256 fingerprints, comma-separated (the Play App Signing key for the
// store build; a test build's key for sideloaded APKs). Unset = no entries.
export const dynamic = "force-dynamic";

export async function GET() {
  const fingerprints = (process.env.ANDROID_APP_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "com.streekmart.app",
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
