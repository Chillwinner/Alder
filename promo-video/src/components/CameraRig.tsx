import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface CameraRigProps {
  children: React.ReactNode;
  impactFrames?: number[];
  shakeIntensity?: number;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  impactFrames = [0, 105, 285, 495, 705, 810],
  shakeIntensity = 10,
}) => {
  const frame = useCurrentFrame();

  // Find latest impact frame
  let activeShake = 0;
  for (const impact of impactFrames) {
    if (frame >= impact && frame < impact + 20) {
      const elapsed = frame - impact;
      const decay = interpolate(elapsed, [0, 20], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      activeShake = Math.sin(elapsed * 1.6) * decay * shakeIntensity;
      break;
    }
  }

  // Flash burst on impact (1-2 frames)
  let flashOpacity = 0;
  for (const impact of impactFrames) {
    if (frame === impact || frame === impact + 1) {
      flashOpacity = frame === impact ? 0.35 : 0.15;
      break;
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${activeShake}px, ${activeShake * 0.6}px)`,
        perspective: 1200,
        transformStyle: "preserve-3d",
      }}
    >
      {children}

      {/* Screen Impact Flash */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#FFFFFF",
            opacity: flashOpacity,
            pointerEvents: "none",
            zIndex: 9999,
          }}
        />
      )}
    </div>
  );
};
