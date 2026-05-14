# UpClo — Fashion Marketplace

A fashion-only marketplace for materials, clothing, accessories, and designer content. Multi-role accounts (Buyer + opt-in Seller + opt-in Designer), AI-powered concierge & validation, cart/wishlist/checkout, and a Facebook-style designer feed.

Built with Next.js 14 (App Router), TypeScript, Prisma + SQLite, Tailwind, JWT, and the Anthropic SDK (Claude Opus 4.7) with prompt caching, tool use, and structured outputs.

## Core principle: Fashion only

UpClo enforces a fashion-only allowlist on every listing. Categories outside the allowlist are rejected before persistence, and the AI validator runs a semantic second check that catches non-fashion items even within an allowed category (e.g. a phone disguised as a "Watch"). Electronics, phones, TVs, gaming devices, vehicles, appliances → blocked.

Allowlist (single source of truth: [src/lib/enums.ts](src/lib/enums.ts)):

| Group       | Categories |
|-------------|------------|
| Materials   | Ankara, Lace, Linen, Cotton, Silk, Denim, Chiffon, Velvet, Satin, Sewing Supplies, Tailoring Tools |
| Clothing    | Tops, Bottoms, Dresses, Outerwear, Native Wear, Activewear, Loungewear |
| Accessories | Shoes, Bags, Jewelry, Watches, Sunglasses, Hats, Belts, Scarves |
| Beauty      | Beauty |

## Multi-role permissions

Every account is implicitly a **Buyer** — they can shop the storefront, cart, and wishlist. Two opt-in permissions stack on top:

| Permission | Capability |
|------------|------------|
| **Seller** | List products and materials. Manage inventory and orders. Run promotions. |
| **Designer** | Publish portfolio posts. Use the Sketch Studio. List products (designers can also sell). |

A user can be any combination — `Buyer`, `Buyer + Seller`, `Buyer + Designer`, or `Buyer + Seller + Designer`. Permissions are toggled at [/account](src/app/account/page.tsx); a new cookie is issued on toggle so the next request reflects the new permissions.

Route gating is enforced by [src/middleware.ts](src/middleware.ts). Unauthorized access → `/unauthorized`.

## Tech stack

- **Next.js 14** App Router, server components, route handlers
- **TypeScript** strict mode
- **Prisma + SQLite** (swap provider to `postgresql` for production)
- **JWT auth** with `jose` + httpOnly cookies + edge middleware gating
- **Tailwind CSS** with a luxury black/white/champagne-gold design system and an emerald + burgundy accent
- **Zod** for request validation
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude Opus 4.7, prompt caching, tool use, structured outputs

## Quick start

```powershell
npm install
# Set ANTHROPIC_API_KEY in .env (optional but recommended)
npm run setup       # generate Prisma client, push schema, seed
npm run dev
```

Open http://localhost:3000.

### Demo accounts (password: `password123`)

| Email                | Permissions                |
|----------------------|----------------------------|
| `buyer@upclo.dev`    | Buyer                      |
| `seller@upclo.dev`   | Buyer + Seller (verified)  |
| `designer@upclo.dev` | Buyer + Designer (verified)|
| `pro@upclo.dev`      | Buyer + Seller + Designer (verified) |

## Page architecture

### Storefront (Jumia-inspired) — [`/`](src/app/page.tsx)
- Hero with featured grid
- Categories grid (Materials / Clothing / Accessories / Beauty)
- Flash sales rail (items with `salePrice` set)
- Trending fabrics rail
- Featured pieces (engagement + sales + promotion-boosted ranking)
- New arrivals + best sellers
- Top designers
- CTA — enable Seller/Designer permissions

### Feed (Facebook-inspired, designer-only content) — [`/feed`](src/app/feed/page.tsx)
- Left rail — navigation + category jumps
- Center timeline — posts with images, tags, like/comment/share/save actions, follow button, inline comments
- Right rail — top designers, recently posted

### Other public routes
- [`/products/[id]`](src/app/products/%5Bid%5D/page.tsx) — product detail with Add-to-Cart, sale price + discount badge, outfit pairings (AI)
- [`/posts/[id]`](src/app/posts/%5Bid%5D/page.tsx) — full designer post
- [`/search`](src/app/search/page.tsx) — natural-language smart search

### Buyer (any logged-in user)
- [`/account`](src/app/account/page.tsx) — identity, permission toggles, KPIs, recent orders
- [`/cart`](src/app/cart/page.tsx), [`/cart/checkout`](src/app/cart/checkout/page.tsx) — cart line items, quantity, checkout (payment stubbed)
- [`/wishlist`](src/app/wishlist/page.tsx) — saved products with Add-to-Cart
- [`/favorites`](src/app/favorites/page.tsx) — saved posts + products
- [`/messages`](src/app/messages/page.tsx) — conversations + chat

### Seller dashboard — [`/seller`](src/app/seller/page.tsx)
- Dashboard, products CRUD, active/completed orders, order detail, messages

### Designer dashboard — [`/designer`](src/app/designer/page.tsx)
- Dashboard, portfolio post CRUD, **Sketch Studio** (3D mockup placeholder + working canvas + history), own products CRUD

