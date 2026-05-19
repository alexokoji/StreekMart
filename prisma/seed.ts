import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding StreekMart demo data…");

  const password = await bcrypt.hash("password123", 10);

  // Wipe everything in child-first order so the seed can be re-run
  // idempotently. We can't just `deleteMany` users — Turso/libSQL doesn't
  // cascade through every relation reliably (Message.senderId,
  // Promotion.ownerId, Follow, PayoutRequest, Sketch, Comment don't all
  // have onDelete: Cascade in the schema). Wiping in dependency order is
  // bulletproof and doesn't touch admin-configured SiteSetting /
  // DeliveryCity rows which live independently.
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.chatParticipant.deleteMany(),
    prisma.chat.deleteMany(),
    prisma.orderUpdate.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.like.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.sketch.deleteMany(),
    prisma.walletTransaction.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.payoutRequest.deleteMany(),
    prisma.verificationRequest.deleteMany(),
    prisma.manager.deleteMany(),
    prisma.product.deleteMany(),
    prisma.post.deleteMany(),
    prisma.searchLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Platform admin — gates /admin and /api/admin/*.
  await prisma.user.create({
    data: {
      email: "admin@streekmart.online",
      name: "StreekMart Admin",
      slug: "streekmart-admin",
      passwordHash: password,
      phone: "+234 800 000 0001",
      isAdmin: true,
      cart: { create: {} },
    },
  });

  // Four demo accounts exercising every permission combination. Each gets
  // a memorable slug so /u/<slug> shows nicely in shared links.
  //
  // `phone` is required for everyone since the registration flow change —
  // pre-seeding it keeps the ProfileCompletionBanner quiet for the demo
  // accounts. `businessName` only goes on sellers (designers and buyers
  // don't carry a brand identity); the matching `businessNameLower`
  // mirror is kept in lockstep so the @unique constraint works.
  const buyer = await prisma.user.create({
    data: {
      email: "buyer@streekmart.online",
      name: "Alex Buyer",
      slug: "alex-buyer",
      passwordHash: password,
      phone: "+234 803 000 0002",
      cart: { create: {} },
    },
  });

  const seller = await prisma.user.create({
    data: {
      email: "seller@streekmart.online",
      name: "Seoul Threads",
      slug: "seoul-threads",
      passwordHash: password,
      phone: "+234 803 000 0003",
      businessName: "Seoul Threads",
      businessNameLower: "seoul threads",
      isSeller: true,
      sellerVerified: true,
      bio: "Small-batch streetwear from Seoul.",
      exposureScore: 5,
      cart: { create: {} },
    },
  });

  const designer = await prisma.user.create({
    data: {
      email: "designer@streekmart.online",
      name: "Mira Okafor",
      slug: "mira-okafor",
      passwordHash: password,
      phone: "+234 803 000 0004",
      isDesigner: true,
      designerVerified: true,
      bio: "Independent designer · color & silhouette",
      exposureScore: 8,
      cart: { create: {} },
    },
  });

  // "Pro" account = Buyer + Seller + Designer all at once.
  const pro = await prisma.user.create({
    data: {
      email: "pro@streekmart.online",
      name: "Kemi Adelaja",
      slug: "kemi-adelaja",
      passwordHash: password,
      phone: "+234 803 000 0005",
      businessName: "Kemi Adelaja Atelier",
      businessNameLower: "kemi adelaja atelier",
      isSeller: true,
      isDesigner: true,
      sellerVerified: true,
      designerVerified: true,
      bio: "Atelier · fabrics + ready-to-wear",
      exposureScore: 12,
      cart: { create: {} },
    },
  });

  // ----- Products (materials + clothing + accessories) -----
  const products = await Promise.all([
    // Materials
    prisma.product.create({
      data: {
        sellerId: pro.id,
        name: "Royal Ankara · 6 yards",
        description: "Vibrant high-density wax print, 6-yard cut. Vivid pigment, dense weave — holds a structured silhouette beautifully.",
        price: 65,
        salePrice: 49,
        category: "Ankara",
        kind: "MATERIAL",
        status: "ACTIVE",
        stock: 24,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1623778047948-bdc40fc52a87?w=800",
        ]),
        likeCount: 28,
        viewCount: 150,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: pro.id,
        name: "French Lace · ivory",
        description: "Soft scalloped edge, fine cotton-blend lace. Drapes weightlessly — ideal for veils, overlays, and bridal trims.",
        price: 88,
        category: "Lace",
        kind: "MATERIAL",
        stock: 12,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1606902965551-dce093cda6e7?w=800",
        ]),
        likeCount: 14,
        viewCount: 80,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: seller.id,
        name: "Heavy Linen · sand",
        description: "Substantial 280gsm linen with a softened hand. Pre-washed for a relaxed drape and minimal shrinkage.",
        price: 42,
        category: "Linen",
        kind: "MATERIAL",
        stock: 40,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800",
        ]),
        likeCount: 36,
        viewCount: 210,
        salesCount: 6,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: seller.id,
        name: "Selvedge Denim · 14oz",
        description: "Heavy 14oz Japanese-style selvedge denim. Develops sharp honeycomb fades with wear.",
        price: 72,
        category: "Denim",
        kind: "MATERIAL",
        stock: 18,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800",
        ]),
        likeCount: 22,
        viewCount: 140,
      },
    }),
    // Clothing
    prisma.product.create({
      data: {
        sellerId: seller.id,
        name: "Oversized Boxy Tee — Cream",
        description: "Heavyweight 240gsm cotton, drop-shoulder cut. Wears generous; size down for a clean look.",
        price: 48,
        salePrice: 36,
        category: "Tops",
        kind: "PRODUCT",
        stock: 30,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
        ]),
        likeCount: 12,
        viewCount: 80,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: seller.id,
        name: "Pleated Wide-Leg Trousers",
        description: "Wool-blend with crisp pleats, high rise, side adjusters. Tailors easily.",
        price: 120,
        category: "Bottoms",
        kind: "PRODUCT",
        stock: 14,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800",
        ]),
        likeCount: 30,
        viewCount: 220,
        salesCount: 4,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: pro.id,
        name: "Silk Charmeuse Slip Dress",
        description: "Bias-cut silk slip with adjustable straps. River-cool against the skin.",
        price: 220,
        salePrice: 175,
        category: "Dresses",
        kind: "PRODUCT",
        stock: 7,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800",
        ]),
        likeCount: 41,
        viewCount: 305,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: pro.id,
        name: "Agbada · Embroidered Set",
        description: "Three-piece agbada in soft cotton damask with hand-finished neckline embroidery.",
        price: 380,
        category: "Native Wear",
        kind: "PRODUCT",
        stock: 5,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1612831455540-3cf2ed4c5f06?w=800",
        ]),
        likeCount: 18,
        viewCount: 96,
      },
    }),
    // Accessories
    prisma.product.create({
      data: {
        sellerId: seller.id,
        name: "Reversible Bucket Hat",
        description: "Two looks, one hat. Cotton twill, washable, holds shape after rain.",
        price: 32,
        category: "Hats",
        kind: "PRODUCT",
        stock: 22,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=800",
        ]),
        likeCount: 9,
        viewCount: 60,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: pro.id,
        name: "Hand-Stitched Leather Tote",
        description: "Full-grain vegetable-tanned leather. Hand-stitched seams, brass hardware, ages into a deep patina.",
        price: 295,
        category: "Bags",
        kind: "PRODUCT",
        stock: 6,
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800",
        ]),
        likeCount: 33,
        viewCount: 178,
      },
    }),
  ]);

  // ----- Designer posts -----
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        authorId: designer.id,
        title: "Color story: muted clay & ash",
        body: "This season I'm leaning into earthy mid-tones — clay, ash, and warm cream. The palette pairs well with raw denim and soft wools, and reads quiet without feeling sleepy.",
        tagsJson: JSON.stringify(["palette", "ss26", "moodboard"]),
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200",
        ]),
        likeCount: 45,
        viewCount: 410,
        saveCount: 22,
      },
    }),
    prisma.post.create({
      data: {
        authorId: designer.id,
        title: "Pattern study: trench drape",
        body: "A walkthrough of how I drape a relaxed trench from a single panel — fewer seams, cleaner silhouette.",
        tagsJson: JSON.stringify(["pattern", "outerwear"]),
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1551803091-e20673f15770?w=1200",
        ]),
      },
    }),
    prisma.post.create({
      data: {
        authorId: pro.id,
        title: "From loom to look",
        body: "A small fabric run for a wedding capsule — six yards of hand-loomed silk on the way to a single dress.",
        tagsJson: JSON.stringify(["fabric", "silk", "process"]),
        imagesJson: JSON.stringify([
          "https://images.unsplash.com/photo-1605518215584-c19f1c2c00ad?w=1200",
        ]),
        likeCount: 26,
        viewCount: 188,
      },
    }),
  ]);

  // ----- Orders / cart / favorites / chat -----
  await prisma.order.create({
    data: {
      productId: products[5].id,
      buyerId: buyer.id,
      sellerId: seller.id,
      quantity: 1,
      totalPrice: 120,
      status: "COMPLETED",
      shippingAddress: "1 Demo Lane, Lagos",
    },
  });
  await prisma.order.create({
    data: {
      productId: products[4].id,
      buyerId: buyer.id,
      sellerId: seller.id,
      quantity: 2,
      totalPrice: 72,
      status: "PAID",
    },
  });

  await prisma.favorite.create({
    data: { userId: buyer.id, postId: posts[0].id },
  });
  await prisma.favorite.create({
    data: { userId: buyer.id, productId: products[6].id },
  });

  // Buyer already has the bucket hat in their cart.
  const buyerCart = await prisma.cart.findUnique({ where: { userId: buyer.id } });
  if (buyerCart) {
    await prisma.cartItem.create({
      data: { cartId: buyerCart.id, productId: products[8].id, quantity: 1 },
    });
  }

  // Buyer follows the designer.
  await prisma.follow.create({
    data: { followerId: buyer.id, designerId: designer.id },
  });

  // Demo chat thread.
  const chat = await prisma.chat.create({
    data: {
      participants: { create: [{ userId: buyer.id }, { userId: seller.id }] },
    },
  });
  await prisma.message.create({
    data: { chatId: chat.id, senderId: buyer.id, body: "Hi! Are the trousers true to size?" },
  });
  await prisma.message.create({
    data: { chatId: chat.id, senderId: seller.id, body: "They run a hair big — I'd take your usual size." },
  });

  // Active promotion on a hero product.
  await prisma.promotion.create({
    data: {
      ownerId: pro.id,
      productId: products[6].id,
      boost: 2.0,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Done. Demo accounts (password = password123):");
  console.log("  admin@streekmart.online      — Platform admin (controls /admin)");
  console.log("  buyer@streekmart.online      — Buyer only");
  console.log("  seller@streekmart.online     — Buyer + Seller");
  console.log("  designer@streekmart.online   — Buyer + Designer");
  console.log("  pro@streekmart.online        — Buyer + Seller + Designer");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
