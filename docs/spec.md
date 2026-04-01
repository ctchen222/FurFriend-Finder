# FurFriend Finder — 完整系統規格文件

> 版本：1.0 | 更新日期：2026-03-29

---

## 目錄

1. [系統概觀](#1-系統概觀)
2. [功能規格](#2-功能規格)
3. [頁面與 UI 規格](#3-頁面與-ui-規格)
4. [API 規格](#4-api-規格)
5. [資料庫規格](#5-資料庫規格)
6. [外部服務整合](#6-外部服務整合)
7. [認證與授權](#7-認證與授權)
8. [後台排程任務](#8-後台排程任務)
9. [部署架構](#9-部署架構)
10. [環境變數清單](#10-環境變數清單)
11. [測試規格](#11-測試規格)
12. [已知限制與待辦事項](#12-已知限制與待辦事項)

---

## 1. 系統概觀

### 1.1 專案目標

FurFriend Finder 是一個台灣流浪動物領養通知平台。台灣每年有大量的走失、遺棄動物進入收容所，飼主難以即時找到走失寵物。本系統透過以下方式協助飼主：

1. 每日自動同步農業部開放資料（收容所動物 + 遺失動物登記資料）
2. 飼主登記走失寵物後，系統自動比對最近的潛在配對，並以 Email 通知
3. 提供 LINE Bot 介面，讓使用者以聊天方式瀏覽收容所動物

### 1.2 技術棧摘要

| 層級         | 技術                                          |
| ------------ | --------------------------------------------- |
| 後端框架     | Node.js + Express + TypeScript                |
| 模板引擎     | EJS（伺服器端渲染，無獨立前端框架）           |
| 資料庫       | PostgreSQL（pg 連線池）                       |
| 認證         | better-auth（Email/Password + session）       |
| Email 通知   | Nodemailer + Brevo SMTP + Mustache 模板       |
| LINE 整合    | @line/bot-sdk + messaging-api-line            |
| 地理計算     | Google Maps Geocoding API + geolib            |
| 排程         | node-cron（每日 00:00 台北時間）              |
| 資料驗證     | Zod                                           |
| 測試         | Jest（單元/整合）+ Playwright（E2E）          |
| 部署         | Docker + Docker Compose + Nginx（負載均衡）   |

### 1.3 專案目錄結構

```
FurFriend-Finder/
├── src/
│   ├── app.ts                  # Express 主入口，middleware 設定，cron 啟動
│   ├── auth.ts                 # Better Auth 初始化設定
│   ├── Controller/             # 請求處理器（業務邏輯入口）
│   ├── router/                 # 路由定義
│   ├── Service/                # 業務邏輯層
│   ├── repository/             # 資料庫存取層（Repository Pattern）
│   ├── middleware/             # Express middleware
│   ├── libs/                   # 工具函式、Zod schemas、cron 排程
│   ├── config/                 # SMTP、logger 等設定
│   └── __test__/               # 測試（unit / integration / e2e）
├── views/                      # EJS 模板
│   ├── partials/               # 共用 partial（_head, _header, _footer）
│   └── mailtemplates/          # Email Mustache 模板
├── src/public/                 # 靜態資源（CSS、JS）
├── sql/                        # 資料庫 migration SQL
├── dbSetup.sql                 # 完整資料庫初始化 schema
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── ecosystem.config.ts         # PM2 設定
```

---

## 2. 功能規格

### 2.1 核心功能一覽

| 功能模組           | 描述                                                                           | 狀態   |
| ------------------ | ------------------------------------------------------------------------------ | ------ |
| 使用者認證         | Email/Password 註冊、登入、登出、Email 驗證、密碼重設                        | ✅ 完成 |
| 走失動物登記       | 飼主填寫走失寵物資訊，系統儲存並觸發配對                                      | ✅ 完成 |
| 智慧配對系統       | 依種類/毛色/性別/品種篩選，再用 Haversine 距離公式排序，取前 10 個最近配對   | ✅ 完成 |
| Email 配對通知     | 配對完成後，自動發送含 Top-10 動物列表的通知郵件給飼主                        | ✅ 完成 |
| 快速比對（訪客）   | 無需登入，直接輸入特徵即可查詢最近的潛在配對                                  | ✅ 完成 |
| 收容所動物瀏覽     | 分頁、縣市篩選、物種/性別篩選、燈箱詳細資訊                                   | ✅ 完成 |
| 每日資料同步       | Cron Job 每日 00:00 從農業部 API 自動同步收容所動物與遺失動物資料            | ✅ 完成 |
| LINE Bot 抽卡      | 透過 LINE 頻道，使用者可隨機抽取一隻收容所動物查看                           | ✅ 完成 |
| Email 通知開關     | 使用者可在個人頁面開啟/關閉走失動物配對 Email 通知                           | ✅ 完成 |
| 密碼重設           | 申請密碼重設 Email                                                              | ⚠️ 部分 |

### 2.2 走失動物配對流程（核心邏輯）

```
使用者提交走失動物表單
  ↓
POST /api/lost-animals  →  AnimalLostController.create()
  ↓  [Zod 驗證請求資料]
  ↓  [DB 事務: 查找或建立 owner → 插入 animal_lost]
  ↓
GET /api/lost-animals/match/:id  →  AnimalLostService.findMatchesAndSendMail()
  ↓
[GeoService.geocoding(lost_place)]   ← Google Maps Geocoding API
  ↓
[AnimalLostRepository.findMatchingAnimals(colour, kind, sex, variety)]
  ↓  [支援多色 OR 匹配、品種模糊搜尋]
  ↓
[逐一對每個候選動物的收容所地址進行 geocoding]
  ↓
[GeoService.calculateDistanceKm(origin, destination)]  ← geolib Haversine
  ↓
[排序，取距離最近的前 10 筆]
  ↓
[MailService.sendMatchedMail()]  →  飼主收到 Email
  ↓
回傳配對結果 JSON
```

---

## 3. 頁面與 UI 規格

### 3.1 頁面清單

| 路由              | 模板檔案            | 需要登入 | 功能說明                                                                                    |
| ----------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `/`               | home.ejs            | 否       | 首頁：台灣流浪動物統計、核心功能介紹、4 步運作流程、每日推薦動物（API 動態載入）          |
| `/login`          | login.ejs           | 否       | 登入：Email + 密碼表單，支援 `returnTo` 重定向                                             |
| `/register`       | register.ejs        | 否       | 註冊：姓名 + Email + 密碼表單                                                               |
| `/report-lost`    | lost-pet-form.ejs   | **是**   | 協尋登記：走失寵物資料 + 飼主聯絡資訊（兩個 fieldset）                                    |
| `/quick-use`      | quick-use.ejs       | 否       | 快速比對：輸入特徵即可查詢潛在配對，顯示排名卡片、距離徽章、燈箱詳情                      |
| `/profile`        | profile.ejs         | **是**   | 個人頁面：Email 通知開關、我的協尋記錄列表、可手動觸發配對通知                            |
| `/shelter-animals`| shelter-animals.ejs | 否       | 收容所動物：物種/縣市/性別篩選、Cursor 分頁、動物卡片、燈箱詳情                           |

### 3.2 共用 Partials

| 組件            | 功能                                                       |
| --------------- | ---------------------------------------------------------- |
| `_head.ejs`     | meta 標籤、Google Fonts（Nunito）、CSS、common.js 延遲載入 |
| `_header.ejs`   | 粘性導覽列、Logo、漢堡選單、動態路由高亮、登入/登出邏輯   |
| `_footer.ejs`   | 底部導覽、品牌標語、版權聲明                               |

### 3.3 設計系統

- **主色調**：橙色 `#E07B3B`（行動呼籲）、棕色 `#A77B5A`（次要）、奶油色 `#FEFBF6`（背景）
- **字型**：Nunito（英數）+ Microsoft JhengHei（中文）
- **背景**：SVG 爪印重複紋理
- **前端 JS**：Vanilla JavaScript（`src/public/js/common.js`）

### 3.4 前端共用工具函式（common.js）

| 函式                          | 功能                                               |
| ----------------------------- | -------------------------------------------------- |
| `escapeHtml(str)`             | XSS 防護，HTML 實體編碼                           |
| `showToast(msg, type, dur)`   | 顯示自動隱藏通知 Toast                             |
| `handleUrlMessages(map)`      | 從 URL query params 讀取 message/error 並顯示     |
| `setButtonLoading(btn, text)` | 按鈕進入載入狀態（旋轉動畫）                       |
| `resetButton(btn, text)`      | 恢復按鈕原始狀態                                   |
| `sexLabel(s)`                 | 性別代碼轉換（'M' → 公，'F' → 母）               |
| `openLightbox(animal, id)`    | 開啟燈箱展示動物詳情（支援 API 延遲載入收容所資訊）|

---

## 4. API 規格

### 4.1 認證 API（`/api/auth`）

| 方法   | 路徑                    | 需要認證 | 請求 Body                              | 功能             |
| ------ | ----------------------- | -------- | -------------------------------------- | ---------------- |
| POST   | `/api/auth/signup`      | 否       | `name`, `email`, `password`            | 用戶註冊         |
| POST   | `/api/auth/login`       | 否       | `email`, `password`, `returnTo`(可選) | 用戶登入         |
| POST   | `/api/auth/logout`      | 是       | —                                      | 用戶登出         |
| POST   | `/api/auth/reset-password` | 否    | `email`                                | 申請密碼重設     |
| PATCH  | `/api/auth/settings`    | 是       | `isLostAnimalMailEnabled: boolean`     | 更新通知設定     |
| `*`    | `/api/auth/*`           | —        | —                                      | better-auth 內建路由 |

### 4.2 動物 API（`/api/animals`）

| 方法   | 路徑                        | 需要認證      | Query Params               | 功能                    |
| ------ | --------------------------- | ------------- | -------------------------- | ----------------------- |
| GET    | `/api/animals`              | 否            | `pageSize`, `cursor`       | 分頁取得收容所動物列表  |
| GET    | `/api/animals/random`       | 否            | —                          | 隨機取得一隻動物        |
| GET    | `/api/animals/:id`          | 否            | —                          | 依 ID 取得動物詳情（含收容所） |
| GET    | `/api/animals/city/:city`   | 否            | —                          | 依縣市取得動物列表      |
| POST   | `/api/animals/manualUpdate` | **Admin Key** | `X-Admin-API-Key` header   | 手動觸發資料同步        |

### 4.3 走失動物 API（`/api/lost-animals`）

| 方法   | 路徑                           | 需要認證 | 請求 Body / Params                                                    | 功能                    |
| ------ | ------------------------------ | -------- | --------------------------------------------------------------------- | ----------------------- |
| GET    | `/api/lost-animals`            | 否       | `pageSize`, `cursor`                                                  | 取得走失動物報告列表    |
| POST   | `/api/lost-animals`            | 否       | 走失動物資料（種類、毛色、地點、飼主資訊等）                         | 新增走失動物報告        |
| POST   | `/api/lost-animals/quick-match`| 否       | 動物特徵（無需登入）                                                  | 快速配對（不發 Email）  |
| GET    | `/api/lost-animals/match/:id`  | 否       | `:id` = animal_lost.id                                                | 執行配對並寄送 Email    |

### 4.4 Webhook API（`/webhook`）

| 方法   | 路徑        | 驗證方式             | 功能                       |
| ------ | ----------- | -------------------- | -------------------------- |
| POST   | `/webhook`  | LINE HMAC-SHA256 簽名 | LINE Bot webhook 事件處理  |

LINE Bot 支援的 postback 事件：
- `action=draw`：隨機抽取一隻動物，回傳圖片與資訊
- `action=previous`：返回上一個內容

---

## 5. 資料庫規格

### 5.1 資料表一覽

```
user          ←── account (OAuth)
 ↑ trigger
owner ←─────── animal_lost

animal_shelter ←── animal

session / verification  (Better Auth 內部)
```

### 5.2 資料表詳細結構

#### `user`（使用者）
| 欄位                      | 型別      | 說明                          |
| ------------------------- | --------- | ----------------------------- |
| id                        | TEXT PK   | 唯一識別碼                    |
| name                      | TEXT      | 使用者名稱                    |
| email                     | TEXT UNIQUE | 電子郵件                    |
| emailVerified             | BOOLEAN   | Email 是否已驗證              |
| image                     | TEXT      | 頭像 URL                      |
| createdAt / updatedAt     | TIMESTAMP | 建立/更新時間                 |
| isLostAnimalMailEnabled   | BOOLEAN   | 是否啟用走失動物配對通知      |
| isSmsEnabled              | BOOLEAN   | 是否啟用簡訊通知（未實作）    |

> **觸發器 `handle_user_on_insert`**：新用戶建立時自動 (1) 設定 `isLostAnimalMailEnabled = true`（若有 email），(2) 在 `owner` 表建立對應記錄。

#### `session`（會話）
| 欄位        | 型別          | 說明             |
| ----------- | ------------- | ---------------- |
| id          | TEXT PK       |                  |
| expiresAt   | TIMESTAMP     | 過期時間（7天）  |
| token       | TEXT UNIQUE   | 會話 Token       |
| ipAddress   | TEXT          | 用戶端 IP        |
| userAgent   | TEXT          | User-Agent       |
| userId      | TEXT FK→user  |                  |

#### `account`（OAuth 帳號）
| 欄位              | 型別         | 說明              |
| ----------------- | ------------ | ----------------- |
| id                | TEXT PK      |                   |
| accountId         | TEXT         | Provider 帳號 ID  |
| providerId        | TEXT         | Provider 名稱     |
| userId            | TEXT FK→user |                   |
| password          | TEXT         | 密碼 hash         |
| accessToken 等    | TEXT         | OAuth token       |

#### `verification`（驗證碼）
| 欄位       | 型別      | 說明                  |
| ---------- | --------- | --------------------- |
| id         | TEXT PK   |                       |
| identifier | TEXT      | 驗證對象（如 email）  |
| value      | TEXT      | 驗證碼值              |
| expiresAt  | TIMESTAMP | 過期時間              |

#### `animal_shelter`（收容所）
| 欄位    | 型別           | 說明               |
| ------- | -------------- | ------------------ |
| id      | INTEGER PK     | 政府 API 收容所 ID |
| name    | VARCHAR(100)   | 收容所名稱         |
| address | VARCHAR(100)   | 收容所地址         |
| tel     | VARCHAR(30)    | 收容所電話         |

#### `animal`（收容所動物）
| 欄位              | 型別           | 說明                         |
| ----------------- | -------------- | ---------------------------- |
| id                | SERIAL PK      |                              |
| sub_id            | VARCHAR(20) UNIQUE | 政府 API 動物 ID（防重）  |
| kind              | VARCHAR(20)    | 種類（狗/貓等）              |
| variety           | VARCHAR(20)    | 品種                         |
| sex               | VARCHAR(5)     | 性別（M/F/N）                |
| age               | TEXT           | 年齡描述                     |
| body_type         | VARCHAR(20)    | 體型                         |
| colour            | VARCHAR(20)    | 毛色                         |
| found_place       | VARCHAR(50)    | 撿到地點                     |
| remark            | TEXT           | 備註                         |
| picture           | TEXT           | 圖片 URL                     |
| status            | VARCHAR(20)    | 狀態（OPEN/CLOSE 等）        |
| open_date         | DATE           | 開放日期                     |
| close_date        | DATE           | 關閉日期                     |
| update_date       | DATE           | 最後更新                     |
| animal_shelter_id | INTEGER FK→shelter | 所屬收容所               |

#### `owner`（飼主）
| 欄位  | 型別      | 說明                                   |
| ----- | --------- | -------------------------------------- |
| id    | SERIAL PK |                                        |
| name  | TEXT      | 姓名                                   |
| phone | TEXT      | 電話                                   |
| email | TEXT      | Email                                  |
|       |           | UNIQUE 約束：(phone, email) 組合唯一   |

#### `animal_lost`（走失動物）
| 欄位       | 型別         | 說明                  |
| ---------- | ------------ | --------------------- |
| id         | SERIAL PK    |                       |
| chip_id    | TEXT UNIQUE  | 晶片號碼（防重）      |
| name       | TEXT         | 寵物名稱              |
| kind       | TEXT         | 種類                  |
| variety    | TEXT         | 品種                  |
| sex        | TEXT         | 性別                  |
| colour     | TEXT         | 毛色                  |
| outlook    | TEXT         | 外觀描述              |
| feature    | TEXT         | 特徵                  |
| lost_time  | DATE         | 走失時間              |
| lost_place | TEXT         | 走失地點（用於地理編碼）|
| picture    | TEXT         | 圖片 URL              |
| owner_id   | INTEGER FK→owner | 所屬飼主          |

---

## 6. 外部服務整合

### 6.1 農業部開放資料 API

| 資料集         | URL                                                                              | 用途                    |
| -------------- | -------------------------------------------------------------------------------- | ----------------------- |
| 待領養動物     | `https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL` | 同步 animal 表          |
| 遺失動物       | `https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i` | 同步 animal_lost 表     |

- 批量插入：每批 100 筆，使用 `ON CONFLICT DO NOTHING` 避免重複
- 資料驗證：使用 Zod schema 驗證 API 回應格式

### 6.2 Google Maps Geocoding API

- 用途：將走失地點文字（如「台北市大安區」）轉換為經緯度座標
- 錯誤處理：
  - `ZERO_RESULTS` → 返回 null（跳過該筆）
  - `OVER_QUERY_LIMIT` → 拋出速率限制錯誤
  - `REQUEST_DENIED` → 拋出認證錯誤
- 距離計算：使用 `geolib` 庫（Haversine 公式），精確到小數點後 2 位（公里）

### 6.3 EMAIL（Nodemailer + Brevo SMTP）

| Email 類型    | 模板檔案                                 | 觸發時機             |
| ------------- | ---------------------------------------- | -------------------- |
| 歡迎信        | `views/mailtemplates/welcome.mt.html`    | 新用戶註冊           |
| 測試信        | `views/mailtemplates/test.mt.html`       | 手動測試             |
| 配對通知      | `views/mailtemplates/animalMatchNotice.mt.html` | 走失動物配對完成  |

- 模板引擎：Mustache（支援變數插值）
- SMTP 服務：Brevo（`smtp-relaying.brevo.com:587`）

### 6.4 LINE Bot

- SDK：`@line/bot-sdk` + `messaging-api-line`
- Webhook 端點：`POST /webhook`
- 安全驗證：HMAC-SHA256 簽名驗證（`CHANNEL_SECRET`）
- 支援操作：
  - `action=draw`：隨機推薦收容所動物（文字訊息 + 圖片）
  - `action=previous`：返回上一頁

---

## 7. 認證與授權

### 7.1 認證流程

```
用戶登入 → POST /api/auth/login
  → AuthController.loginUser()
  → auth.api.signInEmail() (Better Auth)
  → 設定 HTTP-only session cookie (sameSite: Lax, secure: true)
  → 重定向到 returnTo 或首頁

後續請求 → addUserToLocals middleware
  → auth.api.getSession() 從 header 取出 session
  → 寫入 res.locals.user（供 EJS 模板使用）
```

### 7.2 路由保護

| 保護方式               | 適用路由                        | 行為                          |
| ---------------------- | ------------------------------- | ----------------------------- |
| `requireAuth` middleware | `/report-lost`, `/profile`    | 未登入 → 重定向到 `/login?returnTo=...` |
| `requireAdminApiKey`   | `POST /api/animals/manualUpdate` | 驗證 `X-Admin-API-Key` header |

### 7.3 Session 設定

- 有效期：**7 天**
- 自動更新：每 **1 天** 延長過期時間
- Cookie：`sameSite: Lax`、`secure: true`

---

## 8. 後台排程任務

### 8.1 每日資料同步

| 屬性     | 值                              |
| -------- | ------------------------------- |
| Cron 表達式 | `0 0 * * *`                  |
| 時區     | `Asia/Taipei`                   |
| 觸發時間 | 每天 00:00（台北時間）          |
| 任務 1   | `AnimalService.updateAnimalTable()` — 同步待領養動物 |
| 任務 2   | `AnimalLostService.updateTableAnimalLosts()` — 同步遺失動物 |

- 成功：記錄更新行數到 log
- 失敗：記錄詳細錯誤堆疊，標記需手動介入

---

## 9. 部署架構

### 9.1 容器架構

```
                    Internet
                       ↓
              ┌─────────────────┐
              │  Nginx (8080)   │
              │  負載均衡       │
              └────────┬────────┘
           ┌───────────┼───────────┐
      :2486 │      :2487 │    :2488 │
    ┌───────┴─┐  ┌───────┴─┐  ┌───────┴─┐
    │ Node.js │  │ Node.js │  │ Node.js │
    │ App     │  │ App     │  │ App     │
    └─────────┘  └─────────┘  └─────────┘
           └───────────┬───────────┘
                       ↓
              ┌─────────────────┐
              │   PostgreSQL    │
              │   (5432)        │
              └─────────────────┘
```

### 9.2 Docker 配置

- `Dockerfile`：基礎映像 `node:latest`，COPY → npm install → npm start
- `docker-compose.yml`：
  - `postgres` 服務：`postgres:latest`，資料卷持久化至 `./tmp/data/db`
  - `node-app` 服務：自訂 Dockerfile 構建
- `nginx.conf`：upstream 指向 localhost:2486/2487/2488

### 9.3 PM2 配置

PM2 設定檔 `ecosystem.config.ts` 管理多個 Node.js 實例。

---

## 10. 環境變數清單

| 變數名                      | 必需 | 說明                                       |
| --------------------------- | ---- | ------------------------------------------ |
| `DATABASE_URL`              | ✅   | PostgreSQL 連接字串                        |
| `PORT`                      | ✅   | 應用監聽 port（預設 2486）                 |
| `NODE_ENV`                  | ✅   | `development` / `production` / `test`      |
| `APP_BASE_URL`              | ✅   | 應用基礎 URL（如 `http://localhost:2486`） |
| `FRONTEND_URL`              | 選用 | 前端 URL（備用）                           |
| `CORS_ALLOWED_ORIGINS`      | ✅   | 允許的 CORS 來源（逗號分隔）               |
| `SMTP_HOST`                 | ✅   | SMTP 伺服器主機                            |
| `SMTP_PORT`                 | ✅   | SMTP 端口（通常 587）                      |
| `SMTP_SECURE`               | ✅   | 是否啟用 TLS                               |
| `SMTP_USER`                 | ✅   | SMTP 用戶名                                |
| `SMTP_PASSWORD`             | ✅   | SMTP 密碼                                  |
| `SMTP_SENT_FROM`            | ✅   | 發件人 Email（缺少會拋出錯誤）            |
| `EMAIL_VERIFY_CALLBACK_URL` | ✅   | Email 驗證回調 URL                         |
| `GEOCODING_API_KEY`         | ✅   | Google Maps Geocoding API 金鑰             |
| `CHANNEL_SECRET`            | ✅   | LINE Bot Channel Secret（32 bytes）        |
| `CHANNEL_ACCESS_TOKEN`      | ✅   | LINE Bot Access Token                      |
| `ADMIN_API_KEY`             | ✅   | 管理員 API 金鑰（保護 manualUpdate 端點）  |

測試專用：

| 變數名          | 說明                   |
| --------------- | ---------------------- |
| `API_URL`       | E2E 測試 API 端點      |
| `TEST_EMAIL`    | E2E 測試帳號 Email     |
| `TEST_PASSWORD` | E2E 測試帳號密碼       |

---

## 11. 測試規格

### 11.1 測試層級

| 層級     | 框架          | 目錄                          | 涵蓋範圍                           |
| -------- | ------------- | ----------------------------- | ---------------------------------- |
| 單元測試 | Jest + ts-jest | `src/__test__/unit/`         | Middleware、工具函式、Service、Repository、Zod schema |
| 整合測試 | Jest + Supertest | `src/__test__/integration/` | API Controller 完整 HTTP 流程      |
| E2E 測試 | Playwright    | `src/__test__/e2e/`           | 真實瀏覽器操作（登入/登出/導航）  |

### 11.2 測試模組清單

**單元測試（unit）：**
- `middleware/userSession.test.ts`
- `middleware/handler.test.ts`
- `middleware/logMatchRequests.test.ts`
- `service/mail.service.test.ts`
- `service/animal.service.test.ts`
- `service/animalLost.service.test.ts`
- `service/geo.service.test.ts`
- `base.db.test.ts`、`animal.db.test.ts`、`animalLost.db.test.ts`、`owner.db.test.ts`
- `zod/animals.schema.test.ts`、`zod/date.schema.test.ts`
- 工具：`catchAsync`、`customError`、`successResponse`、`taiwanCities.utils`、`prettifyAnimalData`、`database.utils`

**整合測試（integration）：**
- `authController.test.ts`（signup、login、logout、settings — 8 cases）
- `animalCtrler.test.ts`
- `animalLostController.test.ts`
- `webhook.Controller.test.ts`

**E2E 測試（e2e）：**
- `authentication.spec.ts`（登入流程、登出流程）
- `navigation.spec.ts`
- `quickUse.spec.ts`

### 11.3 測試環境設定

- 測試資料庫：`postgresql://test:test@localhost:5432/furfriend_test`
- Setup 檔：`src/__test__/setup.ts` 自動注入測試環境變數

---

## 12. 已知限制與待辦事項

| 狀態     | 項目                                                                   |
| -------- | ---------------------------------------------------------------------- |
| ⚠️ 待完成 | 密碼重設功能：`authController.ts` 中有 TODO，回調 URL 尚未完整設定   |
| ⚠️ 待完成 | `isSmsEnabled` 欄位已建立，但簡訊通知功能尚未實作                    |
| 🚫 已停用 | GitHub OAuth 在 `auth.ts` 中已被註解                                  |
| ⚠️ 效能   | Dockerfile 使用 `node:latest`（體積龐大），建議改用 `node:alpine`     |
| ⚠️ 效能   | 配對時逐個呼叫 Geocoding API（可能達到 rate limit），可考慮 cache     |
| ℹ️ 說明   | `sequelize` 和 `prisma` 已列入依賴，但實際使用原生 `pg` pool + 自行實作的 Repository Pattern |
