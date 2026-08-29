# 自动生成验收工件

`checkers-acceptance.js` 和 `gobang-acceptance.js` 会把完整动作序列、随机回归和协议结果写入
`TEST_REPORTS/artifacts/`。这些 JSON 只用于本地复现，体积会随测试策略增长，已加入 `.gitignore`，不属于运行时依赖，
也不作为发布提交的必需文件。

生成命令：

```bash
node scripts/checkers-acceptance.js
node scripts/gobang-acceptance.js
```

报告中的三局摘要和不变量仍保留在 [`checkers.md`](./checkers.md) 与 [`gobang.md`](./gobang.md)。
2026-08-28 从 Git 移出的旧 JSON 快照未删除，保存在桌面归档：
`/home/chy/桌面/tmp/jsgames-unused-20260828/report-artifacts/`。
