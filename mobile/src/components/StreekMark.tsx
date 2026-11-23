import React from "react";
import { Image } from "react-native";

// The StreekMart logo on a transparent background (assets/logo-mark.png,
// cut from the original logo by scripts/cutout-logo.py). `size` is the
// height; width follows the artwork's aspect ratio.
const ASPECT = 743 / 807;

export function StreekMark({ size = 120 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/logo-mark.png")}
      style={{ width: size * ASPECT, height: size }}
      resizeMode="contain"
      accessibilityLabel="StreekMart"
    />
  );
}
