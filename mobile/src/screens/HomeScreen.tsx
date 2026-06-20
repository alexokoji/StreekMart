import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../state/ThemeContext";
import { LogoBar } from "../components/LogoBar";
import { Input } from "../components/Input";
import { Chip } from "../components/Chip";
import { CalloutCard } from "../components/CalloutCard";
import { Countdown, endOfTodayMs } from "../components/Countdown";
import { ProductCardSkeleton } from "../components/Skeleton";
import { OfflineBanner } from "../components/OfflineBanner";
import { api } from "../api/client";
import { getCached } from "../api/cache";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Item = {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image: string | null;
  sellerName?: string;
};

type CategoryItem = { name: string; productCount?: number; displayOrder?: number };

type DesignerItem = {
  id: string;
  name: string;
  businessName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followerCount: number;
  productCount: number;
  tagline: string | null;
};

type HomeData = {
  featured: Item[];
  flashSales: Item[];
  newArrivals: Item[];
  trending: Item[];
  recentlyViewed: Item[];
  buyAgain: Item[];
  following: Item[];
  forYou: Item[];
  categories: CategoryItem[];
  designers: DesignerItem[];
};

// Bottom padding so the centre Search FAB never overlaps the last
// content card. ~ 6px breathing room above the tab bar + FAB radius.
const FAB_CLEARANCE = 110;

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [featured, flashSales, newArrivals, trending, categories, recentlyViewed, buyAgainResp, followingResp, recsResp, designersResp] =
        await Promise.all([
          getCached("home:featured", () => api.get<{ items: Item[] }>("/api/products/list", { rail: "featured", limit: 8 })).catch(() => ({ items: [] })),
          getCached("home:flash-sales", () => api.get<{ items: Item[] }>("/api/products/list", { rail: "flash-sales", limit: 8 })).catch(() => ({ items: [] })),
          getCached("home:new-arrivals", () => api.get<{ items: Item[] }>("/api/products/list", { rail: "new-arrivals", limit: 10 })).catch(() => ({ items: [] })),
          getCached("home:best-sellers", () => api.get<{ items: Item[] }>("/api/products/list", { rail: "best-sellers", limit: 10 })).catch(() => ({ items: [] })),
          api.get<{ categories: CategoryItem[] }>("/api/categories", { counts: 1 }).catch(() => ({ categories: [] })),
          api.get<{ items: Item[] }>("/api/recently-viewed").catch(() => ({ items: [] })),
          api.get<{ items: Item[] }>("/api/me/buy-again").catch(() => ({ items: [] })),
          api.get<{ items: Item[] }>("/api/me/following-feed").catch(() => ({ items: [] })),
          api.get<{ items: Array<{ kind: string; id: string; data: { name: string; price: number; image: string | null; seller: string } }> }>("/api/ai/recommendations").catch(() => ({ items: [] })),
          getCached("home:designers", () => api.get<{ designers: DesignerItem[] }>("/api/designers", { rail: "featured", limit: 12 })).catch(() => ({ designers: [] })),
        ]);

      const forYou: Item[] = (recsResp.items ?? [])
        .filter((i) => i.kind === "product" && i.data)
        .map((i) => ({
          id: i.id,
          name: i.data.name,
          price: i.data.price,
          salePrice: null,
          image: i.data.image,
          sellerName: i.data.seller,
        }));

      setData({
        featured: featured.items ?? [],
        flashSales: flashSales.items ?? [],
        newArrivals: newArrivals.items ?? [],
        trending: trending.items ?? [],
        recentlyViewed: recentlyViewed.items ?? [],
        buyAgain: buyAgainResp.items ?? [],
        following: followingResp.items ?? [],
        forYou,
        // Most-popular-first: sort by ACTIVE product count when the
        // server returned it (counts=1), fall back to admin
        // displayOrder. Trim to a sensible rail length afterwards.
        categories: (categories.categories ?? [])
          .slice()
          .sort((a, b) => {
            const ca = a.productCount ?? -1;
            const cb = b.productCount ?? -1;
            if (ca !== cb) return cb - ca;
            return (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999);
          })
          .slice(0, 8),
        designers: designersResp.designers ?? [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <LogoBar />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: FAB_CLEARANCE }}>
          <View style={{ height: 50, backgroundColor: t.border, borderRadius: radius.md, opacity: 0.55 }} />
          <View style={{ height: 100, backgroundColor: t.border, borderRadius: radius.md, opacity: 0.55, marginTop: 8 }} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}><ProductCardSkeleton /></View>
            <View style={{ flex: 1 }}><ProductCardSkeleton /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><ProductCardSkeleton /></View>
            <View style={{ flex: 1 }}><ProductCardSkeleton /></View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const d = data!;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LogoBar onMenu={() => nav.navigate("Menu" as never)} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE }}
        refreshControl={
          <RefreshControl
            tintColor={t.cta}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <OfflineBanner />

        {/* Search row -- Pressable wraps the input so the whole pill
            navigates to the dedicated Search screen rather than typing
            inline here. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Pressable onPress={() => goToTab(nav, "Search")}>
            <View pointerEvents="none">
              <Input
                leftIcon={<Ionicons name="search" size={18} color={t.textMuted} />}
                placeholder="Search any product..."
                editable={false}
              />
            </View>
          </Pressable>
        </View>

        {/* Featured header */}
        <View style={styles.sectionHead}>
          <Text style={[type.h2, { color: t.text }]}>All featured</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label="Sort"
              variant="filled"
              leftIcon={<Ionicons name="swap-vertical" size={14} color={t.text} />}
              onPress={() => nav.navigate("Trending", { rail: "featured", title: "All featured" })}
            />
            <Chip
              label="Filter"
              variant="filled"
              leftIcon={<Ionicons name="options-outline" size={14} color={t.text} />}
              onPress={() => nav.navigate("Trending", { rail: "featured", title: "All featured" })}
            />
          </View>
        </View>

        {/* Category circles */}
        {d.categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 12 }}
          >
            {d.categories.map((c, i) => (
              <CategoryCircle
                key={c.name}
                name={c.name}
                tint={["violet", "fuchsia", "gold", "info"][i % 4] as TintName}
                onPress={() => nav.navigate("Categories")}
              />
            ))}
          </ScrollView>
        ) : null}

        {/* Hero promo banner (placeholder copy + brand gradient) */}
        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <PromoBanner
            title="50% OFF"
            subtitle="Top picks across new arrivals"
            ctaLabel="Shop now"
            onPress={() => nav.navigate("Trending", { rail: "new-arrivals", title: "New arrivals" })}
          />
        </View>

        {/* Deal of the Day with live countdown */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <CalloutCard
            tone="info"
            title="Deal of the Day"
            caption={`Ends in ${formatCountdownLabel()}`}
            onPress={() => nav.navigate("Trending", { rail: "flash-sales", title: "Deal of the Day" })}
          />
          {/* Live ticker beneath the static label so the seconds animate */}
          <View style={{ marginTop: 8, alignSelf: "flex-end" }}>
            <Countdown targetMs={endOfTodayMs()} label="ends in" />
          </View>
        </View>

        {/* Featured 2x grid */}
        {d.featured.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <FlatList
              data={d.featured.slice(0, 4)}
              keyExtractor={(p) => p.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <View style={{ flex: 1 }}>
                  <GridCard item={item} onPress={() => nav.navigate("ProductDetail", { id: item.id })} />
                </View>
              )}
            />
          </View>
        ) : null}

        {/* Special Offers row */}
        <SpecialOffer />

        {/* Trending Products callout + horizontal rail */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <CalloutCard
            tone="promo"
            title="Trending products"
            caption="Restocked weekly"
            onPress={() => nav.navigate("Trending", { rail: "best-sellers", title: "Trending products" })}
          />
        </View>
        <HorizontalRail items={d.trending.length > 0 ? d.trending : d.flashSales} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />

        {/* Designers rail */}
        {d.designers.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>Designers to follow</Text>
              <Pressable onPress={() => goToTab(nav, "Feed")} hitSlop={6}>
                <Text style={[type.small, { color: t.cta, fontWeight: "700" }]}>Open feed ›</Text>
              </Pressable>
            </View>
            <DesignersRail
              items={d.designers}
              onPress={(designer) =>
                nav.navigate("SellerProfile", {
                  id: designer.id,
                  name: designer.name,
                  businessName: designer.businessName,
                  avatarUrl: designer.avatarUrl,
                })
              }
            />
          </>
        ) : null}

        {/* New arrivals header + horizontal rail */}
        {d.newArrivals.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>New arrivals</Text>
              <Pressable
                onPress={() => nav.navigate("Trending", { rail: "new-arrivals", title: "New arrivals" })}
                hitSlop={6}
              >
                <Text style={[type.small, { color: t.cta, fontWeight: "700" }]}>View all ›</Text>
              </Pressable>
            </View>
            <HorizontalRail items={d.newArrivals} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />
          </>
        ) : null}

        {/* Personalised rails -- signed-in only. */}
        {d.recentlyViewed.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>Recently viewed</Text>
            </View>
            <HorizontalRail items={d.recentlyViewed} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />
          </>
        ) : null}
        {d.buyAgain.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>Buy it again</Text>
            </View>
            <HorizontalRail items={d.buyAgain} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />
          </>
        ) : null}
        {d.following.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>From stores you follow</Text>
            </View>
            <HorizontalRail items={d.following} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />
          </>
        ) : null}
        {d.forYou.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={[type.h2, { color: t.text }]}>For you</Text>
            </View>
            <HorizontalRail items={d.forYou} onItemPress={(id) => nav.navigate("ProductDetail", { id })} />
          </>
        ) : null}

        {/* Sponsored card */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <Sponsored onPress={() => nav.navigate("Trending", { rail: "featured", title: "Featured" })} />
        </View>
      </ScrollView>
    </View>
  );
}

