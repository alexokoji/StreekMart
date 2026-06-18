import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { Chip } from "../components/Chip";
import { CategoryPicker } from "../components/CategoryPicker";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { pickImages, uploadImage } from "../lib/imagePicker";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SUGGESTED_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free size"];

// Custom attribute groups the seller defines (e.g. Color, Material).
// Each saves to `attributesJson` as
//   [{ id, label, options: [{ id, label }] }]
// — the exact shape ProductDetail reads.
type VariantGroup = {
  id: string;
  label: string;
  options: string[];
};

const SUGGESTED_GROUPS: Array<{ label: string; options: string[] }> = [
  { label: "Color", options: ["Black", "White", "Beige", "Burgundy", "Navy"] },
  { label: "Material", options: ["Cotton", "Linen", "Wool", "Silk", "Polyester"] },
  { label: "Style", options: ["Slim", "Regular", "Oversized"] },
];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function AddProductScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [category, setCategory] = useState("");
  const [stockCount, setStockCount] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantGroup[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleSize(s: string) {
    setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function pickImage() {
    const assets = await pickImages({ multiple: true });
    if (assets.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      const failures: string[] = [];
      for (const a of assets) {
        try {
          const url = await uploadImage(a);
          uploaded.push(url);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "Unknown error");
        }
      }
      if (uploaded.length > 0) setImages((cur) => [...cur, ...uploaded]);
      if (failures.length > 0) {
        Alert.alert(
          uploaded.length === 0 ? "Couldn't upload" : "Some uploads failed",
          failures[0],
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i: number) {
    setImages((cur) => cur.filter((_, idx) => idx !== i));
  }

  function valid(): string | null {
    if (!name.trim()) return "Enter a product name.";
    if (!description.trim()) return "Enter a description.";
    if (!price.trim() || Number(price) <= 0) return "Enter a valid price.";
    if (salePrice && Number(salePrice) >= Number(price)) return "Sale price must be lower than price.";
    if (!category.trim()) return "Enter a category.";
    return null;
  }

  function addGroup(label: string, options: string[] = []) {
    if (variants.some((v) => v.label.toLowerCase() === label.toLowerCase())) return;
    setVariants((cur) => [
      ...cur,
      { id: slugify(label) || `g${cur.length}`, label, options },
    ]);
  }

  function removeGroup(id: string) {
    setVariants((cur) => cur.filter((g) => g.id !== id));
  }

  function addOption(groupId: string, opt: string) {
    const v = opt.trim();
    if (!v) return;
    setVariants((cur) =>
      cur.map((g) =>
        g.id === groupId && !g.options.some((o) => o.toLowerCase() === v.toLowerCase())
          ? { ...g, options: [...g.options, v] }
          : g,
      ),
    );
  }

  function removeOption(groupId: string, opt: string) {
    setVariants((cur) =>
      cur.map((g) => (g.id === groupId ? { ...g, options: g.options.filter((o) => o !== opt) } : g)),
    );
  }

  async function save() {
    const err = valid();
    if (err) {
      Alert.alert("Almost there", err);
      return;
    }
    setBusy(true);
    try {
      // Serialise variants to the JSON shape ProductDetail expects.
      const attributesJson = variants.length > 0
        ? JSON.stringify(
            variants.map((g) => ({
              id: g.id,
              label: g.label,
              options: g.options.map((o) => ({ id: slugify(o), label: o })),
            })),
          )
        : undefined;
      const body = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        salePrice: salePrice ? Number(salePrice) : null,
        category: category.trim(),
        stockCount: stockCount ? Number(stockCount) : 0,
        sizes,
        attributesJson,
        images,
      };
      await api.post("/api/seller/products", body);
      Alert.alert("Listed", `${name} is now visible to buyers.`, [
        { text: "OK", onPress: () => nav.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Add product" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Section label="Photos">
          <View style={styles.photoRow}>
            {images.map((uri, i) => (
              <View key={uri + i} style={[styles.photo, { borderColor: t.border }]}>
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                <Pressable
                  onPress={() => removeImage(i)}
                  style={[styles.removeBtn, { backgroundColor: t.danger.fg }]}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={pickImage}
              disabled={uploading}
              style={({ pressed }) => [
                styles.photo,
                styles.photoAdd,
                {
                  borderColor: t.border,
                  backgroundColor: t.card,
                  opacity: pressed || uploading ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={uploading ? "cloud-upload-outline" : "add"}
                size={28}
                color={t.textMuted}
              />
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                {uploading ? "Uploading…" : "Add photo"}
              </Text>
            </Pressable>
          </View>
        </Section>

        <Section label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Ankara wrap dress" />
        </Section>

        <Section label="Description">
          <View
            style={[
              styles.textarea,
              { backgroundColor: t.scheme === "dark" ? t.card : "#f2f2f6" },
            ]}
          >
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Materials, fit, care, anything buyers should know"
              placeholderTextColor={t.textMuted}
              multiline
              style={{ color: t.text, fontSize: 15, minHeight: 100, textAlignVertical: "top" }}
            />
          </View>
        </Section>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Section label="Price (₦)">
              <Input
                value={price}
                onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                placeholder="12000"
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section label="Sale price (optional)">
              <Input
                value={salePrice}
                onChangeText={(v) => setSalePrice(v.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                placeholder="9500"
              />
            </Section>
          </View>
        </View>

        <Section label="Category">
          <CategoryPicker value={category} onChange={setCategory} />
        </Section>

        <Section label="Stock count">
          <Input
            value={stockCount}
            onChangeText={(v) => setStockCount(v.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="0"
          />
        </Section>

        <Section label="Available sizes (optional)">
          <View style={styles.chipWrap}>
            {SUGGESTED_SIZES.map((s) => (
              <Chip key={s} label={s} selected={sizes.includes(s)} onPress={() => toggleSize(s)} />
            ))}
          </View>
        </Section>

        <Section label="Variations (optional)">
          {variants.length === 0 ? (
            <Text style={[type.small, { color: t.textMuted, marginBottom: 10 }]}>
              Add options like colour or material so buyers can pick what they want.
            </Text>
          ) : (
            <View style={{ gap: 14, marginBottom: 14 }}>
              {variants.map((g) => (
                <VariantGroupRow
                  key={g.id}
                  group={g}
                  onAdd={(opt) => addOption(g.id, opt)}
                  onRemoveOption={(opt) => removeOption(g.id, opt)}
                  onDelete={() => removeGroup(g.id)}
                />
              ))}
            </View>
          )}
          <View style={styles.suggestRow}>
            {SUGGESTED_GROUPS.filter(
              (s) => !variants.some((v) => v.label.toLowerCase() === s.label.toLowerCase()),
            ).map((s) => (
              <Pressable
                key={s.label}
                onPress={() => addGroup(s.label, [])}
                style={({ pressed }) => [
                  styles.suggestChip,
                  { borderColor: t.cta, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="add" size={14} color={t.cta} />
                <Text style={{ color: t.cta, fontWeight: "700", marginLeft: 4 }}>{s.label}</Text>
              </Pressable>
            ))}
            <AddCustomGroup onAdd={(label) => addGroup(label, [])} />
          </View>
        </Section>

        <Pressable
          onPress={save}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: busy ? 0.7 : pressed ? 0.9 : 1, marginTop: 28 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
            {busy ? "Publishing…" : "Publish product"}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function VariantGroupRow({
  group,
  onAdd,
  onRemoveOption,
  onDelete,
}: {
  group: VariantGroup;
  onAdd: (opt: string) => void;
  onRemoveOption: (opt: string) => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState("");
  return (
    <View style={[styles.variantCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.variantHead}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{group.label}</Text>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={t.danger.fg} />
        </Pressable>
      </View>
      <View style={[styles.chipWrap, { marginTop: 8 }]}>
        {group.options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onRemoveOption(opt)}
            style={[styles.valueChip, { backgroundColor: t.accentSoft, borderColor: t.accent }]}
          >
            <Text style={{ color: t.accent, fontWeight: "700" }}>{opt}</Text>
            <Ionicons name="close" size={14} color={t.accent} style={{ marginLeft: 4 }} />
          </Pressable>
        ))}
      </View>
      <View style={styles.addOptionRow}>
        <View style={{ flex: 1 }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={`Add a ${group.label.toLowerCase()} option`}
            returnKeyType="done"
            onSubmitEditing={() => {
              onAdd(draft);
              setDraft("");
            }}
          />
        </View>
        <Pressable
          onPress={() => {
            onAdd(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
          style={({ pressed }) => [
            styles.addOptionBtn,
            { backgroundColor: t.cta, opacity: !draft.trim() ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={20} color={t.ctaText} />
        </Pressable>
      </View>
    </View>
  );
}

function AddCustomGroup({ onAdd }: { onAdd: (label: string) => void }) {
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (!adding) {
    return (
      <Pressable
        onPress={() => setAdding(true)}
        style={({ pressed }) => [
          styles.suggestChip,
          { borderColor: t.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="add" size={14} color={t.text} />
        <Text style={{ color: t.text, fontWeight: "700", marginLeft: 4 }}>Custom</Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.customInput, { borderColor: t.cta, backgroundColor: t.bg }]}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Group name"
        placeholderTextColor={t.textMuted}
        autoFocus
        style={{ color: t.text, fontSize: 14, minWidth: 100 }}
        onSubmitEditing={() => {
          if (draft.trim()) onAdd(draft.trim());
          setDraft("");
          setAdding(false);
        }}
      />
      <Pressable
        onPress={() => {
          if (draft.trim()) onAdd(draft.trim());
          setDraft("");
          setAdding(false);
        }}
        hitSlop={6}
      >
        <Ionicons name="checkmark" size={18} color={t.cta} />
      </Pressable>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 80 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  photoAdd: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  photoImg: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textarea: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  variantCard: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  variantHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  valueChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  addOptionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addOptionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  customInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
