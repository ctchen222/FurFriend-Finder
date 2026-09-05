# Matching evaluation baseline

目前只使用固定的 `matching-synthetic-v1` 合成資料，不能解讀為真實找回率。資料含 40 cases：24 個 `known-positive`、8 個 `confirmed-no-match`、8 個 `unjudged`；沒有把未標註候選當成負例。

執行：

```bash
pnpm eval:matching -- --engine rules-v2
pnpm eval:matching -- --engine rules-v2 --output /tmp/matching-evaluation.json
```

2026-09-06 baseline（固定 fixture）：

| 指標 | 數值 |
|---|---:|
| positive cases | 24 |
| candidate recall | 1.000 |
| Hit@10 | 1.000 |
| Recall@10 | 1.000 |
| MRR@10 | 0.7708 |
| known false-positive rate | 0.500 |

這些數值只證明 metric 與 fixture 可重跑；下一輪必須加入經同意且去識別化的 human-reviewed cases，才能討論產品品質。`unjudged` 不計入 false-positive rate。
