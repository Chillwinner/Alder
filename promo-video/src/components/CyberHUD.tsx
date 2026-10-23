import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "../theme";

export const CyberHUD: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Format real running timecode: 00:00:SS:FF
  const totalSeconds = Math.floor(frame / fps);
  const currentFrameOfSec = frame % fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timecode = `00:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(currentFrameOfSec).padStart(2, "0")}`;

  // Audio spectrum visualizer bars (simulated live telemetry)
  const barHeights = [
    interpolate(Math.sin(frame * 0.4), [-1, 1], [6, 22]),
    interpolate(Math.sin(frame * 0.6 + 1), [-1, 1], [8, 28]),
    interpolate(Math.sin(frame * 0.8 + 2), [-1, 1], [10, 24]),
    interpolate(Math.sin(frame * 0.5 + 3), [-1, 1], [6, 20]),
    interpolate(Math.sin(frame * 0.7 + 4), [-1, 1], [12, 30]),
    interpolate(Math.sin(frame * 0.9 + 5), [-1, 1], [4, 18]),
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 500,
        fontFamily: THEME.monoFont,
      }}
    >
      {/* Subtle CRT Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)",
          backgroundSize: "100% 4px",
          opacity: 0.2,
        }}
      />

      {/* Top Left Telemetry */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 40,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 11,
          letterSpacing: "1px",
          color: THEME.textSecondary,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: THEME.cyberLime,
            boxShadow: `0 0 10px ${THEME.cyberLime}`,
          }}
        />
        <span style={{ color: "#FFF", fontWeight: 700 }}>
          [ SYS: LOCAL_HOST ]
        </span>
        <span style={{ color: THEME.alderTeal }}>// ALDER WORKSTATION</span>
        <span style={{ color: THEME.textMuted }}>BETA_0.1</span>
      </div>

      {/* Top Right Audio / Frequency Spectrum */}
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 40,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 30 }}>
          {barHeights.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                background: i % 2 === 0 ? THEME.alderTeal : THEME.neonCyan,
                borderRadius: 1,
                boxShadow: `0 0 6px ${THEME.neonCyan}`,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 11, color: THEME.neonCyan, letterSpacing: "1px" }}>
          [ YJS_SSE: 0.12ms ]
        </div>
      </div>

      {/* Bottom Left Real Running Timecode */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 40,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          letterSpacing: "1.5px",
          color: THEME.textSecondary,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#EF4444",
            boxShadow: "0 0 10px #EF4444",
            opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0.3,
          }}
        />
        <span style={{ color: "#FFF", fontWeight: 700 }}>REC</span>
        <span style={{ color: THEME.neonCyan, fontWeight: 700 }}>{timecode}</span>
        <span style={{ color: THEME.textMuted }}>30FPS // 1080P</span>
      </div>

      {/* Bottom Right Encryption & Port Protocol */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          right: 40,
          fontSize: 11,
          letterSpacing: "1px",
          color: THEME.textMuted,
        }}
      >
        <span style={{ color: THEME.alderTeal }}>[ SECURE: E2EE_AES256 ]</span>{" "}
        <span style={{ color: THEME.textSecondary }}>PORT:80/8080</span>
      </div>

      {/* Outer Tactical Corner Brackets */}
      {/* Top Left */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 24,
          width: 20,
          height: 20,
          borderLeft: `2px solid ${THEME.alderTeal}`,
          borderTop: `2px solid ${THEME.alderTeal}`,
        }}
      />
      {/* Top Right */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          width: 20,
          height: 20,
          borderRight: `2px solid ${THEME.alderTeal}`,
          borderTop: `2px solid ${THEME.alderTeal}`,
        }}
      />
      {/* Bottom Left */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 24,
          width: 20,
          height: 20,
          borderLeft: `2px solid ${THEME.alderTeal}`,
          borderBottom: `2px solid ${THEME.alderTeal}`,
        }}
      />
      {/* Bottom Right */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 24,
          width: 20,
          height: 20,
          borderRight: `2px solid ${THEME.alderTeal}`,
          borderBottom: `2px solid ${THEME.alderTeal}`,
        }}
      />
    </div>
  );
};
