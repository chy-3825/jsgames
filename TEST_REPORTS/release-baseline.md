# 发布基线记录

记录日期：2026-08-29；项目版本：`2.1.0`
基线提交：`b39d198661e78d3904db27401873df82346f436c`（历史基线；当前工作树包含未提交增量，未创建/移动发布标签）

本文件记录可复现的本地发布基线。未执行的目标服务器、HTTPS、安全组和真实设备项目明确标为“待环境签字”，不能用本地烟测结果代替。

## 2026-09-15 当前工作树复测（未发布）

- `npm run test:acceptance`：通过；新增纳入展示层事件审计，最终结果为所有可复现本机门禁通过。
- `npm test`：733/733；Firefox 模块/视觉夹具 28/28、96/96；性能清理、报告清单、发布元数据、生产形态部署和差异检查均通过。
- 依赖审计：0 vulnerabilities。覆盖率：语句/行 87.65%、分支 77.43%、函数 81.21%。
- 本轮修复包括入口脚本资源版本统一、Manila 短横屏布局溢出、Acquire CSS 尾部空白；Monopoly 报告与运行时 2–6 人范围已对齐。
- 当前仍是版本 `2.1.0` 的脏工作树，未创建 release commit/tag；已生成不发布的预览包 `dist/jsgames-2.1.0-preview-4cb35574c274.tar.gz`（634 个运行文件，SHA-256 `436df18453c7e1adb7a37d4fc6ddd4e85f11c4710ce72bb6f4f438d74d5ea62a`），并在独立目录完成生产安装/`/healthz` 200 烟测。Node 本地为 `v24.15.0`，Node 20.x/22.x 仍需在 CI 中复核。
- 目标服务器、HTTPS/安全组、真实设备、多浏览器人工签字、弱网恢复、素材许可证、规则未签署项和持久化/多实例能力仍为待环境签字或待开发，不得由本次本机 PASS 推导为发布通过。

## 工作区与依赖

| 项目 | 结果 |
| --- | --- |
| `package.json` / `package-lock.json` | 版本均为 `2.1.0`，锁文件格式 3 |
| Node 支持 | GitHub Actions 在 Node 20.x、22.x 执行门禁 |
| 依赖审计 | `npm run test:audit`：0 vulnerabilities |
| 基线提交 | `b39d198`（当前 HEAD；本轮拆分改动仍在工作区，正式版本标签仍待发布决策） |
| Git 卫生 | `tmp/`、环境变量、日志和密钥不在跟踪文件中 |

## 可重复门禁

在仓库根目录执行：

```bash
npm ci
npm run test:audit
npm run test:syntax
npm run test:presentation
npm test
npm run test:browser
npm run test:performance
npm run test:reports
npm run test:release
git diff --check
```

本次基线记录：

- `npm run test:syntax`：388 个文件通过。
- `npm test`：512/512 通过，0 失败。
- `npm run test:browser`：Firefox 模块、视口、房间生命周期、重连、隐私和输入门禁通过；当前本机未发现 Chromium 可执行文件，因此可选 Chromium 门禁未运行，真实移动设备仍未签字。
- `npm run test:performance`：静态资源预算、40 次请求、20 连接回收、6 房间/12 玩家回收通过；不等同于生产容量压测。
- `npm run test:reports`：28 款注册表、28 份游戏报告、当前报告入口和规则矩阵行数一致；生成 JSON 未落在 `TEST_REPORTS/` 根目录。
- `npm run test:release`：通过；发布模板、忽略规则和跟踪文件卫生满足当前门槛。
- `npm run test:deploy`：通过；生产形态 `bin/www` 启动、`/healthz`、安全头、WebSocket 建房和 SIGTERM 优雅退出均通过。
- `git diff --check`：通过。
- `npm run test:acceptance`：通过；按固定顺序串联以上本机门禁并完成最终差异检查。
- `npm run test:lint`：通过；ESLint 正确性基线无错误。
- `npm run test:type`：通过；当前渐进式 `checkJs` 范围无错误。
- `npm run test:complexity`：通过；大厅入口、实时服务、通用房间和两款高密度样式均未超过当前行数棘轮预算。
- 房间存储边界：`server/realtime/room-store.js` 的默认内存契约和注入校验通过；持久化后端、多实例广播和重启恢复仍未启用。
- `npm run test:coverage`：通过；语句/行 91.47%、分支 79.8%、函数 86.48%，高于当前门槛 60%/45%/60%。

2026-08-29 第 2、3 批本机收口补充：新增 `npm run test:acceptance` 聚合入口；实时服务默认启用同源/显式 Origin 校验、256 KiB WebSocket `maxPayload`、JSON 深度/字段限制、会话/IP/房间消息限流、聊天长度/控制字符校验、30 秒心跳、健康检查和带令牌的人工重连。自动化新增跨 Origin、超大帧、聊天洪泛、健康头和策略单测；真实浏览器/设备、目标服务器 HTTPS/安全组和外部素材许可证仍需环境签字。

2026-08-29 第 4 批本机部署收口：新增 `npm run test:deploy`，以生产环境变量启动真实 `bin/www`，检查健康响应、安全响应头、WebSocket 建房和 SIGTERM 优雅退出；它只证明本机启动链路，不替代目标服务器的 systemd、Nginx、HTTPS、DNS、安全组和容量签字。

2026-08-29 第 7 批最终本机预验收：仓库当前没有另存一份编号化的第 7 批定义，本次按最终交付前的本机可重复门禁执行 `npm run test:acceptance`。结果为通过：依赖审计 0 vulnerabilities、语法 388 个文件、lint/type/复杂度棘轮、回归 512/512、覆盖率、Firefox 28/28 模块与 96/96 视觉夹具、性能/清理、报告集合、发布审计、生产形态部署和 `git diff --check` 均通过。本条只代表本机预验收；本机当前未发现 Chromium 可执行文件，目标服务器、真实移动设备、多浏览器人工签字、HTTPS/安全组、素材许可证、规则签署或发布后观察仍需外部验收。

2026-08-29 架构收尾补充：猎巫镇、拉斯维加斯、大厅全局样式、花火和大富翁纸牌已按职责拆层并纳入资源清单及静态视觉验收页；大厅组合入口、实时服务房间/连接边界和 `Room` 棋谱模块边界由新增架构回归锁定。当前工作区尚未创建新的发布提交或标签。

## 发布前人工签字

- [ ] 目标服务器完成 `npm ci --omit=dev`、systemd、Nginx WebSocket Upgrade、HTTPS 和安全组检查。
- [ ] Firefox、Chromium、Safari 及至少一台 iOS/Android 真机完成大厅、公开/邀请房间和一局核心动作。
- [ ] 弱网、后台恢复、真实断线重连和多标签身份隔离完成记录。
- [ ] [`security.md`](./security.md) 的 Origin、消息限制、限流、重连令牌和安全响应头风险已关闭或获书面豁免。
- [ ] [`asset-license-clearance.md`](./asset-license-clearance.md) 的外部资源许可证逐项签字。
- [ ] 创建带注释标签（不移动旧 `v2.1.0`），记录提交 SHA、门禁输出、构建产物 SHA-256、发布人和回滚标签。

## 回滚纪律

保留上一个可运行标签和配置备份；发生启动失败、WebSocket 大面积断连、私密信息泄露或房间状态损坏时，停止流量切换并回滚到上一个标签，随后在本目录追加事故记录。生产部署细节见 [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md) 和 [`deploy/README.md`](../deploy/README.md)。
