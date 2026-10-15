<div align="center">

<img src="docs/readme/logo.svg" width="72" alt="Alder" />

# Alder

**Local workstation · Beta v0.1**

Files, memos, and chat on one machine. Drag, and they connect.

Modified from [Free-FS](https://github.com/dromara/free-fs). [Apache License 2.0](LICENSE). Attribution is in [NOTICE](NOTICE).

[中文](README.md) · [繁體](README.zh-Hant.md) · [日本語](README.ja.md) · [Français](README.fr.md) · [Русский](README.ru.md)

</div>

Alder is a **local workstation**: one machine (or one Docker Compose) runs the whole site for an office or a home. It is not a public cloud drive. This is **Beta v0.1**; APIs and UI will still change.

The product is one idea: **workspace, memos, and chat are three doors onto the same material**. Do not download and upload again.

<div align="center">
<img src="docs/readme/interconnect.gif" width="920" alt="File library, memos, and chat" />
</div>

## Workspace

Each workspace has its own files, members, roles, and storage. Local disk is the default. Object storage (MinIO / OSS / COS and other S3-compatible stores) is scoped to that workspace; switch workspace and those mounts disappear.

Grid or list, optional dual panes. Uploads skip a file that is already stored. Local disk resumes with Tus. Images, Office, audio, and video preview in the page.

<div align="center">
<img src="docs/readme/files.gif" width="920" alt="Workspace file library" />
</div>

## Memos

Memos on the left, the shared `fileshare` column on the right. Drag between them. A workspace file in a memo is a **reference card**, not a second copy; the card opens the file where it lives. A file from the computer lands in that column first, then becomes a reference.

Collaboration uses Yjs; people online see changes over SSE. If the file is deleted later, the card is marked invalid instead of opening a blank body.

<div align="center">
<img src="docs/readme/board.gif" width="920" alt="Memos beside workspace files" />
</div>

## Chat

Chat is a window that floats on any page. Leave the library open, drag a workspace file into a conversation (the same file), or **copy** a chat file back into a folder. Drop a chat file on a memo: it is copied into `fileshare`, then inserted as a reference card.

Direct chats, groups, quote, recall, read receipts. Text is end-to-end encrypted; keys stay on the device.

<div align="center">
<img src="docs/readme/chat.gif" width="920" alt="Chat floating over the file library" />
</div>

How the three drag:

| From | Drop on | What happens |
| --- | --- | --- |
| A workspace file | A memo | A reference card; no extra copy |
| A workspace file | A chat | That existing file is sent into the conversation |
| A file in chat | The workspace | Copied into the folder under the pointer |
| A file in chat | A memo | Copied into the file column, then a reference card |
| A file on your computer | A memo | Uploaded into the file column, then placed in the memo |

## Other features

<div align="center">
<img src="docs/readme/more.gif" width="920" alt="Home, progress, meetings, notifications, collections, transfers" />
</div>

| | | |
| --- | --- | --- |
| **Home and calendar** | Categories, recent files, storage. Large date, lunar day, public holidays. Personal events are not bound to a workspace. | <img src="docs/readme/home.gif" width="280" alt="Home" /> |
| **Collections** | A link for chosen members; files land in a chosen folder. Alerts go to the header bell, not chat. | <img src="docs/readme/collections.gif" width="280" alt="Collections" /> |
| **Progress** | Normal tasks and daily check-ins. Board / list / month. Photos go to `fileshare/scale` and wait for review. | <img src="docs/readme/progress.gif" width="280" alt="Progress" /> |
| **Meetings** | Scheduled per workspace, open 15 minutes early. Whiteboard, mic, cameras, one screen share. P2P, then TURN. | <img src="docs/readme/meetings.gif" width="280" alt="Meetings" /> |
| **Notifications and votes** | Invites, collections, votes, meetings in the bell. Dismissed items stay dismissed. | <img src="docs/readme/notifications.gif" width="280" alt="Notifications" /> |
| **Transfers** | Progress, pause, resume. Same-network friends can send files on LAN without object storage. | <img src="docs/readme/transfer.gif" width="280" alt="Transfers" /> |
| **Sharing** | Link and access code. A shared file can be saved into your own workspace. | |
| **Site config** | Mail, origin, CORS, local paths, TURN in Settings. Secrets are not echoed. Export a sealed `alder-site.box`. | |

UI languages: Simplified Chinese, Traditional Chinese, English.

## Deploy (local workstation)

You need [Docker](https://docs.docker.com/get-docker/) and Docker Compose. The first build pulls JDK and Node images and takes a few minutes.

```bash
git clone <this-repo> alder && cd alder
docker compose up -d --build
```

Open **http://localhost**. The API is also at `http://localhost:8080` (docs at `/swagger-ui.html`).

Data lives in two volumes: `alder-pg` (PostgreSQL) and `alder-files` (local uploads). Stopping containers does not wipe them.

```bash
docker compose logs -f gateway
docker compose down          # stop, keep volumes
docker compose down -v       # stop and wipe database and local files
```

The default database user in Compose is `alder` / `alder`. That is only for a private LAN. Before you expose the box, change the password and JWT, and fill mail and CORS in Settings → Site config. Meetings across networks need your own TURN.

Without Docker: JDK 21, Maven, PostgreSQL, Redis, Node.js. Copy `application.example.yml` and `application-dev.example.yml` to names without `.example`. Start only `Gateway` (do not pass `-am`). Frontend `npm run dev` defaults to `http://localhost:5180`.

## License

Released under the [Apache License 2.0](LICENSE).

Alder is a derivative of [Free-FS](https://github.com/dromara/free-fs) (xddcode and the dromara community), not an official release. Upstream notices are kept as required by Apache 2.0 §4. Attribution is in [NOTICE](NOTICE).
