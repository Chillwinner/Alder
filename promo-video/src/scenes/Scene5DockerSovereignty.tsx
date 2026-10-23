import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene5DockerSovereignty: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const cmd = "docker compose up -d --build";
  const typedCount = Math.floor(
    interpolate(frame, [4, 25], [0, cmd.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const exitOpacity = interpolate(frame, [90, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: THEME.fontFamily,
        opacity: exitOpacity,
        padding: "36px 60px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
          transform: `scale(${interpolate(slam, [0, 1], [0.9, 1])})`,
          opacity: slam,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: THEME.alderTeal,
            letterSpacing: "3px",
            fontFamily: THEME.monoFont,
            marginBottom: 6,
          }}
        >
          // ZERO CLOUD EXPOSURE · 100% LOCAL SOVEREIGNTY
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: "#FFFFFF" }}>
          一台机器，一个 Docker Compose，完整运行
        </div>
      </div>

      {/* Main Terminal + Nodes Canvas */}
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          display: "flex",
          gap: 30,
          alignItems: "stretch",
        }}
      >
        {/* Terminal */}
        <div
          style={{
            flex: 1.2,
            borderRadius: 16,
            background: "rgba(8, 10, 16, 0.95)",
            border: THEME.borderGlassBright,
            boxShadow: THEME.shadowCard,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            fontFamily: THEME.monoFont,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingBottom: 14,
              marginBottom: 16,
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
            <span style={{ fontSize: 12, color: THEME.textMuted, marginLeft: 8 }}>
              alder@workstation:~#
            </span>
          </div>

          <div style={{ fontSize: 15, lineHeight: 1.8, color: "#FFFFFF" }}>
            <div>
              <span style={{ color: THEME.alderTeal }}>$ </span>
              <span>git clone alder && cd alder</span>
            </div>
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
                  opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0,
                }}
              />
            </div>

            {frame > 26 && (
              <div style={{ color: THEME.cyberLime, fontSize: 13, marginTop: 8 }}>
                ✔ Container alder-gateway Started [Port 80/8080]
              </div>
            )}
            {frame > 34 && (
              <div style={{ color: "#38BDF8", fontSize: 13 }}>
                ✔ Volume alder-pg Attached (PostgreSQL 持久卷)
              </div>
            )}
            {frame > 42 && (
              <div style={{ color: "#38BDF8", fontSize: 13 }}>
                ✔ Volume alder-files Mounted (本地数据保全卷)
              </div>
            )}
            {frame > 50 && (
              <div
                style={{
                  color: "#2DD4BF",
                  fontSize: 13,
                  fontWeight: 800,
                  marginTop: 10,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(20, 184, 166, 0.15)",
                  border: `1px solid ${THEME.alderTeal}`,
                }}
              >
                ★ Alder 本机工作站已启动: http://localhost
              </div>
            )}
          </div>
        </div>

        {/* 3 Architecture Pills */}
        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 14,
              background: "rgba(10, 14, 24, 0.9)",
              border: THEME.borderTeal,
              boxShadow: THEME.shadowLaserTeal,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span style={{ fontSize: 26 }}>🌐</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>
                alder-gateway 网关
              </div>
              <div style={{ fontSize: 11, color: "#2DD4BF" }}>
                WebUI 静态代理 + REST API + 毫秒级总线
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "16px 20px",
              borderRadius: 14,
              background: "rgba(10, 14, 24, 0.9)",
              border: THEME.borderGlass,
              boxShadow: THEME.shadowCard,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span style={{ fontSize: 26 }}>🗄️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>
                alder-pg 持久卷
              </div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>
                停容器绝不丢数据 · 成员角色完全保留
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "16px 20px",
              borderRadius: 14,
              background: "rgba(10, 14, 24, 0.9)",
              border: THEME.borderGlass,
              boxShadow: THEME.shadowCard,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span style={{ fontSize: 26 }}>📁</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>
                alder-files 存储卷
              </div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>
                直接落盘本地目录 · 亦可挂载 S3 对象存储
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
