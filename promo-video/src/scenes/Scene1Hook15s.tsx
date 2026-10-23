import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AlderLogo } from "../components/AlderLogo";
import { SparkRays } from "../components/motion/SparkRays";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene1Hook15s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance Slam
  const markSpring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const titleSpring = spring({
    frame: frame - 8,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const subSpring = spring({
    frame: frame - 18,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const badgeSpring = spring({
    frame: frame - 28,
    fps,
    config: SPRING_PRESETS.slam,
  });

  // Exit transition (faster than entrance, last 10 frames)
  const exitOpacity = interpolate(frame, [65, 75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = interpolate(frame, [65, 75], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Idle breath
  const breathe = 1 + Math.sin(frame / 20) * 0.015;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: THEME.fontFamily,
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
      }}
    >
      {/* SFX: Hit on start, Whoosh on title */}
      <Audio src={staticFile("sfx/hit.wav")} volume={0.6} />
      {frame >= 8 && <Audio src={staticFile("sfx/whoosh.wav")} volume={0.4} />}

      {/* Spark rays around logo */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <SparkRays size={280} delay={4} color={THEME.alderTeal} />
        <div
          style={{
            transform: `scale(${interpolate(markSpring, [0, 1], [0.3, 1]) * breathe})`,
            opacity: interpolate(markSpring, [0, 0.3], [0, 1]),
          }}
        >
          <AlderLogo size={110} />
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          textAlign: "center",
          transform: `scale(${interpolate(titleSpring, [0, 1], [1.3, 1])}) translateY(${interpolate(titleSpring, [0, 1], [30, 0])}px)`,
          opacity: interpolate(titleSpring, [0, 0.3], [0, 1]),
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "-2px",
              background: `linear-gradient(135deg, #FFFFFF 20%, #2DD4BF 60%, ${THEME.neonCyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 10px 40px rgba(0,0,0,0.8)",
            }}
          >
            Alder
          </h1>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(20, 184, 166, 0.2)",
              border: `1.5px solid ${THEME.alderTeal}`,
              color: "#2DD4BF",
              fontSize: 16,
              fontWeight: 800,
              fontFamily: THEME.monoFont,
              boxShadow: THEME.shadowLaserTeal,
            }}
          >
            Beta v0.1
          </div>
        </div>
      </div>

      {/* Subhead */}
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${interpolate(subSpring, [0, 1], [25, 0])}px)`,
          opacity: interpolate(subSpring, [0, 0.4], [0, 1]),
          fontSize: 32,
          fontWeight: 800,
          color: "#FFFFFF",
          marginBottom: 28,
          letterSpacing: "-0.5px",
        }}
      >
        本机工作站 · 把文件、备忘录、聊天装在同一台机器上
      </div>

      {/* Capability Capsules */}
      <div
        style={{
          display: "flex",
          gap: 16,
          transform: `scale(${interpolate(badgeSpring, [0, 1], [0.9, 1])})`,
          opacity: interpolate(badgeSpring, [0, 0.3], [0, 1]),
        }}
      >
        <span
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.15)",
            border: THEME.borderTeal,
            color: "#2DD4BF",
            fontSize: 14,
            fontWeight: 800,
            fontFamily: THEME.monoFont,
            boxShadow: THEME.shadowLaserTeal,
          }}
        >
          [ 100% 数据归属本机 ]
        </span>
        <span
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "rgba(0, 240, 255, 0.12)",
            border: THEME.borderCyan,
            color: THEME.neonCyan,
            fontSize: 14,
            fontWeight: 800,
            fontFamily: THEME.monoFont,
          }}
        >
          [ 局域网全员自洽 ]
        </span>
        <span
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.05)",
            border: THEME.borderGlass,
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: THEME.monoFont,
          }}
        >
          [ 拖一下 · 就接上 ]
        </span>
      </div>
    </AbsoluteFill>
  );
};
