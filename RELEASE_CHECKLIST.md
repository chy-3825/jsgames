# jsgames 发布门禁

这份清单是发布前的固定顺序。它只描述检查和可回滚动作，不包含直接修改生产服务器的命令。

## 1. 工作区与版本

- [ ] 确认当前分支、目标提交和变更范围：`git status --short`、`git diff --stat`。
- [ ] 删除或忽略临时截图、日志和 `tmp/` 草稿；不要把本地浏览器 profile、测试输出或密钥提交到仓库。
- [ ] 修改 `package.json` 版本时同步 `package-lock.json`，并在提交信息中说明迁移/修复范围。
- [ ] 发布提交通过全部门禁后再创建带注释的版本标签；不在未验收提交上移动已有标签。

## 2. 本地门禁

在项目根目录执行：

```bash
npm ci
npm run test:audit
npm run test:syntax
npm test
npm run test:browser
# 可选但建议：CHROMIUM_BIN=/path/to/chromium npm run test:browser:chromium
npm run test:performance
git diff --check
```

`test:browser` 需要 Firefox；没有图形环境时使用无头 Firefox，或通过 `FIREFOX_BIN` 指定路径。若浏览器不可用，应把门禁标记为“未执行”，不能写成通过。
`test:browser:chromium` 使用 Chromium DevTools Protocol，复核模块导入、桌面/移动视口和隐私输入边界；通过 `CHROMIUM_BIN` 或 `CHROME_BIN` 指定可执行文件。它不能替代真实 Chromium/移动设备人工签字。
`test:performance` 是本地有界压力和资源清理烟测：会检查首屏/主脚本/样式/Three.js 体积、静态请求并发、短时大厅连接并发，以及多房间创建/加入/离开后的连接和房间回收；它不是生产容量压测，生产容量仍需在预发布环境按真实规格执行。

## 3. 发布前人工签字

- [ ] 在 Firefox、Chromium 和至少一种实际移动浏览器打开大厅，创建公开房间和仅邀请房间。
- [ ] 至少用两个真实浏览器标签完成一局：加入、开始、一个核心动作、离开、重新加入。
- [ ] 对花火、政变、阿瓦隆、狼人杀、猎巫镇等隐藏信息游戏确认私密牌面/身份不会出现在错误玩家视角、日志或 URL。
- [ ] 在 `390×844`、`667×375`、`844×390` 检查当前操作区可见；需要滚动的次要信息应能通过键盘和触屏访问。
- [ ] 记录浏览器版本、测试房间号、失败截图和对应提交，写入 `TEST_REPORTS/`。

`npm run test:browser` 已在 Firefox 中自动复核身份牌、花火牌背、谍报风云密钥的隐藏/按住显示/松开封存/失焦封存，以及移动视口的核心区域；这不能替代本节要求的 Chromium、真实移动浏览器和真实网络断线人工签字。

## 4. 预发布与生产

- [ ] 在预发布环境运行 `npm ci --omit=dev`（当前项目无运行时 dev 依赖，但保留该命令作为安装纪律）。
- [ ] 按 [`deploy/README.md`](./deploy/README.md) 校验 systemd、Nginx WebSocket Upgrade、HTTPS 和安全组；应用端口只允许本机/内网访问。
- [ ] 通过 `systemctl is-active`、`ss -ltnp`、HTTP 首页和 WebSocket 创建房间四项检查后再切换流量。
- [ ] 保留上一个可运行标签和数据库/配置备份；出现启动、WebSocket 或私密信息故障时回滚到上一标签并记录原因。

## 5. 发布后观察

- [ ] 观察 systemd 日志、连接数、房间创建和断线重连至少一个完整游戏周期。
- [ ] 确认没有异常增长的临时房间、重复广播或未清理的 WebSocket 连接。
- [ ] 将人工验收结果、发布提交、标签和已知限制补到 `TEST_REPORTS/README.md`。
