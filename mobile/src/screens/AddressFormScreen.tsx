import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { Input } from "../components/Input";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import type { Address } from "./AddressesScreen";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AddressFormScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "AddressForm">>();
  const id = route.params?.id;

  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.get<{ addresses: Address[] }>("/api/account/addresses", { kind: "DELIVERY" });
        const a = data.addresses.find((x) => x.id === id);
        if (a) {
          setLabel(a.label ?? "");
          setPhone(a.phone ?? "");
          setFormattedAddress(a.formattedAddress);
          setCity(a.city ?? "");
          setRegion(a.region ?? "");
          setCountry(a.country ?? "");
          setIsDefault(a.isDefault);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save() {
    if (!formattedAddress.trim()) {
      Alert.alert("Missing info", "Enter the street address.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        kind: "DELIVERY",
        label: label || undefined,
        phone: phone || undefined,
        formattedAddress,
        city: city || undefined,
        region: region || undefined,
        country: country || undefined,
        isDefault,
      };
      if (id) {
        await api.patch(`/api/account/addresses/${id}`, body);
      } else {
        await api.post("/api/account/addresses", body);
      }
      nav.goBack();
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={id ? "Edit address" : "New address"} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
          style={{ flex: 1 }}
        >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={[type.small, { color: t.textMuted, marginBottom: 16 }]}>
            We use this for delivery and seller receipts.
          </Text>

          <Field label="Label">
            <Input
              leftIcon={<Ionicons name="pricetag-outline" size={18} color={t.textMuted} />}
              value={label}
              onChangeText={setLabel}
              placeholder="Home, Office, Mum's place"
            />
          </Field>

          <Field label="Phone">
            <Input
              leftIcon={<Ionicons name="call-outline" size={18} color={t.textMuted} />}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="0800 000 0000"
            />
          </Field>

          <Field label="Street address">
            <Input
              leftIcon={<Ionicons name="location-outline" size={18} color={t.textMuted} />}
              value={formattedAddress}
              onChangeText={setFormattedAddress}
              placeholder="Street, area, postcode"
              multiline
              containerStyle={{ height: 84, alignItems: "flex-start", paddingTop: 14 }}
            />
          </Field>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <Input value={city} onChangeText={setCity} placeholder="Lagos" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Region">
                <Input value={region} onChangeText={setRegion} placeholder="LA" />
              </Field>
            </View>
          </View>

          <Field label="Country code">
            <Input
              value={country}
              onChangeText={(v) => setCountry(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="NG"
              maxLength={2}
            />
          </Field>

          <View style={[styles.toggleRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]}>Set as default</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                Use this address by default at checkout.
              </Text>
            </View>
            <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: t.cta, false: t.border }} />
          </View>

          <Pressable
            onPress={busy ? undefined : save}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: busy ? t.accentSoft : t.cta,
                opacity: pressed || busy ? 0.85 : 1,
                marginTop: 28,
              },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "800", fontSize: 16 }}>
              {busy ? "Saving…" : id ? "Save changes" : "Add address"}
            </Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.small, { color: t.textMuted, marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  toggleRow: {
    marginTop: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cta: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
