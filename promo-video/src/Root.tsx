import React from "react";
import { Composition } from "remotion";
import { Alder15sDemo } from "./Alder15sDemo";
import { AlderPromoVideo } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 15-Second Motion Graphics Video */}
      <Composition
        id="Alder15sDemo"
        component={Alder15sDemo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 30-Second Full Teaser Video */}
      <Composition
        id="AlderPromo"
        component={AlderPromoVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
