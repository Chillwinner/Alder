<div align="center">

<img src="docs/readme/logo.svg" width="72" alt="Alder" />

# Alder

**本機工作站 · Beta v0.1**

把檔案、備忘錄、聊天裝在同一台機器上。拖一下，就接上。

基於 [Free-FS](https://github.com/dromara/free-fs) 修改，[Apache License 2.0](LICENSE)，歸屬見 [NOTICE](NOTICE)。

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Français](README.fr.md) · [Русский](README.ru.md)

</div>

Alder 按**本地工作站**來用：一台機器（或一個 Docker Compose）跑完整站，給同一辦公室或家裏的人用。不是公有雲網盤。目前版本 **Beta v0.1**，介面和接口還會改。

主打一件事：**工作空間、備忘錄、聊天是同一份材料的三個入口**。不另開下載再上傳。

<div align="center">
<img src="docs/readme/interconnect.gif" width="920" alt="檔案庫、備忘錄、對話三個入口" />
</div>

## 工作空間

每個空間自己的檔案、成員、角色和儲存。本機磁碟是預設盤；物件儲存（MinIO / OSS / COS 等 S3 相容）按空間隔離，換空間看不到另一套設定。

網格或列表，可開雙視窗對照拖。上傳按內容秒傳，本機走 Tus 斷點續傳。圖片、Office、影音在頁裡預覽。

<div align="center">
<img src="docs/readme/files.gif" width="920" alt="工作空間檔案庫" />
</div>

## 備忘錄

左邊寫備忘錄，右邊是這個空間共用的 `fileshare` 欄。兩邊直接拖。空間裡的檔案插進備忘錄是**引用卡片**，不另存一份；點卡片回到檔案所在位置。本機檔案會先落到檔案欄再引用。

協同用 Yjs，在線的人靠 SSE 看到變化。檔案後來刪了，卡片標失效，不會打開一塊空白。

<div align="center">
<img src="docs/readme/board.gif" width="920" alt="備忘錄和空間檔案並排" />
</div>

## 聊天

對話是一扇浮在任何頁面上的窗。檔案庫不用關，就能把空間檔案拖進會話（還是那一份），或把會話裡的檔案**複製**回某個資料夾。會話檔案拖到備忘錄：先複製進 `fileshare`，再變成引用卡片。

單聊、群聊、引用、撤回、已讀。文本端到端加密，金鑰只在本機。

<div align="center">
<img src="docs/readme/chat.gif" width="920" alt="對話視窗浮在檔案庫上" />
</div>

三者怎麼拖：

| 從 | 放到 | 實際發生的事 |
| --- | --- | --- |
| 工作空間的檔案 | 備忘錄 | 插進引用卡片，不另存一份 |
| 工作空間的檔案 | 對話 | 把這份已在空間裡的檔案發進會話 |
| 對話裡的檔案 | 工作空間 | 複製到鬆開滑鼠的那個資料夾 |
| 對話裡的檔案 | 備忘錄 | 先複製進檔案欄，再變成引用卡片 |
| 電腦裡的檔案 | 備忘錄 | 上傳到檔案欄，再放進備忘錄 |

## 其他功能

<div align="center">
<img src="docs/readme/more.gif" width="920" alt="首頁、進度、開會、通知、收集、傳輸" />
</div>

| | | |
| --- | --- | --- |
| **首頁與日曆** | 分類、最近檔案、儲存動態。大日期、農曆、法定假。個人日程不綁空間。 | <img src="docs/readme/home.gif" width="280" alt="首頁" /> |
| **收集** | 連結交給指定成員，檔案落到指定資料夾。提醒走頂欄鈴鐺，不進聊天。 | <img src="docs/readme/collections.gif" width="280" alt="檔案收集" /> |
| **進度** | 普通任務和日常打卡。看板 / 列表 / 月彙總。交圖進 `fileshare/scale`，完成後待審核。 | <img src="docs/readme/progress.gif" width="280" alt="進度看板" /> |
| **開會** | 按空間預約，提前 15 分鐘開門。白板、麥克風、多路鏡頭、一人共享螢幕。P2P，不行再走 TURN。 | <img src="docs/readme/meetings.gif" width="280" alt="會議列表" /> |
| **通知與投票** | 鈴鐺裡處理邀請、收集、投票、會議。關掉的提醒不會反覆冒出來。 | <img src="docs/readme/notifications.gif" width="280" alt="通知" /> |
| **傳輸** | 上傳進度、暫停、續傳。同一網段好友也可區域網直傳，不經過物件儲存。 | <img src="docs/readme/transfer.gif" width="280" alt="傳輸列表" /> |
| **分享** | 連結和提取碼。別人分享來的檔案可以存進自己的空間。 | |
| **站點設定** | 設定裡改郵件、網域、CORS、本機路徑、TURN。金鑰不回顯。可匯出加密的 `alder-site.box`。 | |

介面語言：簡體中文、繁體中文、English。

## 部署（本機工作站）

機器上要有 [Docker](https://docs.docker.com/get-docker/) 和 Docker Compose。第一次構建要下 JDK / Node 基礎映像，會花幾分鐘。

```bash
git clone <本倉庫> alder && cd alder
docker compose up -d --build
```

打開 **http://localhost**。後端也在 `http://localhost:8080`（介面文件 `/swagger-ui.html`）。

資料落在兩個 Docker 卷裡：`alder-pg`（PostgreSQL）、`alder-files`（本機上傳目錄）。停容器不會清資料。

```bash
docker compose logs -f gateway
docker compose down          # 停，保留卷
docker compose down -v       # 停並清空資料庫和本機檔案
```

預設庫帳號是 Compose 裡的 `alder` / `alder`，只適合內網工作站。對外之前先改口令、JWT，並在設定 → 站點設定裡填郵件和 CORS。會議跨網需要自己的 TURN。

不走 Docker、本機直接跑時：JDK 21、Maven、PostgreSQL、Redis、Node.js。把 `application.example.yml`、`application-dev.example.yml` 拷成不帶 `.example` 的檔案，只啟動 `Gateway`（不要加 `-am`），前端 `npm run dev` 預設 `http://localhost:5180`。

## 授權

以 [Apache License 2.0](LICENSE) 發布。

Alder 是 [Free-FS](https://github.com/dromara/free-fs)（xddcode 與 dromara 社群）的衍生作品，不是官方發行版。按 Apache 2.0 第 4 條保留上游聲明，完整歸屬見 [NOTICE](NOTICE)。
