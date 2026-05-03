# [R-04] `create()` 失敗時缺少 ROLLBACK，DB transaction 懸掛

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 走失動物登錄（表單提交） |

## 問題描述

`animalLostController.create` 在 try 區塊中開啟 DB transaction，但 catch 區塊沒有 ROLLBACK。若 `findOrCreate` 或 `create` 過程中拋出例外，transaction 會懸掛，長期累積後可能導致 DB 連線池耗盡（`too many clients` 錯誤）。

## 影響的檔案與位置

- `backend/src/Controller/animalLostController.ts` 第 46-80 行
- `backend/src/repository/base.db.ts`（需新增 `rollback()` 方法）

## 根本原因（Root Cause）

```typescript
// animalLostController.ts:51-79
try {
    await this.repository.start()        // 開始 transaction
    const owner = await this.ownerRepository.findOrCreate(animalOwner);
    // ↑ 若此拋出例外...
    await this.repository.create<AnimalLost>(animalToCreate);
    await this.repository.commit()
} catch (error) {
    // ❌ 缺少 await this.repository.rollback()
    // transaction 懸掛，佔用 DB 連線直到 timeout
    res.locals.result = new SuccessResponse('redirect', '/profile?error=登錄失敗，請稍後再試');
}
```

## 影響範圍（Impact）

高頻失敗情境下（例如 DB 短暫不穩定、Zod 驗證失敗等），懸掛的 transaction 會佔用連線池中的連線，最終導致整個應用程式無法建立新的 DB 連線，服務中斷。

## 修復規格（Fix Specification）

### 需要的修改

**步驟 1：在 `base.db.ts` 加入 `rollback()` 方法**
```typescript
async rollback(): Promise<void> {
    await pool.query('ROLLBACK;');
}
```

**步驟 2：修改 `animalLostController.ts` 的 catch 區塊**
```typescript
// Before:
} catch (error) {
    res.locals.result = new SuccessResponse('redirect', '/profile?error=登錄失敗，請稍後再試');
}

// After:
} catch (error) {
    await this.repository.rollback();  // ✅ 確保 transaction 被回滾
    res.locals.result = new SuccessResponse('redirect', '/profile?error=登錄失敗，請稍後再試');
}
```

### 修改後的預期行為

走失動物登錄失敗時，DB transaction 被正確回滾，不佔用連線池資源。

## 驗收條件（Acceptance Criteria）

- [ ] `base.db.ts` 有 `rollback()` 方法
- [ ] 走失動物登錄失敗時，DB 不出現懸掛的 open transaction
- [ ] `pg_stat_activity` 中不出現 `idle in transaction` 的連線累積
