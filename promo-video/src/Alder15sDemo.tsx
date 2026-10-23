import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CameraRig } from "./components/CameraRig";
import { CyberHUD } from "./components/CyberHUD";
import { BgMesh } from "./components/motion/BgMesh";
import { Grade, Grain, Vignette } from "./components/motion/PostProcessing";
import { Scene1Hook15s } from "./scenes/Scene1Hook15s";
import { Scene2Interconnect15s } from "./scenes/Scene2Interconnect15s";
import { Scene3FullMatrix15s } from "./scenes/Scene3FullMatrix15s";
import { Scene4PayoffCTA15s } from "./scenes/Scene4PayoffCTA15s";
import { THEME } from "./theme";

export const Alder15sDemo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgPitch,
        overflow: "hidden",
      }}
    >
      {/* LAYER 1: Dynamic Background Mesh */}
      <BgMesh />

      {/* LAYER 2 & 3: 3D Camera Rig & Scenes */}
      <CameraRig impactFrames={[0, 75, 210, 285, 360, 400]} shakeIntensity={11}>
        {/* Scene 1: The Kinetic Hook (0 - 2.5s) */}
        <Sequence from={0} durationInFrames={75} name="01 Hook & Slogan">
          <Scene1Hook15s />
        </Sequence>

        {/* Scene 2: The Tripartite Drag & Drop (2.5s - 7.0s) */}
        <Sequence
          from={75}
          durationInFrames={135}
          name="02 Seamless Drag & Drop"
        >
          <Scene2Interconnect15s />
        </Sequence>

        {/* Scene 3: Full Feature Storm (7.0s - 12.0s) */}
        <Sequence
          from={210}
          durationInFrames={150}
          name="03 Full Capabilities Storm"
        >
          <Scene3FullMatrix15s />
        </Sequence>

        {/* Scene 4: Docker Architecture & Payoff (12.0s - 15.0s) */}
        <Sequence
          from={360}
          durationInFrames={90}
          name="04 Payoff & Call to Action"
        >
          <Scene4PayoffCTA15s />
        </Sequence>
      </CameraRig>

      {/* Tactical Cyber HUD Overlay */}
      <CyberHUD />

      {/* LAYER 4: Color Grade Overlay (soft-light) */}
      <Grade />

      {/* LAYER 5: Procedural Film Grain & Vignette */}
      <Grain />
      <Vignette />
    </AbsoluteFill>
  );
};
