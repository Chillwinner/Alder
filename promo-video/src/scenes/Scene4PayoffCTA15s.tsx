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

export const Scene4PayoffCTA15s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Part 1: Terminal quick slam (0 - 40 frames)
  const isTerminal = frame < 40;
  const terminalSpring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const cmd = "docker compose up -d";
  const typedCount = Math.floor(
    interpolate(frame, [4, 18], [0, cmd.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  // Part 2: Final Climax & Logo (40 - 90 frames)
  const climaxSpring = spring({
    frame: frame - 38,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const breathe = 1 + Math.sin(frame / 20) * 0.015;

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
      {/* SFX: Hit on start, Shimmer on climax */}
      {frame === 0 && <Audio src={staticFile("sfx/hit.wav")} volume={0.6} />}
      {frame === 38 && <Audio src={staticFile("sfx/shimmer.wav")} volume={0.7} />}

      {/* PHASE 1: Terminal & Docker (Frames 0 - 39) */}
      {isTerminal && (
        <div
          style={{
            width: 800,
            borderRadius: 16,
            background: "rgba(10, 13, 20, 0.95)",
            border: THEME.borderTeal,
            boxShadow: THEME.shadowLaserTeal,
            padding: 24,
            transform: `scale(${interpolate(terminalSpring, [0, 1], [0.85, 1])})`,
            opacity: interpolate(terminalSpring, [0, 0.3], [0, 1]),
            fontFamily: THEME.monoFont,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingBottom: 12,
              marginBottom: 14,
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
            <span style={{ fontSize: 12, color: THEME.textMuted, marginLeft: 8 }}>
              alder-workstation:~#
            </span>
          </div>

          <div style={{ fontSize: 16, lineHeight: 1.8, color: "#FFFFFF" }}>
            <div>
              <span style={{ color: THEME.alderTeal }}>$ </span>
              <span style={{ color: THEME.neonCyan, fontWeight: 800 }}>
                {cmd.slice(0, typedCount)}
              </span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 16,
                  background: THEME.neonCyan,
                  marginLeft: 4,
                  verticalAlign: "middle",
                  opacity: Math.sin(frame * 0.5) > 0 ? 1 : 0,
                }}
              />
            </div>

            {frame > 20 && (
              <div style={{ color: THEME.cyberLime, fontSize: 13, marginTop: 8 }}>
                ✔ Container alder-gateway Running (:80/:8080)
              </div>
            )}
            {frame > 28 && (
              <div style={{ color: "#38BDF8", fontSize: 13 }}>
                ✔ Volume alder-pg (PostgreSQL持久卷，停机不丢) + alder-files Mounted
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 2: Final Brand Climax (Frames 40 - 90) */}
      {!isTerminal && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${interpolate(climaxSpring, [0, 1], [0.8, 1])})`,
            opacity: interpolate(climaxSpring, [0, 0.3], [0, 1]),
          }}
        >
          {/* Logo with Spark Rays */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <SparkRays size={300} delay={40} color={THEME.alderTeal} />
            <div style={{ transform: `scale(${breathe})` }}>
              <AlderLogo size={120} />
            </div>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: "-2px",
              background: `linear-gradient(135deg, #FFFFFF 20%, #2DD4BF 60%, ${THEME.neonCyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 10px 40px rgba(0,0,0,0.8)",
            }}
          >
            Alder · 拖一下，就接上
          </h1>

          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#FFFFFF",
              marginBottom: 28,
              letterSpacing: "-0.5px",
            }}
          >
            把文件、备忘录、聊天装在同一台机器上
          </div>

          {/* CTA Badges */}
          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #14B8A6, #0D9488)",
                boxShadow: THEME.shadowLaserTeal,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              Beta v0.1 · 开源私有工作站
            </div>

            <div
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                background: "rgba(10, 14, 24, 0.9)",
                border: THEME.borderCyan,
                boxShadow: THEME.shadowLaserCyan,
                color: THEME.neonCyan,
                fontSize: 16,
                fontFamily: THEME.monoFont,
                fontWeight: 800,
              }}
            >
              http://localhost
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
