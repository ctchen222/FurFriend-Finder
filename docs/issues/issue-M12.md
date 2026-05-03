# [M-12] 每日 cron job 失敗沒有告警機制，管理員無從得知同步失敗

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 每日動物資料自動同步 |

## 問題描述

每天 00:00 的 cron job 若失敗，只會記錄 `logger.error`，沒有主動通知管理員的機制。若連續多天同步失敗，管理員不會知道，資料庫中的動物資料會過時。

## 影響的檔案與位置

- `backend/src/libs/dataSchedule.utils.ts`

## 根本原因（Root Cause）

```typescript
// dataSchedule.utils.ts
} catch (error) {
    logger.error('Error occurred during cron job:', error);
    // ❌ 只記錄 log，沒有告警，管理員需要主動查看 log 才會發現
}
```

## 影響範圍（Impact）

若農業部 API 中斷、DB 連線失敗或其他錯誤導致 cron job 失敗，管理員在查看 log 前都不會知道，資料庫資料可能長期未更新。

## 修復規格（Fix Specification）

### 需要的修改

**步驟 1：在 `.env` 加入**
```
ADMIN_EMAIL=admin@yourapp.com
```

**步驟 2：在 `MailService` 加入 `sendAdminAlert` 方法**
```typescript
sendAdminAlert = async (to: string, subject: string, body: string) => {
    await this.mailer.sendMail({
        from: mailConfig.sentFrom,
        to,
        subject: `[FurFriend Alert] ${subject}`,
        text: `${body}\n\n時間：${new Date().toISOString()}`,
    });
};
```

**步驟 3：修改 `dataSchedule.utils.ts`**
```typescript
} catch (error) {
    logger.error('Error occurred during cron job:', error);
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
        try {
            await new MailService().sendAdminAlert(
                adminEmail,
                '每日資料同步失敗',
                `錯誤訊息：${error instanceof Error ? error.message : String(error)}`
            );
        } catch (mailError) {
            logger.error('Failed to send admin alert:', mailError);
        }
    }
}
```

### 修改後的預期行為

cron job 失敗時，ADMIN_EMAIL 收到告警信，包含錯誤訊息和發生時間。

## 驗收條件（Acceptance Criteria）

- [ ] cron job 失敗時，`ADMIN_EMAIL` 收到告警信
- [ ] 告警信包含錯誤訊息和時間戳
- [ ] 寄信失敗時不會導致額外錯誤（有 try-catch 保護）
