# [M-07] CORS 設定允許所有來源，生產環境存在安全風險

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | security |
| **影響功能** | 所有 API 端點的跨域存取控制 |

## 問題描述

`app.ts` 使用 `app.use(cors())` 不帶任何選項，表示允許來自**任何來源**的跨域請求。在生產環境中，這允許任意外部網站對 API 發出跨域請求，存在 CSRF 和資料洩露風險。

## 影響的檔案與位置

- `backend/src/app.ts` 第 15 行

## 根本原因（Root Cause）

```typescript
// app.ts:15
app.use(cors());  // ❌ 允許所有來源、所有 header、所有 method
```

## 影響範圍（Impact）

惡意網站可以透過用戶的瀏覽器向 API 發出跨域請求（使用用戶的 session cookie），可能導致 CSRF 攻擊或敏感資料洩露。

## 修復規格（Fix Specification）

### 需要的修改

**步驟 1：在 `.env` 加入**
```
ALLOWED_ORIGINS=http://localhost:2486
```

**步驟 2：修改 `app.ts:15`**
```typescript
// Before:
app.use(cors());

// After:
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:2486').split(',');

app.use(cors({
    origin: (origin, callback) => {
        // 允許無 origin 的請求（如 curl、Postman）
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // 允許 cookie-based 認證
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
```

### 修改後的預期行為

只有 `ALLOWED_ORIGINS` 中列出的來源可以發送跨域請求，其他來源收到 CORS 錯誤。

## 驗收條件（Acceptance Criteria）

- [ ] 允許來源（如 `http://localhost:2486`）的跨域請求正常
- [ ] 不允許來源的請求收到 CORS 錯誤
- [ ] `credentials: true` 使 cookie-based 認證正常運作
- [ ] 來源列表從環境變數讀取，部署不同環境可彈性設定
