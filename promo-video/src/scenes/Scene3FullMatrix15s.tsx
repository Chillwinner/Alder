import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KenBurns } from "../components/motion/KenBurns";
import { SPRING_PRESETS, THEME } from "../theme";

interface FeatureCard15sProps {
  imageSrc: string;
  badge: string;
  badgeColor: string;
  title: string;
  desc: string;
  tags: string[];
  delay: number;
}

const FeatureCard15s: React.FC<FeatureCard15sProps> = ({
  imageSrc,
  badge,
  badgeColor,
  title,
  desc,
  tags,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const scale = interpolate(cardSpring, [0, 1], [0.85, 1]);
  const translateY = interpolate(cardSpring, [0, 1], [40, 0]);
  const opacity = interpolate(cardSpring, [0, 0.3], [0, 1]);

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 16,
        background: "rgba(10, 13, 22, 0.92)",
        border: THEME.borderGlass,
        backdropFilter: "blur(20px)",
        boxShadow: THEME.shadowCard,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div style={{ height: 180, width: "100%", position: "relative", overflow: "hidden" }}>
        <KenBurns src={imageSrc} zoomTo={1.08} panX={-15} />
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            padding: "3px 8px",
            borderRadius: 6,
            background: "rgba(0, 0, 0, 0.8)",
            border: `1px solid ${badgeColor}`,
            color: badgeColor,
            fontSize: 11,
            fontWeight: 800,
            fontFamily: THEME.monoFont,
          }}
        >
          {badge}
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF" }}>{title}</div>
        <div style={{ fontSize: 12, color: THEME.textSecondary, lineHeight: 1.5 }}>{desc}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
          {tags.map((t, idx) => (
            <span
              key={idx}
              style={{
                fontSize: 10,
                color: "#FFFFFF",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Scene3FullMatrix15s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0 - 75 frames): Core Storage, Memos, Chat
  // Phase 2 (75 - 150 frames): Tasks, Meetings, LanTransfer, Collections, Backup
  const isPhase1 = frame < 75;
  const phaseFrame = isPhase1 ? frame : frame - 75;

  const titleSpring = spring({
    frame: phaseFrame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const exitOpacity = interpolate(frame, [138, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: THEME.fontFamily,
        opacity: exitOpacity,
        padding: "30px 50px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* SFX: Hit on phase changes */}
      {frame === 0 && <Audio src={staticFile("sfx/hit.wav")} volume={0.6} />}
      {frame === 75 && <Audio src={staticFile("sfx/hit.wav")} volume={0.6} />}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
          transform: `translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
          opacity: interpolate(titleSpring, [0, 0.3], [0, 1]),
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isPhase1 ? THEME.alderTeal : THEME.cyberLime,
              letterSpacing: "2px",
              fontFamily: THEME.monoFont,
              marginBottom: 4,
            }}
          >
            {isPhase1 ? "// ALL CAPABILITIES // PART 01" : "// ALL CAPABILITIES // PART 02"}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#FFFFFF" }}>
            {isPhase1
              ? "本地+S3多源存储 · Yjs协同备忘录 · 全局端到端加密"
              : "敏捷进度看板 · 空间音视频会议 · 局域网极速直传与收集"}
          </div>
        </div>

        <div style={{ fontSize: 13, color: THEME.textMuted, fontFamily: THEME.monoFont }}>
          {isPhase1 ? "[ CORE PILLARS 01 - 03 ]" : "[ EXTENSIONS 04 - 09 ]"}
        </div>
      </div>

      {/* Grid of 3 Cards */}
      <div style={{ flex: 1, display: "flex", gap: 20 }}>
        {isPhase1 ? (
          <>
            <FeatureCard15s
              imageSrc="assets/files.png"
              badge="01 // 空间存储"
              badgeColor={THEME.alderTeal}
              title="本地与对象存储隔离"
              desc="本地磁盘默认盘 + S3 (MinIO/OSS/COS) 空间物理隔离。双窗口对照互拖，Tus 断点续传，图片音视频在线预览。"
              tags={["本地默认盘", "S3兼容隔离", "双窗互拖", "在线预览"]}
              delay={2}
            />
            <FeatureCard15s
              imageSrc="assets/board.png"
              badge="02 // 协同备忘"
              badgeColor={THEME.neonCyan}
              title="Yjs 毫秒协同备忘录"
              desc="左边写备忘，右边共用 fileshare 列并排互拖。插进引用卡片零冗余副本，文件删除智能失效感知防白屏。"
              tags={["Yjs CRDT", "SSE 实时广播", "引用卡片", "失效预警"]}
              delay={8}
            />
            <FeatureCard15s
              imageSrc="assets/chat.png"
              badge="03 // 加密会话"
              badgeColor={THEME.electricIndigo}
              title="画中画端到端全局对话"
              desc="浮在任何页面上的画中画窗，文件直接拖拽入聊。文本端到端加密（密钥只存本机），单聊群聊引用撤回已读。"
              tags={["密钥仅留本机", "全局悬浮窗", "单聊群聊", "一拖入聊"]}
              delay={14}
            />
          </>
        ) : (
          <>
            <FeatureCard15s
              imageSrc="assets/progress.png"
              badge="04 // 进度打卡"
              badgeColor={THEME.cyberLime}
              title="敏捷看板与日常打卡"
              desc="看板 / 列表 / 月汇总三视图，日常打卡交图自动入 fileshare/scale，完成即进入审核闭环。"
              tags={["看板/列表/汇总", "打卡交图", "审核流闭环"]}
              delay={2}
            />
            <FeatureCard15s
              imageSrc="assets/meetings.png"
              badge="05 // 空间会议"
              badgeColor={THEME.violetAura}
              title="空间专属会议与协作白板"
              desc="提前 15 分钟准入开门。多人实时白板协作、多路麦克风与摄像头、屏幕共享，P2P 直连 + TURN 保障。"
              tags={["提前15分准入", "多人白板", "屏幕共享", "P2P直连"]}
              delay={8}
            />
            <FeatureCard15s
              imageSrc="assets/transfer.png"
              badge="06 // 直传收集"
              badgeColor={THEME.hyperOrange}
              title="LanTransfer 直传与外链收集"
              desc="同网段免外网极速直传；外链定向收集文件精准落盘目标文件夹；铃铛通知统一处理；导出加密备份 alder-site.box！"
              tags={["LanTransfer直传", "外链定向收集", "导出alder-site.box"]}
              delay={14}
            />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
