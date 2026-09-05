// One-off: reverse UTF-8-decoded-as-Windows-1252 mojibake ("â€¦" → "…",
// "â€"" → "—", etc.) that crept into comments and a few user-facing
// strings (login button, email templates). Only touches runs that start
// with Â/Ã (the mojibake lead-byte signature) and continue with Latin-1-
// supplement or already-mapped cp1252-punctuation codepoints, so genuine
// correctly-encoded text elsewhere in the file is never touched.
import { readFileSync, writeFileSync } from "fs";

const files = [
  "prisma/schema.prisma",
  "src/app/account/page.tsx",
  "src/app/api/admin/delivery-cities/route.ts",
  "src/app/api/admin/email/route.ts",
  "src/app/api/admin/email/test/route.ts",
  "src/app/api/admin/settings/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/register/route.ts",
  "src/lib/auth.ts",
  "src/lib/email.ts",
];

// Windows-1252 code points for bytes 0x80-0x9F (0xA0-0xFF match Latin-1 / Unicode 1:1).
const CP1252_80_9F = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
const mappedCodepoints = Object.values(CP1252_80_9F); // punctuation reachable via 0x80-0x9F

function cp1252CharToByte(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x80) return cp; // ASCII passes through unchanged
  if (cp >= 0xa0 && cp <= 0xff) return cp; // Latin-1 supplement == cp1252 here
  const byte = Object.keys(CP1252_80_9F).find((b) => CP1252_80_9F[b] === cp);
  return byte !== undefined ? Number(byte) : null;
}

function fixRun(run) {
  const bytes = [];
  for (const ch of run) {
    const b = cp1252CharToByte(ch);
    if (b === null) return run; // shouldn't happen given the regex below, but bail safely
    bytes.push(b);
  }
  try {
    const decoded = Buffer.from(bytes).toString("utf8");
    // Guard against accidental corruption: only accept if decode produced no
    // replacement characters (U+FFFD), i.e. the byte sequence was valid UTF-8.
    return decoded.includes("�") ? run : decoded;
  } catch {
    return run;
  }
}

// A run: starts with Â or Ã, continues with chars in Latin-1 supplement
// ( -ÿ) or the specific cp1252-mapped punctuation set above.
const continuationClass = "\\u00a0-\\u00ff" + mappedCodepoints.map((cp) => `\\u${cp.toString(16).padStart(4, "0")}`).join("");
const RUN = new RegExp(`[\\u00c2\\u00c3\\u00e2\\u00f0][${continuationClass}]+`, "gu");

let totalFixed = 0;
for (const rel of files) {
  const before = readFileSync(rel, "utf8");
  const after = before.replace(RUN, fixRun);
  if (after !== before) {
    writeFileSync(rel, after, "utf8");
    console.log("Fixed:", rel);
    totalFixed++;
  } else {
    console.log("No change:", rel);
  }
}
console.log(`Done. ${totalFixed} file(s) changed.`);
