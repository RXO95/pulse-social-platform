/**
 * PulseLogo — crisp SVG logo that adapts to theme.
 * Props:
 *   height  — overall height (default 30)
 *   variant — "full" (icon + wordmark) | "icon" (just the mark)
 *   color   — explicit fill override (auto-detects from theme if omitted)
 */
export default function PulseLogo({ height = 30, variant = "full", color }) {
  const fill = color || "currentColor";
  const iconSize = height;
  const wordH = height * 0.55;

  // ── Icon: ringed planet on gradient background ──
  const icon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pulseBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Gradient background */}
      <rect width="64" height="64" rx="16" fill="url(#pulseBg)" />
      {/* Orbital ring (behind planet) */}
      <ellipse
        cx="32" cy="32" rx="24" ry="8"
        transform="rotate(-25 32 32)"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Planet body */}
      <circle cx="32" cy="32" r="10" fill="#fff" />
      {/* Moon accent */}
      <circle cx="50" cy="19" r="2.5" fill="#fff" opacity="0.6" />
    </svg>
  );

  if (variant === "icon") return icon;

  // ── Full: icon + "pulse" wordmark ──
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: height * 0.3 }}>
      {icon}
      <svg
        height={wordH}
        viewBox="0 0 260 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {/* "pulse" in a clean, bold sans-serif style */}
        <text
          x="0"
          y="55"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="62"
          fill={fill}
          letterSpacing="-2"
        >
          pulse
        </text>
      </svg>
    </span>
  );
}
