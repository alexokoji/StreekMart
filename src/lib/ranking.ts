// Exposure ranking: combine engagement, recency, sales-driven exposure score,
// active promotion boost, posting cadence, viewer-follow signal, and a
// verification multiplier into a single score. Used by the feed and
// product rails.
//
// The scorer is generic — same function works for products (sales matter)
// and posts (cadence + follow matter). Caller passes in only the fields
// it has.

export type Rankable = {
  createdAt: Date | string;
  viewCount: number;
  likeCount: number;
  saveCount: number;
  salesCount?: number;
  ownerExposureScore?: number;
  promotionBoost?: number;       // 1.0 if no active promotion
  /**
   * True if the viewer follows the author. Adds a strong (×1.6) boost so
   * followed designers' posts dominate the personalized feed.
   */
  viewerFollows?: boolean;
  /**
   * The author's posting cadence — number of posts in the last 30 days.
   * Posters who keep at it get a small visibility tail-wind: 1 + log10(1+n)
   * caps at ~×1.4 for very active authors so it stays modest.
   */
  authorPostsLast30?: number;
  /**
   * Author has the verified badge for the relevant role (seller for products,
   * designer for posts). Adds a small ×1.15 boost — meaningful but not
   * dominant; quality content still wins.
   */
  verified?: boolean;
  /**
   * Seller rating fields (only relevant for products). Translate into a
   * 0.9×–1.1× multiplier when the seller has accumulated at least
   * RATING_MIN_SAMPLE reviews — below that threshold one disgruntled buyer
   * can't crater a new seller and a single rave can't shoot them to the top.
   */
  sellerRatingAvg?: number;
  sellerRatingCount?: number;
};

const RATING_MIN_SAMPLE = 3;
const RATING_RANGE = 0.1; // 0.9× at avg 1, 1.1× at avg 5, 1.0× at avg 3.

export function rankScore(item: Rankable): number {
  const created = typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt;
  const ageHours = Math.max(1, (Date.now() - created.getTime()) / (1000 * 60 * 60));

  // Engagement weight: views are cheap, likes/saves stronger, sales strongest.
  const engagement =
    item.viewCount * 0.1 +
    item.likeCount * 1.0 +
    item.saveCount * 1.5 +
    (item.salesCount ?? 0) * 3.0;

  // Time decay (Hacker News style).
  const decay = Math.pow(ageHours + 2, 1.4);

  // Owner exposure score lifts well-performing accounts.
  const ownerLift = 1 + Math.log10(1 + (item.ownerExposureScore ?? 0));

  // Promotion multiplier (1.0 if not promoted).
  const promo = item.promotionBoost ?? 1.0;

  // Follow boost — strongest personalization signal.
  const follow = item.viewerFollows ? 1.6 : 1.0;

  // Cadence — capped log so a daily poster gets ~×1.4, a weekly poster ~×1.15.
  const cadence = 1 + Math.log10(1 + (item.authorPostsLast30 ?? 0)) * 0.4;

  // Verification — small but visible bonus.
  const verifiedMul = item.verified ? 1.15 : 1.0;

  // Seller rating — small directional nudge (0.9× to 1.1×) once a seller
  // has enough reviews to be trusted as signal. Below the threshold the
  // multiplier is a no-op so new sellers aren't penalised.
  let ratingMul = 1.0;
  const ratingCount = item.sellerRatingCount ?? 0;
  const ratingAvg = item.sellerRatingAvg ?? 0;
  if (ratingCount >= RATING_MIN_SAMPLE && ratingAvg > 0) {
    // Map [1, 5] → [-1, 1] centered on 3, then scale by RATING_RANGE.
    const centered = (ratingAvg - 3) / 2;
    ratingMul = 1 + centered * RATING_RANGE;
  }

  return ((engagement + 1) / decay) * ownerLift * promo * follow * cadence * verifiedMul * ratingMul;
}

// Bump exposure score on engagement events. Call from API handlers.
export function exposureDelta(event: "like" | "save" | "view" | "sale"): number {
  switch (event) {
    case "view": return 0.01;
    case "like": return 0.1;
    case "save": return 0.2;
    case "sale": return 1.0;
  }
}
