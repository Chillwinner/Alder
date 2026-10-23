import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { THEME } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breathing radial light positions
  const aura1X = interpolate(Math.sin(frame * 0.02), [-1, 1], [25, 35]);
  const aura1Y = interpolate(Math.cos(frame * 0.025), [-1, 1], [20, 30]);

  const aura2X = interpolate(Math.cos(frame * 0.018), [-1, 1], [70, 80]);
  const aura2Y = interpolate(Math.sin(frame * 0.022), [-1, 1], [65, 75]);

  const gridOffset = (frame * 0.4) % 40;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: THEME.bgDeep,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Dynamic Cyber Grid */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          backgroundPosition: `0px ${gridOffset}px`,
          transform: "perspective(1000px) rotateX(25deg)",
          transformOrigin: "center 10%",
          opacity: 0.7,
        }}
      />

      {/* Primary Teal Aurora */}
      <div
        style={{
          position: "absolute",
          left: `${aura1X}%`,
          top: `${aura1Y}%`,
          width: 800,
          height: 800,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />

      {/* Electric Indigo & Violet Aurora */}
      <div
        style={{
          position: "absolute",
          left: `${aura2X}%`,
          top: `${aura2Y}%`,
          width: 900,
          height: 900,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.07) 50%, transparent 70%)`,
          filter: "blur(90px)",
        }}
      />

      {/* Vignette Rim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(11, 13, 19, 0.85) 100%)",
        }}
      />
    </div>
  );
};
