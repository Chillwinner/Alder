import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Background } from "./components/Background";
import { CameraRig } from "./components/CameraRig";
import { CyberHUD } from "./components/CyberHUD";
import { Scene1SlamHook } from "./scenes/Scene1SlamHook";
import { Scene2SeamlessTripartite } from "./scenes/Scene2SeamlessTripartite";
import { Scene3CoreTrio } from "./scenes/Scene3CoreTrio";
import { Scene4AllOtherFeatures } from "./scenes/Scene4AllOtherFeatures";
import { Scene5DockerSovereignty } from "./scenes/Scene5DockerSovereignty";
import { Scene6RadicalOutro } from "./scenes/Scene6RadicalOutro";
import { THEME } from "./theme";

export const AlderPromoVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgPitch,
        overflow: "hidden",
      }}
    >
      {/* Dynamic Impact Camera Rig (Shake + Flash) */}
      <CameraRig impactFrames={[0, 105, 285, 495, 705, 810]}>
        {/* Background Atmosphere */}
        <Background />

        {/* Scene 1: Kinetic Slam Hook (0 - 3.5s) */}
        <Sequence from={0} durationInFrames={105} name="01 Hook & Problem">
          <Scene1SlamHook />
        </Sequence>

        {/* Scene 2: 3D Tripartite Drag & Drop (3.5s - 9.5s) */}
        <Sequence
          from={105}
          durationInFrames={180}
          name="02 Seamless Drag & Drop"
        >
          <Scene2SeamlessTripartite />
        </Sequence>

        {/* Scene 3: Core Pillars Trio (9.5s - 16.5s) */}
        <Sequence
          from={285}
          durationInFrames={210}
          name="03 Workspace, Memos, Chat"
        >
          <Scene3CoreTrio />
        </Sequence>

        {/* Scene 4: All Other 6 Core Features (16.5s - 23.5s) */}
        <Sequence
          from={495}
          durationInFrames={210}
          name="04 Tasks, Meetings, LanTransfer, Collections"
        >
          <Scene4AllOtherFeatures />
        </Sequence>

        {/* Scene 5: Docker & Single Machine Sovereignty (23.5s - 27.0s) */}
        <Sequence
          from={705}
          durationInFrames={105}
          name="05 Single Machine Docker Sovereignty"
        >
          <Scene5DockerSovereignty />
        </Sequence>

        {/* Scene 6: Radical Outro & Climax (27.0s - 30.0s) */}
        <Sequence
          from={810}
          durationInFrames={90}
          name="06 Climax & Call to Action"
        >
          <Scene6RadicalOutro />
        </Sequence>
      </CameraRig>

      {/* Aggressive Cyber HUD Overlay (Timecode, Spectrum, Telemetry, Scanlines) */}
      <CyberHUD />
    </AbsoluteFill>
  );
};