### Unauthorized — [`/unauthorized`](src/app/unauthorized/page.tsx)
- Friendly redirect for permission-gated routes

## AI features (powered by Claude Opus 4.7)

Default model `claude-opus-4-7`. Override with `CLAUDE_MODEL` env var (`claude-sonnet-4-6`, `claude-haiku-4-5`). Every AI endpoint marks its system prompt with `cache_control: {type: "ephemeral"}` so the static prompts cache between requests.

| Feature | Where | What it does |
|---|---|---|
| Fashion-only validator | Every product create/edit | Hard category check + semantic Claude check via `output_config.format` JSON Schema. Non-fashion listings rejected with 422 and a reason shown to the seller. ([validate-listing](src/app/api/ai/validate-listing/route.ts), [products POST](src/app/api/products/route.ts)) |
| AI Concierge | Floating ✨ button | Conversational shopping assistant with **tool use** — `search_products`, `get_categories`, `get_trending_designers` — returns text + product cards. ([concierge route](src/app/api/ai/concierge/route.ts), [widget](src/components/AIConcierge.tsx)) |
| Smart search | `/search` | Translates natural-language queries into structured filters via JSON Schema. ([smart-search route](src/app/api/ai/search/route.ts)) |
| Description writer | ProductForm | Generates editorial-style product copy from name + category + notes. ([generate-description](src/app/api/ai/generate-description/route.ts)) |
| Post drafter | PostForm | Turns rough notes into `{title, body, tags}` for designer posts. ([draft-post](src/app/api/ai/draft-post/route.ts)) |
| Outfit pairings | Public product page | "Style this with…" suggestions in three complementary categories. ([outfit](src/app/api/ai/outfit/route.ts)) |
| Personalized For You | Feed (logged-in) | Curates 6 picks from a candidate pool using the buyer's last 20 likes/saves. ([recommendations](src/app/api/ai/recommendations/route.ts)) |

The app degrades gracefully without an API key — the concierge button hides itself and AI endpoints return 503.

## Sketch Studio — [`/sketch`](src/app/sketch/page.tsx)

Designer-only (gated by `Permission.DESIGNER`). The 3D-mockup pipeline is **feature-flagged off** by default and shows a "Coming Soon" panel; the canvas + history work today. Turn it on with `FEATURE_SKETCH_3D=1` in `.env`. Sketches save a PNG data URL plus a garment hint (`shirt | gown | hoodie | trousers | skirt | agbada | dress | native | other`) that will seed the 3D pipeline when it lands.

When the 3D pipeline ships it'll use React Three Fiber to render a rotatable mannequin/avatar with the sketch as fabric/print texture mapped onto the chosen garment.

## Cart & checkout

- [`POST /api/cart`](src/app/api/cart/route.ts) — add an item (or increment quantity, respecting `Product.stock`)
- [`PATCH /api/cart/items/[id]`](src/app/api/cart/items/%5Bid%5D/route.ts) — set quantity
- [`DELETE /api/cart/items/[id]`](src/app/api/cart/items/%5Bid%5D/route.ts) — remove
- [`POST /api/cart/checkout`](src/app/api/cart/checkout/route.ts) — convert cart to Orders (payment stubbed; orders land in `PAID` for the demo)

Cart count in the nav updates live via a `upclo:cart-changed` window event.

## Schema highlights (Prisma)

- **`User`** — `isSeller`, `isDesigner`, `sellerVerified`, `designerVerified`, `exposureScore`, `cart` (1:1)
- **`Product`** — `salePrice`, `kind` (`MATERIAL | PRODUCT`), `stock`, `category` (from the fashion allowlist), `rating*`
- **`Cart`** + **`CartItem`** — per-user, lazy-provisioned
- **`Order`** — created via checkout, one per product/seller
- **`Post`** — designer content with `comments` and `likes`
- **`Comment`** — anyone can comment on a post
- **`Follow`** — buyers/sellers follow designers
- **`Review`** — product ratings (reserved for future iteration)
- **`Promotion`** — paid visibility boost (multiplier × ranking)
- **`Sketch`** — per-designer studio, `garment` hint for future 3D pipeline

## Sales-reward ranking

Every engagement bumps the owner's `exposureScore`:

| Event | Delta |
|-------|-------|
| view  | +0.01 |
| like  | +0.10 |
| save  | +0.20 |
| sale  | +1.00 |

Feed/storefront rank = `(engagement / age_decay) × ownerLift × promotionBoost` (see [src/lib/ranking.ts](src/lib/ranking.ts)).

## What's intentionally deferred

These were scoped out of this rebuild with a clear path forward:

- **WebSocket chat** — current 4 s polling works. The API is shaped for incremental fetches.
- **shadcn/ui + Zustand** — current Tailwind/server-component approach is small and fast; both are easy to layer in if needed.

## Scripts

| Script              | What                                            |
|---------------------|-------------------------------------------------|
| `npm run dev`       | Start Next.js dev server                        |
| `npm run build`     | Production build                                |
| `npm run start`     | Run production build                            |
| `npm run db:push`   | Apply schema to SQLite                          |
| `npm run db:seed`   | Seed demo data                                  |
| `npm run db:studio` | Open Prisma Studio                              |
| `npm run setup`     | Generate client, push schema, seed              |
