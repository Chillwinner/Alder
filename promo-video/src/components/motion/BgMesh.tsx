import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { THEME } from "../../theme";

export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 45) * 60;
  const d2 = Math.cos(frame / 55) * 50;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgPitch, overflow: "hidden" }}>
      {/* Dynamic Cyber Grid */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          transform: "perspective(1000px) rotateX(20deg)",
          transformOrigin: "center 20%",
          opacity: 0.6,
        }}
      />

      {/* Blob 1: Alder Teal Aurora */}
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          top: -300,
          left: -200 + d1,
          filter: "blur(90px)",
          background: `radial-gradient(circle, rgba(20, 184, 166, 0.22), transparent 65%)`,
        }}
      />

      {/* Blob 2: Neon Cyan Pulse */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          bottom: -250,
          right: -150 - d2,
          filter: "blur(80px)",
          background: `radial-gradient(circle, rgba(0, 240, 255, 0.16), transparent 65%)`,
        }}
      />

      {/* Blob 3: Electric Indigo Center Aura */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(100px)",
          background: `radial-gradient(circle, rgba(99, 102, 241, 0.14), transparent 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};
