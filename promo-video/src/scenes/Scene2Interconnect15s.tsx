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
import { Cursor } from "../components/Cursor";
import { KenBurns } from "../components/motion/KenBurns";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene2Interconnect15s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance Slam
  const enterSpring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  // Exit transition (faster than entrance, last 12 frames)
  const exitOpacity = interpolate(frame, [123, 135], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = interpolate(frame, [123, 135], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Drag interaction timeline (frames 15 to 65)
  const dragStart = 15;
  const dragDrop = 55;

  const dragSpring = spring({
    frame: frame - dragStart,
    fps,
    config: SPRING_PRESETS.tactile,
  });

  const isDragging = frame >= dragStart && frame < dragDrop;
  const isDropped = frame >= dragDrop;

  // File coordinates: from Left File Panel (300, 380) to Center Memo (860, 480)
  const fileX = interpolate(dragSpring, [0, 1], [300, 860]);
  const fileY = interpolate(dragSpring, [0, 1], [380, 480]);
  const fileTilt = interpolate(dragSpring, [0, 0.5, 1], [0, -6, 0]);

  // Cursor coordinates
  let curX = 180;
  let curY = 500;
  let isGrabbing = false;
  let cursorLabel = "";

  if (frame < dragStart) {
    const p = interpolate(frame, [0, dragStart], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    curX = interpolate(p, [0, 1], [400, 310]);
    curY = interpolate(p, [0, 1], [580, 400]);
  } else if (frame < dragDrop) {
    curX = fileX + 45;
    curY = fileY + 20;
    isGrabbing = true;
    cursorLabel = "拖入备忘录生成引用卡片";
  } else {
    const p = interpolate(frame, [dragDrop, dragDrop + 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    curX = interpolate(p, [0, 1], [905, 1150]);
    curY = interpolate(p, [0, 1], [500, 750]);
  }

  // Drop ripple
  const dropRipple = spring({
    frame: frame - dragDrop,
    fps,
    config: { damping: 10, mass: 0.4, stiffness: 220 },
  });

  // Dynamic Rule ticker based on progress
  const rules = [
    "空间文件 ➔ 备忘录：插进实时引用卡片，不另存一份",
    "空间文件 ➔ 对话：原件直接发进会话，免重复下载",
    "对话文件 ➔ 工作空间：松开鼠标自动复制落盘",
    "对话文件 ➔ 备忘录：先复制进 fileshare，再转引用卡片",
  ];
  const activeRuleIndex = Math.min(3, Math.floor(frame / 34));

  return (
    <AbsoluteFill
      style={{
        fontFamily: THEME.fontFamily,
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
        padding: "30px 50px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* SFX: Whoosh at drag start, Pop on drop */}
      {frame >= dragStart && frame < dragStart + 3 && (
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.4} />
      )}
      {frame >= dragDrop && frame < dragDrop + 3 && (
        <Audio src={staticFile("sfx/pop.wav")} volume={0.7} />
      )}

      {/* Realtime Cursor */}
      <Cursor x={curX} y={curY} isGrabbing={isGrabbing} label={cursorLabel} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
          transform: `translateY(${interpolate(enterSpring, [0, 1], [-25, 0])}px)`,
          opacity: enterSpring,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: THEME.alderTeal,
              letterSpacing: "2px",
              fontFamily: THEME.monoFont,
              marginBottom: 4,
            }}
          >
            // CORE INTERACTION // TRIPLE PORTALS
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#FFFFFF" }}>
            同一份材料的三个入口 · 拖一下，就接上
          </div>
        </div>

        {/* Dynamic Rule Pill */}
        <div
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.15)",
            border: THEME.borderTeal,
            color: "#2DD4BF",
            fontSize: 13,
            fontWeight: 800,
            boxShadow: THEME.shadowLaserTeal,
          }}
        >
          ⚡ {rules[activeRuleIndex]}
        </div>
      </div>

      {/* 3-Column Glass Canvas with Real Screenshots */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 20,
          position: "relative",
          perspective: 1400,
        }}
      >
        {/* Left: 工作空间文件库 */}
        <div
          style={{
            flex: 1,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(10, 13, 20, 0.9)",
            border: isDragging ? THEME.borderCyan : THEME.borderGlass,
            boxShadow: THEME.shadowCard,
            transform: "perspective(1200px) rotateY(4deg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: 12,
              fontWeight: 700,
              color: "#FFF",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>📁 空间文件库 (Fileshare)</span>
            <span style={{ color: THEME.alderTeal }}>Tus 秒传</span>
          </div>
          <div style={{ flex: 1 }}>
            <KenBurns src="assets/files.png" zoomTo={1.06} panX={-15} />
          </div>
        </div>

        {/* Center: 协同备忘录 */}
        <div
          style={{
            flex: 1.3,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(10, 13, 20, 0.95)",
            border: isDropped ? THEME.borderTeal : THEME.borderGlassBright,
            boxShadow: isDropped ? THEME.shadowLaserTeal : THEME.shadowCard,
            transform: "perspective(1200px) translateZ(15px)",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(20, 184, 166, 0.12)",
              borderBottom: "1px solid rgba(20, 184, 166, 0.2)",
              fontSize: 12,
              fontWeight: 800,
              color: "#2DD4BF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>📝 协同备忘录 (Yjs 引擎 + SSE 同步)</span>
            <span style={{ color: "#10B981", fontSize: 11, fontWeight: 700 }}>
              ● 毫秒级多端感知
            </span>
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <KenBurns src="assets/board.png" zoomTo={1.05} panX={10} />

            {/* Dropped Reference Card Badge */}
            {isDropped && (
              <div
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: 20,
                  right: 20,
                  padding: "12px 18px",
                  borderRadius: 10,
                  background: "rgba(10, 14, 25, 0.95)",
                  border: `1.5px solid ${THEME.alderTeal}`,
                  boxShadow: THEME.shadowLaserTeal,
                  transform: `scale(${dropRipple})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📑</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>
                      已生成无副本引用卡片
                    </div>
                    <div style={{ fontSize: 11, color: "#2DD4BF" }}>
                      原件更新自动同步 · 点击卡片直达文件所在位置
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    background: "rgba(20, 184, 166, 0.2)",
                    color: "#2DD4BF",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  Yjs CRDT 零冗余
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: 全局画中画加密聊天 */}
        <div
          style={{
            flex: 0.9,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(10, 13, 20, 0.9)",
            border: THEME.borderGlass,
            boxShadow: THEME.shadowCard,
            transform: "perspective(1200px) rotateY(-4deg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: 12,
              fontWeight: 700,
              color: "#FFF",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>🔒 画中画端到端全局对话</span>
            <span style={{ color: THEME.cyberLime }}>密钥存本机</span>
          </div>
          <div style={{ flex: 1 }}>
            <KenBurns src="assets/chat.png" zoomTo={1.06} panX={-10} />
          </div>
        </div>

        {/* Dragging Card Ghost */}
        {isDragging && (
          <div
            style={{
              position: "absolute",
              left: fileX,
              top: fileY,
              padding: "12px 18px",
              borderRadius: 10,
              background: "rgba(15, 23, 42, 0.95)",
              border: `1.5px solid ${THEME.neonCyan}`,
              boxShadow: THEME.shadowLaserCyan,
              transform: `rotate(${fileTilt}deg) scale(1.08)`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "none",
              zIndex: 999,
            }}
          >
            <span style={{ fontSize: 18 }}>📄</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>
              架构说明书.pdf
            </span>
            <span
              style={{
                fontSize: 10,
                background: THEME.neonCyan,
                color: "#05070B",
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              无感引用中
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
