# Google OAuth 本機驗收

1. 在 Google Cloud 建立 Web application credential。
2. Authorized redirect URI 設為 `http://localhost:2486/api/auth/callback/google`。
3. `.env` 設定 `GOOGLE_OAUTH_ENABLED=true`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`APP_BASE_URL=http://localhost:2486` 與高熵 `BETTER_AUTH_SECRET`。
4. 啟動 app，開啟 `/login` 或 `/register`，按「使用 Google 繼續」。
5. 驗收新 Google 帳號可建立 session、重複登入不新增 user/account、登出後 `/profile` 需要重新登入。

拒絕授權、state 錯誤、Google 缺少或未驗證 email 時，都應回固定登入錯誤頁且不建立新 session。未設定 Google credentials 時，頁面不顯示按鈕，密碼登入仍可用。
