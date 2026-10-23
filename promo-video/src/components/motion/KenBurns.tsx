import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

interface KenBurnsProps {
  src: string;
  zoomTo?: number;
  panX?: number;
  style?: React.CSSProperties;
}

export const KenBurns: React.FC<KenBurnsProps> = ({
  src,
  zoomTo = 1.08,
  panX = -20,
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pan = interpolate(frame, [0, durationInFrames], [0, panX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top left",
          transform: `scale(${scale}) translateX(${pan}px)`,
        }}
      />
    </div>
  );
};
