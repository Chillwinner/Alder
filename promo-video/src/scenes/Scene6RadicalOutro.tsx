import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AlderLogo } from "../components/AlderLogo";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene6RadicalOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const subSpring = spring({
    frame: frame - 6,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const badgeSpring = spring({
    frame: frame - 14,
    fps,
    config: SPRING_PRESETS.slam,
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: THEME.fontFamily,
      }}
    >
      {/* Background Central Laser Aurora */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, rgba(0, 240, 255, 0.15) 40%, transparent 70%)`,
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      {/* Brand Logo Slam */}
      <div
        style={{
          transform: `scale(${interpolate(slam, [0, 1], [0.4, 1.1])})`,
          opacity: interpolate(slam, [0, 0.3], [0, 1]),
          marginBottom: 24,
        }}
      >
        <AlderLogo size={130} />
      </div>

      {/* Giant Kinetic Title */}
      <div
        style={{
          textAlign: "center",
          transform: `scale(${interpolate(slam, [0, 1], [1.4, 1])})`,
          opacity: interpolate(slam, [0, 0.3], [0, 1]),
          marginBottom: 14,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 84,
            fontWeight: 900,
            letterSpacing: "-2px",
            background: `linear-gradient(135deg, #FFFFFF 10%, #2DD4BF 60%, ${THEME.neonCyan} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 10px 50px rgba(0,0,0,0.8)",
          }}
        >
          Alder · 拖一下，就接上
        </h1>
      </div>

      {/* Flagship Slogan */}
      <div
        style={{
          transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
          opacity: interpolate(subSpring, [0, 0.4], [0, 1]),
          textAlign: "center",
          fontSize: 30,
          fontWeight: 700,
          color: "#FFFFFF",
          marginBottom: 36,
          letterSpacing: "-0.5px",
        }}
      >
        把文件、备忘录、聊天装在同一台机器上
      </div>

      {/* Action Badges */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          transform: `scale(${interpolate(badgeSpring, [0, 1], [0.8, 1])})`,
          opacity: interpolate(badgeSpring, [0, 0.3], [0, 1]),
        }}
      >
        <div
          style={{
            padding: "14px 30px",
            borderRadius: 8,
            background: "linear-gradient(135deg, #14B8A6, #0D9488)",
            boxShadow: THEME.shadowLaserTeal,
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>🚀</span>
          <span>Beta v0.1 · 开源私有工作站</span>
        </div>

        <div
          style={{
            padding: "14px 28px",
            borderRadius: 8,
            background: "rgba(10, 14, 24, 0.9)",
            border: THEME.borderCyan,
            boxShadow: THEME.shadowLaserCyan,
            color: THEME.neonCyan,
            fontSize: 18,
            fontFamily: THEME.monoFont,
            fontWeight: 800,
            letterSpacing: "1px",
          }}
        >
          http://localhost
        </div>
      </div>
    </AbsoluteFill>
  );
};