type TintName = "violet" | "fuchsia" | "gold" | "info";

// Maps a category display name to a vector-icon glyph. Fuzzy match by
// keyword so admin can name a category whatever and we pick a sensible
// icon; falls back to "pricetag" if nothing matches.
type IconRef =
  | { lib: "ionicons"; name: React.ComponentProps<typeof Ionicons>["name"] }
  | { lib: "material"; name: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

function categoryIcon(name: string): IconRef {
  const k = name.toLowerCase();
  // Order matters: most specific matches first so e.g. "men's shoes"
  // resolves to the shoe icon, not the generic mens-clothing icon.
  if (/shoe|foot|sneaker|boot|heel|sandal|loafer/.test(k)) return { lib: "material", name: "shoe-heel" };
  if (/jewel|ring|necklace|earring|bracelet|pendant|bangle/.test(k)) return { lib: "ionicons", name: "diamond-outline" };
  if (/watch|wristband|timepiece/.test(k)) return { lib: "ionicons", name: "watch-outline" };
  if (/bag|handbag|purse|backpack|tote|clutch|satchel|wallet/.test(k)) return { lib: "material", name: "bag-personal-outline" };
  if (/hat|cap|beanie|fedora|headwear/.test(k)) return { lib: "material", name: "hat-fedora" };
  if (/scarf|shawl|gele|head\s*wrap/.test(k)) return { lib: "material", name: "tshirt-v-outline" };
  if (/glass|sunglass|eyewear|optical/.test(k)) return { lib: "material", name: "sunglasses" };
  if (/perfume|cologne|fragrance|scent/.test(k)) return { lib: "material", name: "spray-bottle" };
  if (/lipstick|makeup|cosmetic|lip|nail/.test(k)) return { lib: "material", name: "lipstick" };
  if (/beauty|skin|skincare|lotion|moisturiser|moisturizer/.test(k)) return { lib: "material", name: "lotion-plus" };
  if (/hair|wig|extension|braid|weave/.test(k)) return { lib: "material", name: "hair-dryer" };
  if (/under(wear)?|lingerie|bra|brief|boxer|sleep\s*wear|pj|pyjam/.test(k)) return { lib: "material", name: "tshirt-v" };
  if (/swim|bikini|trunks?/.test(k)) return { lib: "ionicons", name: "water-outline" };
  if (/jacket|coat|outer\s*wear|hoodie|sweater|cardigan|sweatshirt/.test(k)) return { lib: "material", name: "hanger" };
  if (/jean|trouser|pant|short|skirt|legging/.test(k)) return { lib: "material", name: "tshirt-crew-outline" };
  if (/shirt|tee|t-?shirt|polo|top|blouse/.test(k)) return { lib: "material", name: "tshirt-crew" };
  if (/dress|gown|kaftan|abaya/.test(k)) return { lib: "material", name: "human-female" };
  if (/suit|tux|tuxedo|blazer/.test(k)) return { lib: "material", name: "human-male" };
  if (/agbada|kaftan|babariga|senator|dashiki/.test(k)) return { lib: "material", name: "human-male-board" };
  if (/ankara|aso|adire|cultur|herit|tradi|africa/.test(k)) return { lib: "material", name: "flower" };
  if (/fabric|textile|material|cloth\b/.test(k)) return { lib: "material", name: "palette-swatch" };
  if (/men\b|man\b|gentleman|guy/.test(k)) return { lib: "material", name: "human-male" };
  if (/women\b|woman|lady|ladies|girl/.test(k)) return { lib: "material", name: "human-female" };
  if (/uni\s*sex|gender\s*neutral/.test(k)) return { lib: "material", name: "human-male-female" };
  if (/kid|child|baby|infant|toy/.test(k)) return { lib: "material", name: "teddy-bear" };
  if (/sport|fit|gym|active|athleisure|workout/.test(k)) return { lib: "ionicons", name: "barbell-outline" };
  if (/bridal|wedding|bride|groom/.test(k)) return { lib: "material", name: "ring" };
  if (/access(ory|ories)/.test(k)) return { lib: "material", name: "bag-personal" };
  if (/cloth|apparel|wear|fashion|outfit/.test(k)) return { lib: "material", name: "tshirt-crew" };
  if (/home|furniture|decor|bedding|cushion/.test(k)) return { lib: "ionicons", name: "home-outline" };
  if (/electro|gadget|phone|tech|computer|laptop/.test(k)) return { lib: "ionicons", name: "phone-portrait-outline" };
  if (/food|grocer|kitchen/.test(k)) return { lib: "ionicons", name: "restaurant-outline" };
  if (/book|stationery|paper/.test(k)) return { lib: "ionicons", name: "book-outline" };
  return { lib: "material", name: "tag-outline" };
}

// Round category tile. Tinted disc with a category-specific icon.
function CategoryCircle({
  name,
  tint,
  onPress,
}: {
  name: string;
  tint: TintName;
  onPress: () => void;
}) {
  const t = useTheme();
  const bg =
    tint === "violet"
      ? t.accentSoft
      : tint === "fuchsia"
        ? "rgba(217,70,239,0.18)"
        : tint === "gold"
          ? "rgba(207,159,50,0.20)"
          : "rgba(124,58,237,0.18)";
  const fg = tint === "violet" ? t.accent : tint === "fuchsia" ? t.promo : tint === "gold" ? t.premium : t.cta;
  const icon = categoryIcon(name);
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", width: 72 }}>
      <View style={[styles.catDisc, { backgroundColor: bg }]}>
        {icon.lib === "ionicons" ? (
          <Ionicons name={icon.name} size={28} color={fg} />
        ) : (
          <MaterialCommunityIcons name={icon.name} size={28} color={fg} />
        )}
      </View>
      <Text style={[type.small, { color: t.text, marginTop: 6 }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

// Pink hero banner with text on the left, decorative bag on the right.
function PromoBanner({
  title,
  subtitle,
  ctaLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.heroBanner, { backgroundColor: t.promo }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ctaText, fontSize: 28, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: t.ctaText, opacity: 0.9, marginTop: 4 }}>{subtitle}</Text>
        <View style={[styles.heroCta, { borderColor: "rgba(255,255,255,0.55)" }]}>
          <Text style={{ color: t.ctaText, fontWeight: "700" }}>{ctaLabel} ›</Text>
        </View>
      </View>
      <View style={[styles.heroIcon, { backgroundColor: "rgba(255,255,255,0.16)" }]}>
        <Ionicons name="bag-handle" size={38} color={t.ctaText} />
      </View>
    </Pressable>
  );
}

// Special Offers strip -- a wide card with a gold side accent and a
// short pitch line.
function SpecialOffer() {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
      <View style={[styles.specialCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.specialBadge, { backgroundColor: t.premium }]}>
          <Ionicons name="star" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: t.text }]}>Special offers</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
            Hand-picked deals from verified sellers, refreshed every morning.
          </Text>
        </View>
      </View>
    </View>
  );
}

