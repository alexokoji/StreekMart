import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import type { Address } from "./AddressesScreen";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Add/edit screen. Reached from AddressesScreen via the "+ Add" button or
// the per-row "Edit" link. `id` is undefined when creating a new address.
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
      Alert.alert("Missing info", "Enter an address.");
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
    <Screen keyboard>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[type.h1, { color: t.text }]}>{id ? "Edit address" : "New address"}</Text>
        {loading ? (
          <Text style={[type.body, { color: t.textMuted, marginTop: 12 }]}>Loading...</Text>
        ) : (
          <>
            <Field t={t} label="Label (Home, Office)" value={label} onChange={setLabel} />
            <Field t={t} label="Phone (optional)" value={phone} onChange={setPhone} keyboardType="phone-pad" />
            <View style={styles.field}>
              <Text style={[type.small, { color: t.textMuted }]}>Street, area, city, postcode</Text>
              <TextInput
                multiline
                value={formattedAddress}
                onChangeText={setFormattedAddress}
                placeholderTextColor={t.textFaint}
                style={[styles.input, styles.textarea, { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text }]}
              />
            </View>
            <Field t={t} label="City" value={city} onChange={setCity} />
            <Field t={t} label="Region / state" value={region} onChange={setRegion} />
            <Field t={t} label="Country code (e.g. NG)" value={country} onChange={(v) => setCountry(v.toUpperCase())} />
            <View style={[styles.field, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
              <Text style={[type.body, { color: t.text }]}>Make default</Text>
              <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: t.cta, false: t.border }} />
            </View>
            <Button label={id ? "Save changes" : "Add address"} loading={busy} onPress={save} style={{ marginTop: 24 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Field({
  t, label, value, onChange, keyboardType,
}: {
  t: ReturnType<typeof useTheme>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={[type.small, { color: t.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor={t.textFaint}
        style={[styles.input, { backgroundColor: t.bgElevated, borderColor: t.border, color: t.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 14, gap: 6 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  textarea: { height: 80, paddingVertical: 10, textAlignVertical: "top" },
});