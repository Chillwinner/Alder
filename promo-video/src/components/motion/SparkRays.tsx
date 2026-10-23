import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "../../theme";

interface SparkRaysProps {
  size?: number;
  delay?: number;
  color?: string;
}

export const SparkRays: React.FC<SparkRaysProps> = ({
  size = 200,
  delay = 0,
  color = THEME.alderTeal,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rays = 12;

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: rays }).map((_, i) => {
        const p = spring({
          frame: frame - delay - i * 1.5,
          fps,
          config: { damping: 12, mass: 0.4, stiffness: 220 },
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size * 0.03,
              height: size * 0.35 * p,
              background: `linear-gradient(to top, ${color}, transparent)`,
              borderRadius: 4,
              transformOrigin: "50% 0%",
              transform: `translateX(-50%) rotate(${(360 / rays) * i}deg) translateY(${size * 0.28}px)`,
              opacity: p,
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        );
      })}
    </div>
  );
};
