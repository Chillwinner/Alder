import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { THEME } from "../../theme";

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", zIndex: 900 }}>
    <AbsoluteFill
      style={{
        backgroundColor: THEME.alderTeal,
        mixBlendMode: "soft-light",
        opacity: 0.16,
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)",
      }}
    />
  </AbsoluteFill>
);

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 950,
        backgroundImage: noise,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.06,
        mixBlendMode: "overlay",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      zIndex: 960,
      background:
        "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.55) 100%)",
    }}
  />
);
