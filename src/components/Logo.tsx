// StreekMart logo.
//
// Two shapes:
//   <Logo />     — full logo (icon + wordmark "StreekMart.online"), backed by
//                  /public/logo_new.png. The PNG has generous white margins so
//                  we CSS-crop them away via background-size/position.
//   <LogoMark /> — just the bag icon, backed by /public/icon.png — a clean
//                  1024×1024 square crop with no surrounding margin, so we
//                  render it edge-to-edge with no crop math.
//
// `size` is the rendered HEIGHT in pixels. The full logo's width is derived
// from the cropped aspect ratio so the visible logo always stays proportional.

// Source logo_new.png is 1536×1024 with margins. Insets are tuned visually to
// the actual logo bounds — adjust here once if the asset is ever re-exported
// tighter. Bumping `bgSize` zooms in further (crops more); shifting `bgPosX`
// re-centers horizontally.
const CROP_FULL = {
  bgSize: "118% auto",
  bgPosX: "47%",
  bgPosY: "50%",
  // Aspect ratio of the visible cropped content (icon + wordmark) ≈ 2.4.
  aspect: 2.4,
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
        backgroundImage: "url(/logo_new.png)",
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
  // icon.png is the bag isolated on transparent background, already trimmed
  // to its bounds. Rendered as a plain <img> so it scales crisply at any
  // size and inherits no CSS cropping math.
  return (
    <img
      src="/icon.png"
      alt="StreekMart"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      style={{ height: size, width: size }}
    />
  );
}
