export const THEME = {
  // Ultra-deep space & contrast
  bgPitch: "#000000",
  bgDeep: "#05070B",
  bgCarbon: "#0A0D14",
  bgSurface: "rgba(13, 17, 28, 0.85)",
  bgGlass: "rgba(255, 255, 255, 0.04)",
  bgGlassBright: "rgba(255, 255, 255, 0.08)",

  // Laser Accents
  alderTeal: "#14B8A6",
  alderTealGlow: "rgba(20, 184, 166, 0.6)",
  neonCyan: "#00F0FF",
  cyanGlow: "rgba(0, 240, 255, 0.5)",
  electricIndigo: "#6366F1",
  indigoGlow: "rgba(99, 102, 241, 0.5)",
  cyberLime: "#4ADE80",
  limeGlow: "rgba(74, 222, 128, 0.5)",
  hyperOrange: "#FF5500",
  orangeGlow: "rgba(255, 85, 0, 0.5)",
  violetAura: "#A855F7",
  amberWarn: "#FBBF24",

  // Borders
  borderGlass: "1px solid rgba(255, 255, 255, 0.12)",
  borderGlassBright: "1px solid rgba(255, 255, 255, 0.28)",
  borderTeal: "1.5px solid rgba(20, 184, 166, 0.7)",
  borderCyan: "1.5px solid rgba(0, 240, 255, 0.7)",
  borderOrange: "1.5px solid rgba(255, 85, 0, 0.7)",

  // Typography
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'PingFang SC', sans-serif",
  monoFont:
    "'SF Mono', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",

  // Shadows
  shadowCard: "0 25px 60px rgba(0, 0, 0, 0.8)",
  shadowLaserTeal: "0 0 35px rgba(20, 184, 166, 0.5)",
  shadowLaserCyan: "0 0 40px rgba(0, 240, 255, 0.5)",
  shadowLaserOrange: "0 0 40px rgba(255, 85, 0, 0.5)",
};

export const SPRING_PRESETS = {
  // Aggressive Slam for kinetic punches
  slam: { damping: 11, mass: 0.35, stiffness: 280 },
  // High-velocity whip zoom
  whip: { damping: 14, mass: 0.5, stiffness: 200 },
  // Apple flagship smooth
  smooth: { damping: 14, mass: 0.7, stiffness: 140 },
  // Tactile drag
  tactile: { damping: 12, mass: 0.75, stiffness: 130 },
};
