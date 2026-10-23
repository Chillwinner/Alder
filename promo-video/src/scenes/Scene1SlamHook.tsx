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

export const Scene1SlamHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 1: Slam Hook (0 - 35 frames)
  const slam1Spring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });
  const slam1Scale = interpolate(slam1Spring, [0, 1], [2.6, 1]);
  const slam1Spacing = interpolate(slam1Spring, [0, 1], [14, 0]);
  const slam1Opacity = interpolate(slam1Spring, [0, 0.3], [0, 1]);

  // Beat 2: Logo Reveal (35 - 70 frames)
  const logoSpring = spring({
    frame: frame - 32,
    fps,
    config: SPRING_PRESETS.slam,
  });

  // Beat 3: Alder Title & Punchline (65 - 105 frames)
  const titleSpring = spring({
    frame: frame - 60,
    fps,
    config: SPRING_PRESETS.slam,
  });

  // Exit transition
  const exitOpacity = interpolate(frame, [95, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = interpolate(frame, [95, 105], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      {/* Background Laser Horizon */}
      <div
        style={{
          position: "absolute",
          width: "140%",
          height: 2,
          background: `linear-gradient(90deg, transparent, ${THEME.alderTeal}, ${THEME.neonCyan}, transparent)`,
          boxShadow: `0 0 20px ${THEME.neonCyan}`,
          top: "52%",
          opacity: 0.4,
        }}
      />

      {/* PHASE 1: Hook Question Slam (Frames 0 - 35) */}
      {frame < 40 && (
        <div
          style={{
            textAlign: "center",
            transform: `scale(${slam1Scale})`,
            letterSpacing: `${slam1Spacing}px`,
            opacity: slam1Opacity,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: THEME.neonCyan,
              textTransform: "uppercase",
              letterSpacing: "4px",
              marginBottom: 12,
            }}
          >
            // DATA SOVEREIGNTY CRISIS
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.1,
              textShadow: "0 0 50px rgba(255,255,255,0.4)",
            }}
          >
            告别云端泄露
            <span style={{ color: THEME.alderTeal, display: "block" }}>
              告别反复上传
            </span>
          </div>
        </div>
      )}

      {/* PHASE 2 & 3: Alder Workstation Emergence (Frames 36 - 105) */}
      {frame >= 35 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Glowing Brand Emblem */}
          <div
            style={{
              transform: `scale(${interpolate(logoSpring, [0, 1], [0.3, 1])})`,
              opacity: interpolate(logoSpring, [0, 0.3], [0, 1]),
              marginBottom: 20,
            }}
          >
            <AlderLogo size={120} />
          </div>

          {/* Title with Laser Gradient */}
          <div
            style={{
              transform: `translateY(${interpolate(titleSpring, [0, 1], [40, 0])}px)`,
              opacity: interpolate(titleSpring, [0, 0.4], [0, 1]),
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                marginBottom: 10,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 88,
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
                  letterSpacing: "1px",
                  boxShadow: THEME.shadowLaserTeal,
                }}
              >
                Beta v0.1
              </div>
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#FFFFFF",
                marginBottom: 24,
                letterSpacing: "-0.5px",
              }}
            >
              本机工作站 · 一台机器跑完整站
            </div>

            {/* Tactical Badges */}
            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: THEME.borderGlass,
                  color: THEME.neonCyan,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: THEME.monoFont,
                }}
              >
                [ 100% 本地数据自主 ]
              </span>
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(20, 184, 166, 0.12)",
                  border: THEME.borderTeal,
                  color: "#2DD4BF",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: THEME.monoFont,
                }}
              >
                [ 局域网全员自洽 ]
              </span>
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: THEME.borderGlass,
                  color: THEME.cyberLime,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: THEME.monoFont,
                }}
              >
                [ 三位一体无感拖拽 ]
              </span>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
