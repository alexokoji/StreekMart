// Campaign template registry for the admin Email Marketing tool.
//
// Each entry is a pre-baked engagement nudge that picks an audience and
// supplies subject + HTML body copy. Admins pick a template from the
// gallery, optionally tweak the copy, then send through the existing
// rate-limited broadcast pipeline.
//
// Naming convention:
//   <audience>-<intent>  (e.g. seller-add-first-product, buyer-new-arrivals)
//
// Adding a new template:
//   1. Add an entry below.
//   2. Pick the `segment` from src/lib/audienceSegments.ts (or add a new
//      segment there first).
//   3. Templates are pure functions of `(args) => {subject, html}` — the
//      args object is supplied at send time so the copy can interpolate
//      things like the recipient's first name.

import type { AudienceSegmentKey } from "./audienceSegments";

export const CAMPAIGN_TEMPLATES = {
  // ─── Sellers ───────────────────────────────────────────────────────────
  "seller-add-first-product": {
    title: "Add your first product",
    audience: "Sellers with 0 active listings",
    segment: "sellers-no-products" satisfies AudienceSegmentKey,
    description:
      "Nudges sellers who joined but never listed anything. Use sparingly — once per week is plenty.",
    subject: "Your storefront is ready — list your first piece",
    body: `<p>Hi {{name}},</p>
<p>You signed up to sell on StreekMart but haven&rsquo;t added any listings yet. The longer your storefront sits empty, the harder it is for buyers to find you.</p>
<p>It only takes a couple of minutes — snap a photo, set a price, and you&rsquo;re live.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/seller/products/new" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">List my first product</a></p>
<p style="margin-top:24px; color:#525258; font-size:13px;">Stuck on what to list? Most sellers start with the piece they&rsquo;re proudest of and add more once the first sale comes in.</p>`,
  },
  "seller-refresh-inventory": {
    title: "Refresh your inventory",
    audience: "Sellers with ≥1 active listing",
    segment: "sellers-active" satisfies AudienceSegmentKey,
    description:
      "End-of-month nudge to update stock numbers, retire sold-out pieces, and add anything new.",
    subject: "Quick check — are your listings still in stock?",
    body: `<p>Hi {{name}},</p>
<p>Buyers trust storefronts that stay current. Take a minute to:</p>
<ul>
  <li>Confirm stock numbers on every active listing</li>
  <li>Archive anything that&rsquo;s sold elsewhere</li>
  <li>Add any pieces you&rsquo;ve made since your last update</li>
</ul>
<p style="margin-top:24px;"><a href="{{appUrl}}/seller/products" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Open my products</a></p>`,
  },
  "seller-promote-top-product": {
    title: "Promote your best piece",
    audience: "Verified sellers with ≥3 listings",
    segment: "sellers-verified-multiple" satisfies AudienceSegmentKey,
    description:
      "Drives revenue from the platform's paid promotion feature. The CTA routes sellers to the boost flow.",
    subject: "Get more eyes on your best piece — boost it",
    body: `<p>Hi {{name}},</p>
<p>For ₦500 your top product can sit at the front of the homepage slider for 3 days. Recent boosts have added <strong>3–8× the views</strong> over their run.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/seller/products" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Pick a product to boost</a></p>
<p style="margin-top:24px; color:#525258; font-size:13px;">Promotions are subject to admin review (usually within an hour). Rejected promotions are auto-refunded to your wallet.</p>`,
  },

  // ─── Designers ─────────────────────────────────────────────────────────
  "designer-first-post": {
    title: "Share what you're working on",
    audience: "Designers with 0 posts",
    segment: "designers-no-posts" satisfies AudienceSegmentKey,
    description:
      "Designers without posts get no feed exposure. This nudges them to put their first piece in the feed.",
    subject: "Your portfolio is missing — post your first piece",
    body: `<p>Hi {{name}},</p>
<p>Buyers find designers through the feed — and your portfolio is empty. One post (a sketch, a finished piece, a fabric you&rsquo;re working with) puts you in the feed&rsquo;s discovery ranks.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/designer/posts/new" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Create my first post</a></p>`,
  },
  "designer-open-commissions": {
    title: "Open up to commissions",
    audience: "Verified designers with no commission requests yet",
    segment: "designers-no-commissions" satisfies AudienceSegmentKey,
    description:
      "Tells designers that buyers can now request bespoke pieces and walks them through the commission flow.",
    subject: "Buyers can now request custom pieces from you",
    body: `<p>Hi {{name}},</p>
<p>Buyers can send you commission briefs directly from your profile — you set the quote, the timeline, and the delivery code. Approved work pays out to your wallet on completion.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/designer/commissions" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">See how it works</a></p>
<p style="margin-top:24px; color:#525258; font-size:13px;">Tip — share your profile URL on Instagram or WhatsApp. Buyers who came in via a designer&rsquo;s own channel convert at roughly twice the rate.</p>`,
  },
  "designer-lookbook-prompt": {
    title: "Build a look-book",
    audience: "Designers with ≥3 posts but 0 look-books",
    segment: "designers-no-lookbooks" satisfies AudienceSegmentKey,
    description:
      "Look-books bundle a designer's posts into a single shareable URL — drives repeat traffic from their own social channels.",
    subject: "Group your work into a shareable look-book",
    body: `<p>Hi {{name}},</p>
<p>A look-book turns a body of work into one shareable URL — perfect for Aso Ebi seasons, bridal collections, or themed drops. Add a title, pick the posts, and you can share the link anywhere.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/designer/lookbooks/new" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Create my first look-book</a></p>`,
  },

  // ─── Buyers ────────────────────────────────────────────────────────────
  "buyer-new-arrivals": {
    title: "What's new this week",
    audience: "All buyers",
    segment: "buyers-all" satisfies AudienceSegmentKey,
    description:
      "Generic 'check out new stuff' nudge. Pair with the homepage rails by linking the CTA to `/`.",
    subject: "Fresh pieces just landed on StreekMart",
    body: `<p>Hi {{name}},</p>
<p>This week&rsquo;s drops are live — new fabrics, ready-to-wear, and one-off designer pieces from across the country.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Browse new arrivals</a></p>`,
  },
  "buyer-discover-designers": {
    title: "Discover designers",
    audience: "All buyers",
    segment: "buyers-all" satisfies AudienceSegmentKey,
    description:
      "Highlights the designer feed for buyers who only ever browse the storefront grid.",
    subject: "Meet the designers behind the pieces",
    body: `<p>Hi {{name}},</p>
<p>Behind every StreekMart product is an independent maker. The feed is where they share works-in-progress, finished pieces, and the references behind their drops.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/feed" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Open the feed</a></p>`,
  },
  "buyer-abandoned-cart": {
    title: "You left something behind",
    audience: "Buyers with items in cart for ≥2 days",
    segment: "buyers-abandoned-cart" satisfies AudienceSegmentKey,
    description:
      "Classic abandoned-cart nudge. Highest-converting template — buyer already showed intent.",
    subject: "Still thinking about it? Your cart's waiting",
    body: `<p>Hi {{name}},</p>
<p>You have something in your cart on StreekMart. Stock turns over fast — if you were on the fence, this is a good day to check out.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/cart" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Open my cart</a></p>`,
  },
  "buyer-welcome-back": {
    title: "Welcome back",
    audience: "Buyers inactive for ≥14 days",
    segment: "buyers-inactive" satisfies AudienceSegmentKey,
    description:
      "Re-engagement message for buyers who haven't logged in. Keep the copy short — long-form copy reads as 'salesy'.",
    subject: "It's been a minute — see what's new",
    body: `<p>Hi {{name}},</p>
<p>You haven&rsquo;t been on StreekMart in a while. New designers have joined, prices have moved, and your favourite categories have fresh stock.</p>
<p style="margin-top:24px;"><a href="{{appUrl}}/" style="display:inline-block; padding:10px 18px; background:#7c3aed; color:#ffffff; text-decoration:none; border-radius:10px; font-weight:600;">Take a look</a></p>`,
  },
} as const;

export type CampaignTemplateKey = keyof typeof CAMPAIGN_TEMPLATES;
export type CampaignTemplate = (typeof CAMPAIGN_TEMPLATES)[CampaignTemplateKey];
export const ALL_CAMPAIGN_TEMPLATE_KEYS = Object.keys(CAMPAIGN_TEMPLATES) as CampaignTemplateKey[];

/**
 * Tiny mustache-style interpolator. Replaces `{{name}}`, `{{appUrl}}`,
 * etc. in the subject and body. Anything unknown is left as-is so a
 * template with a `{{foo}}` typo still renders without crashing.
 */
export function renderTemplateString(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}
