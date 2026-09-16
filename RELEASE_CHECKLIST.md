# jsgames 发布门禁

这份清单是发布前的固定顺序。它只描述检查和可回滚动作，不包含直接修改生产服务器的命令。

## 2026-09-15 当前验收状态

- [x] 本机聚合门禁：`npm run test:acceptance` 通过；回归 733/733，Firefox 28/28 模块、96/96 视觉夹具，性能清理、报告、发布元数据、生产形态部署和差异检查通过。
- [x] 展示层事件审计已接入聚合门禁和 GitHub Actions，并通过 17 个专项/通用路径检查。
- [x] 入口资源版本、Manila 短横屏布局和 Acquire CSS 尾部空白已修复并复测。
- [x] 已生成不发布的 634 文件预览包，并在独立目录完成 `npm ci --omit=dev --ignore-scripts`、依赖审计和生产 `/healthz` 烟测。
- [ ] Chromium、Safari、真实 iOS/Android、目标服务器、HTTPS/安全组、弱网和发布后观察：未执行，不能标记为通过。
- [ ] 素材许可证、规则矩阵未签署项、持久化/多实例、仅邀请访问控制和干净发布提交：仍需人工签字或后续开发。

本状态只适用于当前工作树，版本仍为 `2.1.0`，没有创建新的 release commit/tag；因此整体发布结论仍为“有条件通过”，不是公开发布 GO。

## 1. 工作区与版本

- [ ] 确认当前分支、目标提交和变更范围：`git status --short`、`git diff --stat`。
- [ ] 删除或忽略临时截图、日志和 `tmp/` 草稿；不要把本地浏览器 profile、测试输出或密钥提交到仓库。
- [ ] 修改 `package.json` 版本时同步 `package-lock.json`，并在提交信息中说明迁移/修复范围。
- [ ] 发布提交通过全部门禁后再创建带注释的版本标签；不在未验收提交上移动已有标签。

## 2. 本地门禁

在项目根目录执行。先执行一次 `npm ci`，然后选择逐项门禁或等价的聚合入口：

```bash
npm ci
npm run test:audit
npm run test:syntax
npm run test:lint
npm run test:type
npm run test:presentation
npm test
npm run test:coverage
npm run test:complexity
npm run test:browser
CHROMIUM_BIN=/path/to/chromium npm run test:browser:chromium
npm run test:performance
npm run test:reports
npm run test:release
npm run test:deploy
git diff --check
# 方式 B：上述本地门禁的可复现聚合入口（与方式 A 等价，不要重复执行）
# npm run test:acceptance
```

需要聚合执行时，取消最后一行注释并跳过其上的逐项命令。

`test:browser` 需要 Firefox；没有图形环境时使用无头 Firefox，或通过 `FIREFOX_BIN` 指定路径。若浏览器不可用，应把门禁标记为“未执行”，不能写成通过。
`test:browser:chromium` 使用 Chromium DevTools Protocol，复核模块导入、桌面/移动视口和隐私输入边界；通过 `CHROMIUM_BIN` 或 `CHROME_BIN` 指定可执行文件。它不能替代真实 Chromium/移动设备人工签字。
`test:performance` 是本地有界压力和资源清理烟测：会检查首屏/主脚本/样式/Three.js 体积、静态请求并发、短时大厅连接并发，以及多房间创建/加入/离开后的连接和房间回收；它不是生产容量压测，生产容量仍需在预发布环境按真实规格执行。
`test:release` 检查 `package.json` 与锁文件版本、必需发布脚本、systemd/Nginx 模板的本机反代与最小权限约束，以及 Git 跟踪文件中是否混入临时目录、环境变量或密钥/日志；它不能代替目标服务器上的 systemd、Nginx、HTTPS 和安全组实机检查。
`test:deploy` 以 `NODE_ENV=production` 启动真实 `bin/www`，检查 `/healthz`、安全响应头、一次 WebSocket 建房和 SIGTERM 优雅退出；它不能代替目标服务器上的 systemd、Nginx、HTTPS、DNS 或安全组检查。
`test:lint`、`test:type` 和 `test:coverage` 分别执行 ESLint 正确性检查、渐进式 JavaScript 类型检查和覆盖率阈值检查；类型范围会随模块完成度逐批扩大，不能把未纳入范围误写成全项目类型安全。
`test:complexity` 对大厅组合入口、实时服务、通用房间和两款高密度样式执行行数增长门禁；它是防回归的复杂度棘轮，不替代后续按职责继续拆分文件。
`test:acceptance` 是本机最终验收聚合入口，会依次执行依赖、语法、lint、类型、展示层事件审计、复杂度、回归、覆盖率、Firefox、性能/清理、报告、发布和生产形态部署门禁，并最后执行 `git diff --check`；它不自动执行 `npm ci`、Chromium 可选门禁或任何目标环境操作。

生产启动前至少设置 `JSGAMES_ALLOWED_ORIGINS=https://你的域名`；保持默认的 WebSocket 负载、JSON 结构、消息/聊天限流、心跳和重连令牌策略。只有在受控本地兼容测试时才允许设置 `JSGAMES_REQUIRE_RECONNECT_TOKEN=false`，不得带入公网环境。

## 3. 发布前人工签字

- [ ] 在 Firefox、Chromium 和至少一种实际移动浏览器打开大厅，创建公开房间和仅邀请房间。
- [ ] 至少用两个真实浏览器标签完成一局：加入、开始、一个核心动作、离开、重新加入。
- [ ] 对花火、政变、阿瓦隆、狼人杀、猎巫镇等隐藏信息游戏确认私密牌面/身份不会出现在错误玩家视角、日志或 URL。
- [ ] 在 `390×844`、`667×375`、`844×390` 检查当前操作区可见；需要滚动的次要信息应能通过键盘和触屏访问。
- [ ] 记录浏览器版本、测试房间号、失败截图和对应提交，写入 `TEST_REPORTS/`。

`npm run test:browser` 已在 Firefox 中自动复核身份牌、花火牌背、谍报风云密钥的隐藏/按住显示/松开封存/失焦封存、传输断线后自动恢复原座位，以及移动视口的核心区域；这不能替代本节要求的 Chromium、真实移动浏览器和真实网络断线人工签字。

## 4. 预发布与生产

- [ ] 在预发布环境运行 `npm ci --omit=dev`（当前项目无运行时 dev 依赖，但保留该命令作为安装纪律）。
- [ ] 按 [`deploy/README.md`](./deploy/README.md) 校验 systemd、Nginx WebSocket Upgrade、HTTPS 和安全组；应用端口只允许本机/内网访问。
- [ ] 确认只运行单个实时进程；若要多实例，先完成 `room-store` 持久化、共享广播、粘性/路由策略和故障演练。
- [ ] 通过 `systemctl is-active`、`ss -ltnp`、HTTP 首页和 WebSocket 创建房间四项检查后再切换流量。
- [ ] 保留上一个可运行标签和数据库/配置备份；出现启动、WebSocket 或私密信息故障时回滚到上一标签并记录原因。

## 5. 发布后观察

- [ ] 观察 systemd 日志、连接数、房间创建和断线重连至少一个完整游戏周期。
- [ ] 确认没有异常增长的临时房间、重复广播或未清理的 WebSocket 连接。
- [ ] 将人工验收结果、发布提交、标签和已知限制补到 `TEST_REPORTS/README.md`。
