# [M-01] SQL Injection 風險：`cursor` 和 `pageSize` 直接字串插值，未參數化

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | security |
| **影響功能** | 動物列表分頁 API（GET /api/animals、GET /api/lost-animals） |

## 問題描述

`BaseRepository.findAll()` 和 `AnimalRepository.findAllWithShelter()` 中，`cursor` 和 `pageSize` 使用字串插值直接嵌入 SQL，沒有使用參數化查詢（`$1`, `$2`），存在 SQL Injection 風險。

## 影響的檔案與位置

- `backend/src/repository/base.db.ts` 第 33、35 行
- `backend/src/repository/animal.db.ts` 第 38、40 行（findAll 重寫）
- `backend/src/repository/animal.db.ts` 第 72、74 行（findAllWithShelter）

## 根本原因（Root Cause）

```typescript
// base.db.ts:28-36
const query = `
    SELECT ${options ? options.join(", ") : "*"}
    FROM ${this.tableName}
    ${cursor ? `WHERE id > ${cursor}` : ""}   // ❌ cursor 直接插入
    ${orderByStr}
    LIMIT ${pageSize};                         // ❌ pageSize 直接插入
`;
```

## 影響範圍（Impact）

若 cursor 或 pageSize 來自不受信任的用戶輸入（API query string），攻擊者可注入任意 SQL。目前 `animalHelper.ts` 有做 base64 解碼，但沒有對 cursor 值做進一步驗證。

## 修復規格（Fix Specification）

### 需要的修改

**`base.db.ts:21-40`**
```typescript
// After:
async findAll<T>(pageSize: number = 10, cursor?: string, options?: string[], orderBy?: string[]): Promise<T[]> {
    const orderByStr = orderBy?.length ? `ORDER BY ${orderBy.join(", ")} DESC` : "ORDER BY id ASC";
    const values: any[] = [];
    let whereClause = '';

    if (cursor) {
        values.push(cursor);
        whereClause = `WHERE id > $${values.length}`;
    }
    values.push(pageSize);
    const limitClause = `LIMIT $${values.length}`;

    const query = `
        SELECT ${options ? options.join(", ") : "*"}
        FROM ${this.tableName}
        ${whereClause}
        ${orderByStr}
        ${limitClause};
    `;
    const result = await pool.query(query, values);
    return result.rows;
}
```

### 修改後的預期行為

分頁功能正常運作，且 cursor 和 pageSize 被正確參數化，無法注入 SQL。

## 驗收條件（Acceptance Criteria）

- [ ] 傳入 `cursor=1; DROP TABLE animal; --` 等惡意值時，被視為字串，不執行 SQL
- [ ] 正常分頁功能不受影響
- [ ] `base.db.ts`、`animal.db.ts` 中所有 `findAll` 和 `findAllWithShelter` 都完成修改
