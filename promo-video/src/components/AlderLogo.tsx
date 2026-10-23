import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SPRING_PRESETS, THEME } from "../theme";

interface AlderLogoProps {
  size?: number;
  showGlow?: boolean;
}

export const AlderLogo: React.FC<AlderLogoProps> = ({
  size = 80,
  showGlow = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleSpring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.smooth,
  });

  const pulse = Math.sin(frame * 0.08) * 0.05 + 1;
  const glowOpacity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.35, 0.7]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scaleSpring * pulse})`,
      }}
    >
      {showGlow && (
        <div
          style={{
            position: "absolute",
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${THEME.alderTealGlow} 0%, rgba(56, 189, 248, 0.2) 40%, transparent 70%)`,
            opacity: glowOpacity,
            filter: "blur(20px)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* SVG Emblem based on Alder brand asset */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        style={{
          filter: `drop-shadow(0 8px 24px rgba(20, 184, 166, 0.5))`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <defs>
          <linearGradient id="alderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect
          width="80"
          height="80"
          rx="22"
          fill="url(#alderGrad)"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
        />
        <rect
          x="1"
          y="1"
          width="78"
          height="78"
          rx="21"
          fill="url(#innerGlow)"
        />

        {/* Tree & Nodes Vector Motif */}
        <path
          d="M40 16c2 10 2 16 0 24 8-2 16-1 22 4-8 2-14 6-18 14 2-10 1-18-4-26-6 3-12 3-18 0 6-4 12-6 18-12z"
          fill="#FFFFFF"
          style={{
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
          }}
        />
        <path
          d="M40 40v24"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Dynamic Glowing Node Accent */}
        <circle
          cx="40"
          cy="40"
          r="3"
          fill="#38BDF8"
          style={{
            filter: "drop-shadow(0 0 6px #38BDF8)",
          }}
        />
      </svg>
    </div>
  );
};
