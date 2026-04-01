# [M-09] `findMatchesAndSendMail` 和 `findMatches` 有大量重複的 geocoding 邏輯

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 走失動物配對功能 |

## 問題描述

`AnimalLostService` 中的 `findMatchesAndSendMail`（第 26-91 行）和 `findMatches`（第 93-140 行）幾乎完全相同，差別只有是否寄送 Email。所有核心邏輯（normalizeMatchCriteria、geocoding、距離計算、排序）都重複了兩次。

## 影響的檔案與位置

- `backend/src/Service/animalLost.ts` 第 26-140 行

## 根本原因（Root Cause）

兩個方法共用但重複的邏輯：
- `normalizeMatchCriteria` 呼叫（第 38-45 vs 94-101）
- geocode 走失地點（第 48-51 vs 103-106）
- `findMatchingAnimals` 查詢（第 55 vs 110）
- 對每個動物進行 geocoding 和距離計算（第 58-71 vs 114-127）
- 排序和取 top 10（第 73-76 vs 129-132）

唯一的差別是 `findMatchesAndSendMail` 在第 80-82 行寄送 Email。

## 影響範圍（Impact）

修改配對邏輯時需同時修改兩個地方，容易造成不一致。R-05 的 geocoding 錯誤處理修復也需要在兩個地方做。

## 修復規格（Fix Specification）

### 需要的修改

**提取共用邏輯到 `_findMatchCandidates` private 方法**
```typescript
private _findMatchCandidates = async (lostAnimalData: {
    name?: string; colour?: string; sex?: string;
    kind?: string; variety?: string; lost_place?: string;
}) => {
    const { colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(
        lostAnimalData.name, lostAnimalData.colour, lostAnimalData.sex,
        lostAnimalData.kind, lostAnimalData.variety, lostAnimalData.lost_place
    );

    const lostAnimalCoordinates = await this.geoService.geocoding(lost_place || '');
    if (!lostAnimalCoordinates) return new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);

    const matchedAnimals = await this.repository.findMatchingAnimals(colour, kind, sex, variety);
    const animalsWithDistance = await Promise.all(matchedAnimals.map(async (animal) => {
        // ... geocoding + distance 邏輯
    }));

    const top10Matches = animalsWithDistance.sort((a, b) => a.distance - b.distance).slice(0, 10);
    const metadata = getMetadata(matchedAnimals);
    return { top10Matches, matchedAnimals, metadata };
};

findMatchesAndSendMail = async (animalId: string) => {
    const lostAnimal = await this.repository.findById<AnimalLost>(animalId);
    if (!lostAnimal) return new CustomError(apiMessage.CONTENT_NOT_FOUND);
    const owner = await this.ownerRepository.findById<Owner>(lostAnimal.owner_id);
    if (!owner) return new CustomError(apiMessage.CONTENT_NOT_FOUND);

    const result = await this._findMatchCandidates(lostAnimal);
    if (result instanceof CustomError) return result;

    if (result.top10Matches.length > 0 && owner.email) {
        await this.mailService.sendMatchedMail(owner.email, owner.name, result.top10Matches);
    }
    return { metadata: result.metadata, lostAnimal, top10Matches: result.top10Matches };
};

findMatches = async (lostAnimal: any) => {
    const result = await this._findMatchCandidates(lostAnimal);
    if (result instanceof CustomError) return result;
    return { metadata: result.metadata, matchedAnimals: result.top10Matches };
};
```

### 修改後的預期行為

兩個 public 方法行為不變，但共用邏輯只在一個地方維護。

## 驗收條件（Acceptance Criteria）

- [ ] `findMatchesAndSendMail` 和 `findMatches` 的外部行為不變
- [ ] geocoding 邏輯只在一個地方存在
- [ ] R-05 的修復只需修改 `_findMatchCandidates` 一處
