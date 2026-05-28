// StreekMart logo.
//
// Renders /public/logo.jpeg via CSS background-image with a tight inset so
// the wide white margins in the source image are clipped away — the logo
// reads bolder without needing to re-export the asset. Two shapes:
//
//   <Logo />     — full logo (icon + wordmark "StreekMart.online").
//   <LogoMark /> — just the bag icon on the left side of the source image.
//                 Used where the wordmark would compete with surrounding
//                 text (e.g. condensed nav bars).
//
// `size` is the rendered HEIGHT in pixels. The width is derived from the
// cropped aspect ratio so the visible logo always stays proportional.

// Source image is roughly 1080×720 with generous white space. These insets
// are tuned visually to the actual logo bounds — adjust here once if the
// asset is ever re-exported tighter.
const CROP_FULL = {
  // Cropped content occupies ~9–95% horizontally and ~24–76% vertically.
  // backgroundSize / backgroundPosition pair achieves "render only that
  // box, scaled to fill the container".
  bgSize: "130% auto",
  bgPosX: "48%",
  bgPosY: "50%",
  // Aspect ratio of the cropped content area (~86% × ~52% of 1080×720).
  // 928/375 ≈ 2.48.
  aspect: 2.48,
};

// Bag icon alone — roughly the leftmost 33% of the cropped box.
const CROP_MARK = {
  bgSize: "330% auto",
  bgPosX: "8%",
  bgPosY: "52%",
  aspect: 1, // square crop on the icon
};

export function Logo({
  size = 28,
  // `showWordmark` is kept for backwards compatibility with existing call
  // sites — when false, we render the icon-only LogoMark; when true, the
  // full image already includes the wordmark so no separate text element
  // is needed.
  showWordmark = true,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  if (!showWordmark) {
    return <LogoMark size={size} className={className} />;
  }
  return (
    <span
      role="img"
      aria-label="StreekMart"
      className={`inline-block align-middle bg-no-repeat ${className}`}
      style={{
        backgroundImage: "url(/logo.jpeg)",
        backgroundSize: CROP_FULL.bgSize,
        backgroundPosition: `${CROP_FULL.bgPosX} ${CROP_FULL.bgPosY}`,
        height: size,
        width: Math.round(size * CROP_FULL.aspect),
      }}
    />
  );
}

export function LogoMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="StreekMart"
      className={`inline-block align-middle bg-no-repeat ${className}`}
      style={{
        backgroundImage: "url(/logo.jpeg)",
        backgroundSize: CROP_MARK.bgSize,
        backgroundPosition: `${CROP_MARK.bgPosX} ${CROP_MARK.bgPosY}`,
        height: size,
        width: Math.round(size * CROP_MARK.aspect),
      }}
    />
  );
}
