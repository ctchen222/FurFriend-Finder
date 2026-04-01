# FurFriend-Finder 問題索引

共 **34 個問題**，分為 Critical（10）、Medium（14）、Low（10）三個等級。

---

## 🔴 Critical — 10 個

| ID | 標題 | 影響功能 |
|----|------|---------|
| [R-01](issue-R01.md) | `ownerMap` key 拼接不一致，批次 insert 永遠找不到 owner | 失蹤動物批次建立 |
| [R-02](issue-R02.md) | `base.db.ts` `findAll` cursor/pageSize 用字串插值，SQL injection 風險 | 所有分頁查詢 |
| [R-03](issue-R03.md) | `base.db.ts` `findOne` JOIN 子句在 WHERE 之後，SQL 語法錯誤 | 所有 findOne 查詢 |
| [R-04](issue-R04.md) | `animal.db.ts` `findAnimalsByCity` 使用錯誤資料表名稱 | 城市篩選動物列表 |
| [R-05](issue-R05.md) | `animalLostController` transaction 缺少 rollback | 失蹤動物建立 |
| [R-06](issue-R06.md) | `sendWelcomeMail` 傳入空物件，歡迎信 `{{userName}}` 顯示為空 | 歡迎信 |
| [R-07](issue-R07.md) | `matchLostAnimal` / `quickMatch` 用 `return next()` 而非 `return next(err)`，錯誤無法傳遞 | 配對功能錯誤處理 |
| [R-08](issue-R08.md) | `animalLost.ts` geocoding 用 `Promise.all`，任一失敗導致整批失敗 | 批次失蹤動物 geocoding |
| [R-09](issue-R09.md) | EJS 用 `innerHTML` 插入未 escape API 資料，XSS 風險 | quick-use、shelter-animals 頁面 |
| [R-10](issue-R10.md) | `authController.resetPassword` hardcode `example.com` URL，密碼重設信連結失效 | 密碼重設 |

---

## 🟡 Medium — 14 個

| ID | 標題 | 影響功能 |
|----|------|---------|
| [M-01](issue-M01.md) | `animal.db.ts` 有多個 dead code 函數 | 無（dead code） |
| [M-02](issue-M02.md) | `base.db.ts` `ORDER BY` 使用無效括號語法 | 所有排序查詢 |
| [M-03](issue-M03.md) | `animal.db.ts` `findAll` 是多餘的覆寫 | 動物列表查詢 |
| [M-04](issue-M04.md) | `animalLost.ts` `findMatchesAndSendMail` 與 `findMatches` 有 ~50 行重複邏輯 | 配對功能 |
| [M-05](issue-M05.md) | `geo.ts` 沒有 try-catch，axios 例外會直接 propagate | Geocoding API 呼叫 |
| [M-06](issue-M06.md) | `authRouter` 所有路由缺少 `catchAsync` 包裝 | 認證相關路由 |
| [M-07](issue-M07.md) | `authController.createUser` `callbackURL` 被註解，email 驗證流程不完整 | 用戶註冊 email 驗證 |
| [M-08](issue-M08.md) | `viewRouter` `/profile` 和 `/report-lost` 缺少認證中介軟體 | 個人頁面、失蹤通報頁面 |
| [M-09](issue-M09.md) | `animalRouter` `POST /manualUpdate` 無認證，任何人可觸發資料同步 | 手動資料同步 |
| [M-10](issue-M10.md) | `app.ts` `cors()` 無設定，允許所有來源 | 整個後端 API |
| [M-11](issue-M11.md) | cron job 失敗只寫 log，無 admin 通知機制 | 每日資料同步 |
| [M-12](issue-M12.md) | `database.utils.ts` cursor 計算假設 ID 從 1 開始且連續 | 所有分頁功能 |
| [M-13](issue-M13.md) | `taiwanCities.utils.ts` 「嘉義」重複且未區分嘉義市/嘉義縣 | 城市篩選 |
| [M-14](issue-M14.md) | `animalLost.ts` 錯誤處理不一致（return new vs throw） | 失蹤動物 Service |

---

## 🔵 Low — 10 個

| ID | 標題 | 影響功能 |
|----|------|---------|
| [L-01](issue-L01.md) | `animal.db.test.ts` line 40 `animmal.picture` 雙 m 拼字，測試永遠失敗 | 單元測試 |
| [L-02](issue-L02.md) | `animalCtrler.test.ts` 整個檔案被註解，無有效整合測試 | 整合測試 |
| [L-03](issue-L03.md) | `quickUse.spec.ts` E2E 測試缺 API mock，`expect(results).toBe(10)` 不可靠 | E2E 測試 |
| [L-04](issue-L04.md) | `prettiftyDailyAnimalData` 函數名稱多了一個 t | 日報資料格式化 |
| [L-05](issue-L05.md) | `package.json` 有不必要的 `crypto` npm 依賴 | 無（依賴管理） |
| [L-06](issue-L06.md) | 寄件人 email 地址硬編碼在設定檔中 | 所有 Email 功能 |
| [L-07](issue-L07.md) | `GeoService.calculateDistance` 回傳 meters 但沒有說明單位 | 配對結果距離顯示 |
| [L-08](issue-L08.md) | EJS 頁面有 `console.log` 除錯碼，暴露 cursor 資訊 | 收容所動物列表頁面 |
| [L-09](issue-L09.md) | `errorHandler` 使用 Windows 路徑分隔符解析 stack trace | 錯誤日誌 |
| [L-10](issue-L10.md) | `middleware/auth.ts` 只是空的 re-export，命名具有誤導性 | 認證中介軟體架構 |

---

## 統計

| 等級 | 數量 | 說明 |
|------|------|------|
| 🔴 Critical | 10 | 資料遺失、XSS、SQL injection、功能完全失效 |
| 🟡 Medium | 14 | SQL 錯誤、邏輯問題、安全隱患、架構問題 |
| 🔵 Low | 10 | Tech debt、拼字錯誤、缺少文件、輕微安全問題 |
| **合計** | **34** | |