// Sponsored placement at the bottom of the home feed. Until we have an
// actual paid-promotion image to load we render a brand gradient card.
function Sponsored({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.sponsored, { backgroundColor: t.accent }]}>
      <Text style={{ color: t.ctaText, fontSize: 30, fontWeight: "800" }}>Up to 50% off</Text>
      <Text style={{ color: t.ctaText, opacity: 0.85, marginTop: 6 }}>Sponsored</Text>
    </Pressable>
  );
}

// Card shape used by both the inline featured grid and the Trending
// screen. Kept inline rather than imported from ProductCard so this
// home view can iterate on the layout without rippling into other
// surfaces.
function GridCard({ item, onPress }: { item: Item; onPress: () => void }) {
  const t = useTheme();
  const eff = item.salePrice ?? item.price;
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.cardImageWrap, { backgroundColor: t.bg }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" />
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={[type.body, { color: t.text }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[type.bodyStrong, { color: t.cta }]}>
          ₦{Math.round(eff).toLocaleString("en-NG")}
        </Text>
      </View>
    </Pressable>
  );
}

// Horizontal scroll of small product tiles -- used for Trending, New
// arrivals, and the personalised rails.
function HorizontalRail({
  items,
  onItemPress,
}: {
  items: Item[];
  onItemPress: (id: string) => void;
}) {
  const t = useTheme();
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 8 }}
    >
      {items.map((p) => {
        const eff = p.salePrice ?? p.price;
        return (
          <Pressable
            key={p.id}
            onPress={() => onItemPress(p.id)}
            style={[styles.miniCard, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <View style={[styles.miniImageWrap, { backgroundColor: t.bg }]}>
              {p.image ? <Image source={{ uri: p.image }} style={styles.miniImage} contentFit="cover" /> : null}
            </View>
            <View style={{ padding: 8 }}>
              <Text style={[type.small, { color: t.text }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[type.bodyStrong, { color: t.cta, marginTop: 2 }]}>
                ₦{Math.round(eff).toLocaleString("en-NG")}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Horizontal scroll of designer profile cards — banner image + avatar
// + name + follower count. Tapping a card opens the seller's public
// profile so buyers can browse their pieces.
function DesignersRail({
  items,
  onPress,
}: {
  items: DesignerItem[];
  onPress: (d: DesignerItem) => void;
}) {
  const t = useTheme();
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 8 }}
    >
      {items.map((d) => {
        const display = d.businessName ?? d.name;
        const initial = display.slice(0, 1).toUpperCase();
        return (
          <Pressable
            key={d.id}
            onPress={() => onPress(d)}
            style={[styles.designerCard, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <View style={[styles.designerBanner, { backgroundColor: t.accentSoft }]}>
              {d.bannerUrl ? (
                <Image source={{ uri: d.bannerUrl }} style={styles.designerBannerImg} contentFit="cover" />
              ) : null}
            </View>
            <View style={styles.designerAvatarWrap}>
              {d.avatarUrl ? (
                <Image source={{ uri: d.avatarUrl }} style={styles.designerAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.designerAvatar, { backgroundColor: t.cta, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 18 }}>{initial}</Text>
                </View>
              )}
            </View>
            <View style={{ paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{display}</Text>
              {d.tagline ? (
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]} numberOfLines={1}>
                  {d.tagline}
                </Text>
              ) : (
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  {d.followerCount.toLocaleString("en-NG")} followers
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function formatCountdownLabel(): string {
  const ms = endOfTodayMs() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  const m = Math.max(0, Math.floor((ms % 3_600_000) / 60_000));
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  catDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  heroCta: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 12,
  },
  heroIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  specialCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  specialBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsored: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardImageWrap: { aspectRatio: 1 },
  cardImage: { width: "100%", height: "100%" },
  miniCard: {
    width: 150,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  miniImageWrap: { aspectRatio: 1 },
  miniImage: { width: "100%", height: "100%" },
  designerCard: {
    width: 170,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  designerBanner: { height: 64 },
  designerBannerImg: { width: "100%", height: "100%" },
  designerAvatarWrap: {
    paddingHorizontal: 10,
    marginTop: -22,
  },
  designerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
});
