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
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../state/AuthContext";
import { Countdown, endOfTodayMs } from "../components/Countdown";
import { ProductCard } from "../components/ProductCard";
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
const FAB_CLEARANCE = 24;

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
        <HomeHeader />
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
  const hero = d.featured[0] ?? d.newArrivals[0] ?? null;
  const deals = d.flashSales.slice(0, 3);
  const open = (id: string) => nav.navigate("ProductDetail", { id });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <HomeHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
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

        {/* Search pill: tapping opens the Search tab. */}
        <Pressable
          onPress={() => goToTab(nav, "Search")}
          accessibilityRole="search"
          accessibilityLabel="Search fabrics, designers and styles"
          style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <Ionicons name="search" size={20} color={t.textMuted} />
          <Text style={[type.bodyLg, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
            Search fabrics, designers, styles
          </Text>
          <View style={[styles.searchCam, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="camera-outline" size={19} color={t.accent} />
          </View>
        </Pressable>

        {/* Hero: a real featured product with an ink panel for the copy. */}
        {hero ? (
          <Pressable
            onPress={() => nav.navigate("Trending", { rail: "new-arrivals", title: "New arrivals" })}
            style={[styles.hero, { backgroundColor: t.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Shop new arrivals"
          >
            {hero.image ? <Image source={{ uri: hero.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={[styles.heroPanel, { backgroundColor: t.ink }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[type.micro, { color: t.gold }]}>JUST LANDED</Text>
                <Text style={[type.h1, { color: t.inkText }]}>Fresh fabrics and styles, hand-picked for you</Text>
              </View>
              <View style={[styles.heroGo, { backgroundColor: t.gold }]}>
                <Ionicons name="arrow-forward" size={20} color="#17121F" />
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* Categories */}
        {d.categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {d.categories.map((c, i) => (
              <CategoryCircle key={c.name} name={c.name} index={i} onPress={() => nav.navigate("Categories")} />
            ))}
          </ScrollView>
        ) : null}

        {/* Trending grid */}
        {d.featured.length > 0 ? (
          <>
            <SectionHead
              title="Trending now"
              action="See all"
              onAction={() => nav.navigate("Trending", { rail: "featured", title: "All featured" })}
            />
            <View style={styles.grid}>
              {d.featured.slice(0, 4).map((item) => (
                <View key={item.id} style={styles.gridCell}>
                  <ProductCard
                    product={{ ...item, sellerName: undefined }}
                    onPress={() => open(item.id)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Deal of the day: only when there are real flash sales. */}
        {deals.length > 0 ? (
          <Pressable
            onPress={() => nav.navigate("Trending", { rail: "flash-sales", title: "Deal of the Day" })}
            style={[styles.deal, { backgroundColor: t.ink }]}
          >
            <View style={styles.dealTop}>
              <View>
                <Text style={[type.micro, { color: t.gold }]}>DEAL OF THE DAY</Text>
                <Text style={[type.h1, { color: t.inkText, marginTop: 2 }]}>Today only</Text>
              </View>
              <Countdown targetMs={endOfTodayMs()} color={t.gold} />
            </View>
            <View style={styles.dealRow}>
              {deals.map((p) => (
                <View key={p.id} style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.dealImg, { backgroundColor: t.bgElevated }]}>
                    {p.image ? <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                  </View>
                  <Text style={[type.price, { color: t.inkText, fontSize: 14 }]}>
                    ₦{Math.round(p.salePrice ?? p.price).toLocaleString("en-NG")}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        ) : null}

        {/* Best sellers */}
        {(d.trending.length > 0 || d.flashSales.length > 0) ? (
          <>
            <SectionHead
              title="Best sellers"
              action="See all"
              onAction={() => nav.navigate("Trending", { rail: "best-sellers", title: "Trending products" })}
            />
            <HorizontalRail items={d.trending.length > 0 ? d.trending : d.flashSales} onItemPress={open} />
          </>
        ) : null}

        {/* Designers */}
        {d.designers.length > 0 ? (
          <>
            <SectionHead title="Designers to follow" action="Open feed" onAction={() => goToTab(nav, "Feed")} />
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

        {d.newArrivals.length > 0 ? (
          <>
            <SectionHead
              title="New arrivals"
              action="See all"
              onAction={() => nav.navigate("Trending", { rail: "new-arrivals", title: "New arrivals" })}
            />
            <HorizontalRail items={d.newArrivals} onItemPress={open} />
          </>
        ) : null}

        {d.recentlyViewed.length > 0 ? (
          <>
            <SectionHead title="Recently viewed" />
            <HorizontalRail items={d.recentlyViewed} onItemPress={open} />
          </>
        ) : null}
        {d.buyAgain.length > 0 ? (
          <>
            <SectionHead title="Buy it again" />
            <HorizontalRail items={d.buyAgain} onItemPress={open} />
          </>
        ) : null}
        {d.following.length > 0 ? (
          <>
            <SectionHead title="From stores you follow" />
            <HorizontalRail items={d.following} onItemPress={open} />
          </>
        ) : null}
        {d.forYou.length > 0 ? (
          <>
            <SectionHead title="For you" />
            <HorizontalRail items={d.forYou} onItemPress={open} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Greeting row: who you are, a bell for notifications, avatar to Account.
function HomeHeader() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const first = user?.name?.split(" ")[0];
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: t.bg }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.small, { color: t.textMuted }]}>{first ? "Welcome back" : "Welcome to StreekMart"}</Text>
          <Text style={[type.h1, { color: t.text }]} numberOfLines={1}>
            {first ? `Hi, ${first}` : "What are you wearing?"}
          </Text>
        </View>
        <Pressable
          onPress={() => (user ? nav.navigate("Notifications") : nav.navigate("Login"))}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={[styles.roundBtn, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <Ionicons name="notifications-outline" size={21} color={t.text} />
        </Pressable>
        <Pressable
          onPress={() => nav.navigate("Menu")}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={[styles.roundBtn, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <Ionicons name="menu" size={22} color={t.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[type.h1, { color: t.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={[type.bodyStrong, { color: t.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

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

// Round category tile: a soft disc with the category icon.
const CAT_BG = ["#EEE8FB", "#FFF1CC", "#E3F5EA", "#FBE7E5", "#E4EAFB"];
function CategoryCircle({ name, index, onPress }: { name: string; index: number; onPress: () => void }) {
  const t = useTheme();
  const dark = t.scheme === "dark";
  const bg = dark ? t.card : CAT_BG[index % CAT_BG.length];
  const fg = dark ? t.accent : "#4C1D95";
  const icon = categoryIcon(name);
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", width: 74 }} accessibilityRole="button" accessibilityLabel={name}>
      <View style={[styles.catDisc, { backgroundColor: bg }]}>
        {icon.lib === "ionicons" ? (
          <Ionicons name={icon.name} size={28} color={fg} />
        ) : (
          <MaterialCommunityIcons name={icon.name} size={28} color={fg} />
        )}
      </View>
      <Text style={[type.small, { color: t.text, marginTop: 8 }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

// Horizontal scroll of product tiles for the secondary rails.
function HorizontalRail({ items, onItemPress }: { items: Item[]; onItemPress: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}
    >
      {items.map((p) => (
        <View key={p.id} style={{ width: 150 }}>
          <ProductCard product={{ ...p, sellerName: undefined }} onPress={() => onItemPress(p.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

// Designers: round avatars with a violet ring and a gold verified dot.
function DesignersRail({ items, onPress }: { items: DesignerItem[]; onPress: (d: DesignerItem) => void }) {
  const t = useTheme();
  if (items.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 18, paddingVertical: 6 }}
    >
      {items.map((d) => {
        const display = d.businessName ?? d.name;
        return (
          <Pressable
            key={d.id}
            onPress={() => onPress(d)}
            accessibilityRole="button"
            accessibilityLabel={`${display}, ${d.followerCount} followers`}
            style={{ width: 80, alignItems: "center", gap: 8 }}
          >
            <View style={[styles.avRing, { borderColor: t.cta, backgroundColor: t.bg }]}>
              {d.avatarUrl ? (
                <Image source={{ uri: d.avatarUrl }} style={styles.avImg} contentFit="cover" />
              ) : (
                <View style={[styles.avImg, { backgroundColor: t.cta, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: t.ctaText, fontSize: 26, fontFamily: "InstrumentSerif_400Regular" }}>
                    {display.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[type.small, { color: t.text, textAlign: "center" }]} numberOfLines={2}>
              {display}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  roundBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  search: {
    marginHorizontal: 20,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 18,
    paddingRight: 8,
  },
  searchCam: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: 20, marginTop: 16, height: 230, borderRadius: radius.xl, overflow: "hidden", justifyContent: "flex-end" },
  heroPanel: { margin: 12, borderRadius: radius.lg, padding: 16, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  heroGo: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  catRow: { paddingHorizontal: 20, gap: 10, paddingTop: 22 },
  catDisc: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 14 },
  gridCell: { width: "47.6%" },
  deal: { marginHorizontal: 20, marginTop: 26, borderRadius: radius.xl, padding: 18, gap: 16 },
  dealTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dealRow: { flexDirection: "row", gap: 10 },
  dealImg: { aspectRatio: 1, borderRadius: radius.md, overflow: "hidden" },
  avRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, padding: 3 },
  avImg: { width: "100%", height: "100%", borderRadius: 33, overflow: "hidden" },
});
