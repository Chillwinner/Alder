import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SPRING_PRESETS, THEME } from "../theme";

interface MiniFeatureCardProps {
  imageSrc: string;
  badge: string;
  badgeColor: string;
  title: string;
  desc: string;
  tags: string[];
  delay: number;
}

const MiniFeatureCard: React.FC<MiniFeatureCardProps> = ({
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
  const translateY = interpolate(cardSpring, [0, 1], [50, 0]);
  const opacity = interpolate(cardSpring, [0, 0.3], [0, 1]);

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 16,
        background: "rgba(10, 13, 22, 0.9)",
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
      {/* Real Screenshot Preview */}
      <div style={{ height: 180, width: "100%", position: "relative", overflow: "hidden" }}>
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top left",
          }}
        />
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

      {/* Content */}
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

export const Scene4AllOtherFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase A (0 - 105 frames): Tasks, Meetings, LanTransfer
  // Phase B (105 - 210 frames): Collections, Home/Calendar, Notifications/Config/Backup
  const isPhaseA = frame < 105;
  const phaseFrame = isPhaseA ? frame : frame - 105;

  const titleSpring = spring({
    frame: phaseFrame,
    fps,
    config: SPRING_PRESETS.slam,
  });

  const exitOpacity = interpolate(frame, [195, 210], [1, 0], {
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
          transform: `translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
          opacity: interpolate(titleSpring, [0, 0.4], [0, 1]),
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isPhaseA ? THEME.cyberLime : THEME.hyperOrange,
              letterSpacing: "2px",
              fontFamily: THEME.monoFont,
              marginBottom: 4,
            }}
          >
            {isPhaseA
              ? "// FULL WORKSTATION CAPABILITIES · BATCH 01"
              : "// FULL WORKSTATION CAPABILITIES · BATCH 02"}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#FFFFFF" }}>
            {isPhaseA
              ? "敏捷进度看板 · 空间音视频会议 · 局域网免网盘直传"
              : "外链定向收集 · 独立日历日程 · 通知投票与加密灾备"}
          </div>
        </div>

        <div style={{ fontSize: 13, color: THEME.textMuted, fontFamily: THEME.monoFont }}>
          {isPhaseA ? "[ MODULES: 04 - 06 / 09 ]" : "[ MODULES: 07 - 09 / 09 ]"}
        </div>
      </div>

      {/* Cards Display Grid (3 cards per phase) */}
      <div style={{ flex: 1, display: "flex", gap: 20 }}>
        {isPhaseA ? (
          <>
            <MiniFeatureCard
              imageSrc="assets/progress.png"
              badge="MODULE 04 // 进度与打卡"
              badgeColor={THEME.cyberLime}
              title="敏捷看板与日常打卡"
              desc="看板 / 列表 / 月汇总三视图，日常打卡与任务交图自动归入 fileshare/scale，完成即可进入审核闭环。"
              tags={["看板/列表/月汇总", "打卡交图", "待审核闭环"]}
              delay={2}
            />
            <MiniFeatureCard
              imageSrc="assets/meetings.png"
              badge="MODULE 05 // 空间会议"
              badgeColor={THEME.violetAura}
              title="空间预约会议与协作白板"
              desc="空间预约提前 15 分钟开门，多人实时白板协作、麦克风、多路摄像头与一人屏幕共享。P2P 直连，弱网自动走 TURN。"
              tags={["提前15分钟开门", "多人白板", "屏幕共享", "P2P+TURN"]}
              delay={8}
            />
            <MiniFeatureCard
              imageSrc="assets/transfer.png"
              badge="MODULE 06 // 局域网直传"
              badgeColor={THEME.neonCyan}
              title="LanTransfer 局域网直传"
              desc="同一网段好友跨设备免公网极速直传，不经过对象存储与外网中转；支持任务暂停、续传与秒级吞吐。"
              tags={["免公网中转", "断点续传", "极速千兆吞吐"]}
              delay={14}
            />
          </>
        ) : (
          <>
            <MiniFeatureCard
              imageSrc="assets/collections.png"
              badge="MODULE 07 // 文件收集"
              badgeColor={THEME.hyperOrange}
              title="外链定向文件收集"
              desc="专属收集链接分发给指定成员，文件自动精准落盘到目标空间文件夹；提醒由顶栏铃铛静默接收，不干扰聊天。"
              tags={["外链上传", "定向落盘指定文件夹", "铃铛静默通知"]}
              delay={2}
            />
            <MiniFeatureCard
              imageSrc="assets/home.png"
              badge="MODULE 08 // 首页与日历"
              badgeColor={THEME.alderTeal}
              title="首页看板与独立日历"
              desc="文件分类导航、最近文件流与存储容量动态。大日期、农历与法定节假日，个人日程完全独立不绑特定空间。"
              tags={["最近文件流", "农历与节假日", "个人独立日程"]}
              delay={8}
            />
            <MiniFeatureCard
              imageSrc="assets/notifications.png"
              badge="MODULE 09 // 通知/安全/灾备"
              badgeColor="#38BDF8"
              title="通知中心 · 安全分享 · 灾备导出"
              desc="铃铛处理邀请/收集/投票；外链与提取码分享（一键转存）；设置改邮件/域名/TURN；一键导出加密备份 alder-site.box；多语言支持！"
              tags={["提取码分享转存", "导出alder-site.box", "中/英/繁多语言"]}
              delay={14}
            />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
