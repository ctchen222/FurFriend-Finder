# [R-10] `sendWelcomeMail` 傳空物件給 Mustache，歡迎信中用戶名稱顯示空白

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | ux |
| **影響功能** | 用戶註冊歡迎信 |

## 問題描述

`MailService.sendWelcomeMail` 呼叫 `Mustache.render()` 時傳入空物件 `{}`，但 `welcome.mt.html` 模板中包含 `{{userName}}` 變數。結果用戶收到的歡迎信顯示「歡迎 ，您已成功註冊！」，名稱欄位空白。

## 影響的檔案與位置

- `backend/src/Service/mail.ts` 第 35-47 行
- `backend/views/mailtemplates/welcome.mt.html`（模板含 `{{userName}}`）

## 根本原因（Root Cause）

```typescript
// mail.ts:35-47
sendWelcomeMail = async (mail: string) => {  // ← 沒有 userName 參數
    const mustacheTemp = await fs.readFile(`${appRoot}/views/mailtemplates/welcome.mt.html`, 'utf8')
    const htmlContent = Mustache.render(mustacheTemp.toString(), {})
    //                                                          ^^ 空物件，{{userName}} 替換為空字串
    await this.mailer.sendMail({ ... html: htmlContent })
}

// welcome.mt.html 模板（預期）：
// <h2>歡迎 {{userName}}，您已成功註冊！</h2>
// 實際結果：
// <h2>歡迎 ，您已成功註冊！</h2>
```

## 影響範圍（Impact）

所有新註冊用戶收到的歡迎信名稱欄位都是空的，影響品牌形象和用戶體驗。

## 修復規格（Fix Specification）

### 需要的修改

**`mail.ts:35`**
```typescript
// Before:
sendWelcomeMail = async (mail: string) => {
    const htmlContent = Mustache.render(mustacheTemp.toString(), {})

// After:
sendWelcomeMail = async (mail: string, userName: string) => {
    const htmlContent = Mustache.render(mustacheTemp.toString(), { userName })
```

同時需要確認所有呼叫 `sendWelcomeMail` 的地方都傳入 `userName`。也需確認 `sendTestMail` 是否有同樣問題。

### 修改後的預期行為

新用戶收到的歡迎信顯示「歡迎 [用戶名稱]，您已成功註冊！」。

## 驗收條件（Acceptance Criteria）

- [ ] 新用戶收到的歡迎信顯示正確的用戶名稱
- [ ] 不顯示「歡迎 ，您已成功註冊！」（空名稱）
- [ ] TypeScript 編譯通過（方法簽名更新後）
