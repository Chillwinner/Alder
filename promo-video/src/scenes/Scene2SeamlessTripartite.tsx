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
import { Cursor } from "../components/Cursor";
import { SPRING_PRESETS, THEME } from "../theme";

export const Scene2SeamlessTripartite: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance Slam
  const enterSpring = spring({
    frame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  // Exit transition (frames 165 - 180 of this 180-frame scene)
  const exitOpacity = interpolate(frame, [165, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitScale = interpolate(frame, [165, 180], [1, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- DRAG INTERACTION: From File Manager (Left) to Memo (Center) ---
  const dragStart = 25;
  const dragDrop = 80;

  const dragSpring = spring({
    frame: frame - dragStart,
    fps,
    config: SPRING_PRESETS.tactile,
  });

  const isDragging = frame >= dragStart && frame < dragDrop;
  const isDropped = frame >= dragDrop;

  // File Card coordinates
  const fileX = interpolate(dragSpring, [0, 1], [300, 880]);
  const fileY = interpolate(dragSpring, [0, 1], [400, 480]);
  const fileTilt = interpolate(dragSpring, [0, 0.5, 1], [0, -6, 0]);

  // Cursor coordinates
  let curX = 200;
  let curY = 500;
  let isGrabbing = false;
  let cursorLabel = "";

  if (frame < dragStart) {
    const p = interpolate(frame, [5, dragStart], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    curX = interpolate(p, [0, 1], [500, 310]);
    curY = interpolate(p, [0, 1], [600, 420]);
  } else if (frame < dragDrop) {
    curX = fileX + 50;
    curY = fileY + 25;
    isGrabbing = true;
    cursorLabel = "拖放生成零冗余引用卡片";
  } else {
    // Retract
    const p = interpolate(frame, [dragDrop, dragDrop + 20], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    curX = interpolate(p, [0, 1], [920, 1200]);
    curY = interpolate(p, [0, 1], [500, 750]);
  }

  // Real Drag-Drop rules ticker
  const ruleIndex = Math.min(4, Math.floor(frame / 36));
  const rules = [
    "空间文件 ➔ 备忘录：插进实时引用卡片，不另存一份",
    "空间文件 ➔ 对话：原件直接发进会话，零二次上传",
    "对话文件 ➔ 工作空间：松开鼠标一键复制落盘至指定文件夹",
    "对话文件 ➔ 备忘录：自动复制进 fileshare，再转引用卡片",
    "本机文件 ➔ 备忘录：自动上传文件列，Yjs+SSE毫秒广播",
  ];

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
      {/* Realtime Cursor */}
      <Cursor
        x={curX}
        y={curY}
        isGrabbing={isGrabbing}
        label={cursorLabel}
      />

      {/* Header Headline */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
          transform: `translateY(${interpolate(enterSpring, [0, 1], [-30, 0])}px)`,
          opacity: enterSpring,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: THEME.alderTeal,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            // CORE INTERCONNECT REVOLUTION
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: "#FFFFFF",
              letterSpacing: "-0.5px",
            }}
          >
            工作空间 · 备忘录 · 聊天 — 同一份材料的三个入口
          </div>
        </div>

        {/* Dynamic Drag Rule Matrix Pill */}
        <div
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.15)",
            border: THEME.borderTeal,
            color: "#2DD4BF",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: THEME.shadowLaserTeal,
          }}
        >
          ⚡ {rules[ruleIndex]}
        </div>
      </div>

      {/* 3D Glass Workstation Canvas with Real UI Images */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 20,
          position: "relative",
          perspective: 1400,
        }}
      >
        {/* PANEL 1: 工作空间文件库 (Real files.png) */}
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
          {/* Panel Top Bar */}
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
              📁 工作空间文件库 (本地盘 + S3隔离)
            </span>
            <span
              style={{
                fontSize: 11,
                color: THEME.alderTeal,
                background: "rgba(20, 184, 166, 0.1)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Tus 秒传
            </span>
          </div>

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Img
              src={staticFile("assets/files.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />
          </div>
        </div>

        {/* PANEL 2: 协同备忘录 (Real board.png) */}
        <div
          style={{
            flex: 1.3,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(10, 13, 20, 0.95)",
            border: isDropped ? THEME.borderTeal : THEME.borderGlassBright,
            boxShadow: isDropped ? THEME.shadowLaserTeal : THEME.shadowCard,
            transform: "perspective(1200px) translateZ(20px)",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Panel Top Bar */}
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(20, 184, 166, 0.1)",
              borderBottom: "1px solid rgba(20, 184, 166, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "#2DD4BF" }}>
              📝 协同备忘录 (Yjs + fileshare 并排互拖)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10B981",
                  boxShadow: "0 0 8px #10B981",
                }}
              />
              <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>
                实时协作中
              </span>
            </div>
          </div>

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Img
              src={staticFile("assets/board.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />

            {/* Dropped Reference Card Overlay */}
            {isDropped && (
              <div
                style={{
                  position: "absolute",
                  bottom: 24,
                  left: 20,
                  right: 20,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(11, 15, 25, 0.95)",
                  border: `1.5px solid ${THEME.alderTeal}`,
                  boxShadow: THEME.shadowLaserTeal,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📑</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>
                      已生成实时引用卡片 (零副本冗余)
                    </div>
                    <div style={{ fontSize: 11, color: "#2DD4BF" }}>
                      原件更新自动生效 · 点击直达文件所在位置
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    background: "rgba(20, 184, 166, 0.2)",
                    color: "#2DD4BF",
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 4,
                  }}
                >
                  Yjs CRDT 同步完成
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: 全局端到端加密聊天 (Real chat.png) */}
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
          {/* Panel Top Bar */}
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(255, 255, 255, 0.04)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>
              🔒 画中画端到端全局对话
            </span>
            <span
              style={{
                fontSize: 11,
                color: THEME.cyberLime,
                background: "rgba(74, 222, 128, 0.1)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              密钥存本机
            </span>
          </div>

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Img
              src={staticFile("assets/chat.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
              }}
            />
          </div>
        </div>

        {/* Ghost Flying File Card */}
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
