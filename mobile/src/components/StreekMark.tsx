import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

// The StreekMart mark: a bag with a serif S and gold rivets. Vector, so it
// stays sharp at any size and can be recoloured (e.g. on light surfaces).
// Same geometry as assets/brand/*.svg (see scripts/brand-svgs.py).
const S_PATH =
  "M184 -9Q164 -9 139.5 -5.0Q115 -1 93.5 5.0Q72 11 60 18Q53 22 49.5 26.5Q46 31 46 42L41 199Q41 219 54 219Q65 219 69 201L78 163Q112 20 205 20Q255 20 284.5 53.5Q314 87 314 148Q314 207 283.5 258.0Q253 309 186 359Q112 412 78.0 461.5Q44 511 44 567Q44 641 95.5 685.5Q147 730 227 730Q257 730 285.0 723.0Q313 716 331 703Q337 699 340.5 694.0Q344 689 344 681L347 530Q347 513 334 513Q325 513 321 527L314 552Q292 629 268.5 664.5Q245 700 201 700Q158 700 132.5 672.0Q107 644 107 593Q107 550 135.0 511.0Q163 472 233 416Q308 355 342.5 298.5Q377 242 377 178Q377 122 352.0 80.0Q327 38 283.5 14.5Q240 -9 184 -9Z";
const BAG =
  "M316 372 H708 Q732 372 734 396 L772 790 Q776 836 730 836 H294 Q248 836 252 790 L290 396 Q292 372 316 372 Z";
const HANDLE = "M392 376 C392 236 632 236 632 376";

export function StreekMark({
  size = 120,
  body = "#F6F3ED",
  letter = "#5B21B6",
  rivet = "#F2C14E",
}: {
  size?: number;
  body?: string;
  letter?: string;
  rivet?: string;
}) {
  // viewBox crops to the mark's own bounds so `size` is the mark's height.
  return (
    <Svg width={size * (540 / 610)} height={size} viewBox="246 226 540 610" accessibilityLabel="StreekMart">
      <Path d={HANDLE} fill="none" stroke={body} strokeWidth={46} strokeLinecap="round" />
      <Path d={BAG} fill={body} />
      <G transform={`translate(${418.67} ${764.98}) scale(0.44655 ${-0.44655})`}>
        <Path d={S_PATH} fill={letter} />
      </G>
      <Circle cx={392} cy={376} r={21} fill={rivet} />
      <Circle cx={632} cy={376} r={21} fill={rivet} />
    </Svg>
  );
}
