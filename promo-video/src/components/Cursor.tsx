import React from "react";
import { THEME } from "../theme";

interface CursorProps {
  x: number;
  y: number;
  isGrabbing?: boolean;
  label?: string;
  glow?: boolean;
}

export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  isGrabbing = false,
  label,
  glow = true,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-3px, -2px)",
        pointerEvents: "none",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      {/* Pointer Graphic */}
      <div style={{ position: "relative" }}>
        {glow && (
          <div
            style={{
              position: "absolute",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: THEME.neonCyan,
              opacity: isGrabbing ? 0.7 : 0.4,
              filter: "blur(10px)",
              transform: "translate(-4px, -4px)",
            }}
          />
        )}

        {isGrabbing ? (
          // Grabbing Hand
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
            }}
          >
            <path
              d="M8 11V7a2 2 0 1 1 4 0v4m0-3a2 2 0 1 1 4 0v4m0-2a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-4a2 2 0 1 1 4 0v1"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(11, 13, 19, 0.85)"
            />
          </svg>
        ) : (
          // Tech Arrow Pointer
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              filter: "drop-shadow(0 4px 12px rgba(56, 189, 248, 0.5))",
            }}
          >
            <path
              d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Floating Action Tag */}
      {label && (
        <div
          style={{
            padding: "4px 10px",
            background: "rgba(11, 13, 19, 0.9)",
            border: `1px solid ${THEME.neonCyan}`,
            borderRadius: 8,
            boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
            fontSize: 12,
            fontWeight: 600,
            color: "#F8FAFC",
            whiteSpace: "nowrap",
            backdropFilter: "blur(12px)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
