<div align="center">

<img src="docs/readme/logo.svg" width="72" alt="Alder" />

# Alder

**本机工作站 · Beta v0.1**

把文件、备忘录、聊天装在同一台机器上。拖一下，就接上。

基于 [Free-FS](https://github.com/dromara/free-fs) 修改，[Apache License 2.0](LICENSE)，归属见 [NOTICE](NOTICE)。

[English](README.md) · [中文](README.zh.md) · [繁體](README.zh-Hant.md) · [日本語](README.ja.md) · [Français](README.fr.md) · [Русский](README.ru.md)

</div>

Alder 按**本地工作站**来用：一台机器（或一个 Docker Compose）跑完整站，给同一办公室或家里的人用。不是公有云网盘。当前版本 **Beta v0.1**，接口和界面还会改。

主打一件事：**工作空间、备忘录、聊天是同一份材料的三个入口**。不另开下载再上传。

<div align="center">
<img src="docs/readme/interconnect.gif" width="920" alt="文件库、备忘录、对话三个入口轮流出现" />
</div>

## 工作空间

每个空间自己的文件、成员、角色和存储。本地磁盘是默认盘；对象存储（MinIO / OSS / COS 等 S3 兼容）按空间隔离，换空间看不到另一套配置。

网格或列表，可开双窗口对照拖。上传按内容秒传，本地走 Tus 断点续传。图片、Office、音视频在页里预览。

<div align="center">
<img src="docs/readme/files.gif" width="920" alt="工作空间文件库：本地与对象存储分开" />
</div>

## 备忘录

左边写备忘录，右边是这个空间共用的 `fileshare` 列。两边直接拖。空间里的文件插进备忘录是**引用卡片**，不另存一份；点卡片回到文件所在位置。本机文件会先落到文件列再引用。

协同用 Yjs，在线的人靠 SSE 看到变化。文件后来删了，卡片标失效，不会打开一块空白。

<div align="center">
<img src="docs/readme/board.gif" width="920" alt="备忘录和空间文件并排，可互拖" />
</div>

## 聊天

对话是一扇浮在任何页面上的窗。文件库不用关，就能把空间文件拖进会话（还是那一份），或把会话里的文件**复制**回某个文件夹。会话文件拖到备忘录：先复制进 `fileshare`，再变成引用卡片。

单聊、群聊、引用、撤回、已读。文本端到端加密，密钥只在本机。

<div align="center">
<img src="docs/readme/chat.gif" width="920" alt="对话窗口浮在文件库上" />
</div>

三者怎么拖：

| 从 | 放到 | 实际发生的事 |
| --- | --- | --- |
| 工作空间的文件 | 备忘录 | 插进引用卡片，不另存一份 |
| 工作空间的文件 | 对话 | 把这份已在空间里的文件发进会话 |
| 对话里的文件 | 工作空间 | 复制到松开鼠标的那个文件夹 |
| 对话里的文件 | 备忘录 | 先复制进文件列，再变成引用卡片 |
| 电脑里的文件 | 备忘录 | 上传到文件列，再放进备忘录 |

## 其他功能

<div align="center">
<img src="docs/readme/more.gif" width="920" alt="首页、进度、开会、通知、收集、传输" />
</div>

| | | |
| --- | --- | --- |
| **首页与日历** | 分类、最近文件、存储动态。大日期、农历、法定假。个人日程不绑空间。 | <img src="docs/readme/home.gif" width="280" alt="首页" /> |
| **收集** | 链接交给指定成员，文件落到指定文件夹。提醒走顶栏铃铛，不进聊天。 | <img src="docs/readme/collections.gif" width="280" alt="文件收集" /> |
| **进度** | 普通任务和日常打卡。看板 / 列表 / 月汇总。交图进 `fileshare/scale`，完成后待审核。 | <img src="docs/readme/progress.gif" width="280" alt="进度看板" /> |
| **开会** | 按空间预约，提前 15 分钟开门。白板、麦克风、多路摄像头、一人共享屏幕。P2P，不行再走 TURN。 | <img src="docs/readme/meetings.gif" width="280" alt="会议列表" /> |
| **通知与投票** | 铃铛里处理邀请、收集、投票、会议。关掉的提醒不会反复冒出来。 | <img src="docs/readme/notifications.gif" width="280" alt="通知" /> |
| **传输** | 上传进度、暂停、续传。同一网段好友也可局域网直传，不经过对象存储。 | <img src="docs/readme/transfer.gif" width="280" alt="传输列表" /> |
| **分享** | 链接和提取码。别人分享来的文件可以存进自己的空间。 | |
| **站点配置** | 设置里改邮件、域名、CORS、本机路径、TURN。密钥不回显。可导出加密的 `alder-site.box`。 | |

界面语言：English、简体中文、繁體中文。

## 部署（本机工作站）

机器上要有 [Docker](https://docs.docker.com/get-docker/) 和 Docker Compose。第一次构建要下 JDK / Node 基础镜像，会花几分钟。

```bash
git clone <本仓库> alder && cd alder
docker compose up -d --build
```

打开 **http://localhost**。后端也在 `http://localhost:8080`（接口文档 `/swagger-ui.html`）。

数据落在两个 Docker 卷里：`alder-pg`（PostgreSQL）、`alder-files`（本地上传目录）。停容器不会清数据。

```bash
docker compose logs -f gateway
docker compose down          # 停，保留卷
docker compose down -v       # 停并清空数据库和本地文件
```

默认库账号是 Compose 里的 `alder` / `alder`，只适合内网工作站。对外之前先改口令、JWT，并在设置 → 站点配置里填邮件和 CORS。会议跨网需要自己的 TURN。

不走 Docker、本机直接跑时：JDK 21、Maven、PostgreSQL、Redis、Node.js。把 `application.example.yml`、`application-dev.example.yml` 拷成不带 `.example` 的文件，只启动 `Gateway`（不要加 `-am`），前端 `npm run dev` 默认 `http://localhost:5180`。

## 许可证

以 [Apache License 2.0](LICENSE) 发布。

Alder 是 [Free-FS](https://github.com/dromara/free-fs)（xddcode 与 dromara 社区）的衍生作品，不是官方发行版。按 Apache 2.0 第 4 条保留上游声明，完整归属见 [NOTICE](NOTICE)。
