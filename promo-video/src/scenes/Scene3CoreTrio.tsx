import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene3CoreTrio: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3 Phases:
  // Phase 1 (0 - 70 frames): Workspace & Storage
  // Phase 2 (70 - 140 frames): Collaborative Memos
  // Phase 3 (140 - 210 frames): E2EE Global Chat
  const phase = frame < 70 ? 1 : frame < 140 ? 2 : 3;
  const phaseFrame = frame < 70 ? frame : frame < 140 ? frame - 70 : frame - 140;

  // Spring slam for current phase
  const slamSpring = spring({
    frame: phaseFrame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const scale = interpolate(slamSpring, [0, 1], [1.3, 1]);
  const translateY = interpolate(slamSpring, [0, 1], [40, 0]);
  const opacity = interpolate(slamSpring, [0, 0.3], [0, 1]);

  // Overall exit transition (frames 195 - 210)
  const exitOpacity = interpolate(frame, [195, 210], [1, 0], {
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
        justifyContent: "space-between",
      }}
    >
      {/* Top Phase Indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: phase === 1 ? THEME.alderTeal : "rgba(255,255,255,0.06)",
              color: phase === 1 ? "#000" : THEME.textMuted,
              fontWeight: 800,
              fontSize: 12,
              fontFamily: THEME.monoFont,
            }}
          >
            01 WORKSPACE
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: phase === 2 ? THEME.neonCyan : "rgba(255,255,255,0.06)",
              color: phase === 2 ? "#000" : THEME.textMuted,
              fontWeight: 800,
              fontSize: 12,
              fontFamily: THEME.monoFont,
            }}
          >
            02 MEMOS (YJS)
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: phase === 3 ? THEME.electricIndigo : "rgba(255,255,255,0.06)",
              color: phase === 3 ? "#FFF" : THEME.textMuted,
              fontWeight: 800,
              fontSize: 12,
              fontFamily: THEME.monoFont,
            }}
          >
            03 E2EE CHAT
          </span>
        </div>

        <div style={{ fontSize: 13, color: THEME.textSecondary, fontFamily: THEME.monoFont }}>
          // PILLAR_0{phase} OF 03
        </div>
      </div>

      {/* Main Showcase Stage with Kinetic Motion */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 40,
          alignItems: "center",
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity,
        }}
      >
        {/* Left: Text & Key Feature Matrix */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {phase === 1 && (
            <>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: THEME.alderTeal,
                  letterSpacing: "2px",
                }}
              >
                工作空间与多源隔离存储
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                  letterSpacing: "-1px",
                }}
              >
                双窗口对照互拖
                <span style={{ color: THEME.alderTeal, display: "block" }}>
                  本地磁盘 + S3 空间物理隔离
                </span>
              </div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, lineHeight: 1.7 }}>
                每个空间拥有独立文件、成员、角色和存储配置。本地磁盘为默认盘，MinIO / OSS / COS 等 S3 兼容对象存储按空间物理隔离，换空间绝不串配。
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(20, 184, 166, 0.15)",
                    border: THEME.borderTeal,
                    color: "#2DD4BF",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  ⚡ 内容秒传 + Tus断点续传
                </span>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: THEME.borderGlass,
                    color: "#FFF",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  🖼️ 图片/音视频/Office免下载即时预览
                </span>
              </div>
            </>
          )}

          {phase === 2 && (
            <>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: THEME.neonCyan,
                  letterSpacing: "2px",
                }}
              >
                实时协同备忘录
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                  letterSpacing: "-1px",
                }}
              >
                Yjs 引擎 + SSE 毫秒同步
                <span style={{ color: THEME.neonCyan, display: "block" }}>
                  空间文件列并排直拖 · 引用卡片
                </span>
              </div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, lineHeight: 1.7 }}>
                左边写备忘，右边是空间共用的 fileshare 列，两边无缝直拖。插进备忘录是实时引用卡片，不占冗余副本；点击卡片直接定位原件，原件被删自动标失效！
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(0, 240, 255, 0.15)",
                    border: THEME.borderCyan,
                    color: THEME.neonCyan,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  ✨ Yjs CRDT 多人实时光标
                </span>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: THEME.borderGlass,
                    color: "#FFF",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  🛡️ 文件删除智能失效感知（无白屏死链）
                </span>
              </div>
            </>
          )}

          {phase === 3 && (
            <>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: THEME.electricIndigo,
                  letterSpacing: "2px",
                }}
              >
                全局端到端加密聊天
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                  letterSpacing: "-1px",
                }}
              >
                跨页面画中画浮窗
                <span style={{ color: THEME.electricIndigo, display: "block" }}>
                  文本端到端加密 · 密钥仅存本机
                </span>
              </div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, lineHeight: 1.7 }}>
                对话是一扇浮在任何页面上的全局窗口，文件库不用关即可把文件直接拖进会话，或把聊天文件复制回任意文件夹。单聊、群聊、引用、撤回、已读全功能完备。
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(99, 102, 241, 0.2)",
                    border: `1.5px solid ${THEME.electricIndigo}`,
                    color: "#A5B4FC",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  🔒 本地密钥加密（外网无解）
                </span>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: THEME.borderGlass,
                    color: "#FFF",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  📂 会话文件一键转存工作空间
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: High-Res Real UI Screenshot in 3D Perspective Glow Frame */}
        <div
          style={{
            flex: 1.3,
            height: 480,
            borderRadius: 20,
            overflow: "hidden",
            background: "rgba(11, 13, 19, 0.95)",
            border:
              phase === 1
                ? THEME.borderTeal
                : phase === 2
                ? THEME.borderCyan
                : `1.5px solid ${THEME.electricIndigo}`,
            boxShadow:
              phase === 1
                ? THEME.shadowLaserTeal
                : phase === 2
                ? THEME.shadowLaserCyan
                : "0 0 40px rgba(99, 102, 241, 0.5)",
            transform: "perspective(1000px) rotateY(-8deg) rotateX(4deg)",
            position: "relative",
          }}
        >
          <Img
            src={
              phase === 1
                ? staticFile("assets/files.png")
                : phase === 2
                ? staticFile("assets/board.png")
                : staticFile("assets/chat.png")
            }
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top left",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
