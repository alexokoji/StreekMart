import React, { useId } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

// Fabric swatches drawn as vector patterns. Used as stand-in imagery in the
// onboarding illustrations; they echo the textiles sold on StreekMart.
export type FabricKind = "ankara" | "kente" | "lace" | "adire" | "coral" | "diamond";

export function Fabric({ kind, style }: { kind: FabricKind; style?: ViewStyle }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {kind === "ankara" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={46} height={46}>
              <Rect width={46} height={46} fill="#5B21B6" />
              <Circle cx={0} cy={0} r={6} fill="#F2C14E" />
              <Circle cx={46} cy={0} r={6} fill="#F2C14E" />
              <Circle cx={0} cy={46} r={6} fill="#F2C14E" />
              <Circle cx={46} cy={46} r={6} fill="#F2C14E" />
              <Circle cx={23} cy={23} r={12} fill="#FFFFFF" />
              <Circle cx={23} cy={23} r={5} fill="#5B21B6" />
            </Pattern>
          )}
          {kind === "kente" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={38} height={38}>
              <Rect width={14} height={38} fill="#177A4B" />
              <Rect x={14} width={8} height={38} fill="#F2C14E" />
              <Rect x={22} width={8} height={38} fill="#17121F" />
              <Rect x={30} width={8} height={38} fill="#C2392F" />
            </Pattern>
          )}
          {kind === "lace" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={15} height={15}>
              <Rect width={15} height={15} fill="#F3EAD7" />
              <Circle cx={7.5} cy={7.5} r={2.6} fill="#CDB98F" />
            </Pattern>
          )}
          {kind === "adire" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={38} height={38}>
              <Rect width={38} height={38} fill="#3B4BB0" />
              <Rect width={19} height={19} fill="#1F2A6B" />
              <Rect x={19} y={19} width={19} height={19} fill="#1F2A6B" />
            </Pattern>
          )}
          {kind === "coral" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={28} height={28}>
              <Rect width={28} height={28} fill="#FAD9CE" />
              <Circle cx={0} cy={0} r={13} fill="none" stroke="#EE8F78" strokeWidth={7} />
              <Circle cx={28} cy={28} r={13} fill="none" stroke="#EE8F78" strokeWidth={7} />
            </Pattern>
          )}
          {kind === "diamond" && (
            <Pattern id={id} patternUnits="userSpaceOnUse" width={42} height={42}>
              <Rect width={42} height={42} fill="#0F5C4D" />
              <Rect x={21} y={0} width={21} height={21} fill="#F2C14E" />
              <Rect x={0} y={21} width={21} height={21} fill="#F3ECD9" />
            </Pattern>
          )}
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
