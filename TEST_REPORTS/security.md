# 安全验收与发布前风险清单

更新日期：2026-08-29。范围：大厅 HTTP/WebSocket、房间会话、私密信息、依赖和发布配置。本文记录当前证据与未完成项，不把“依赖无漏洞”写成应用整体安全通过。

## 已有证据

- `npm run test:audit`：当前高危依赖审计为 `0 vulnerabilities`。
- `npm run test:release`：版本/锁文件同步、Git 跟踪文件无 `.env`/密钥/日志、systemd/Nginx 模板包含最小权限和 WebSocket Upgrade 约束。
- `npm run test:deploy`：生产形态启动、`/healthz`、安全头、WebSocket 建房和 SIGTERM 优雅退出通过。
- `npm run test:browser`：同标签会话隔离、在线玩家 ID 重复进入拒绝、断线令牌恢复、隐藏身份按住显示/失焦封存、花火牌背和谍报风云密钥边界通过。
- `npm test`：实时安全策略新增跨 Origin、超大帧、JSON 形状、聊天清洗/洪泛、健康检查响应头和带令牌重连覆盖。
- `npm run test:acceptance`：按固定顺序执行本机依赖、语法、回归、Firefox、性能/清理、报告、发布和生产形态部署门禁。
- 房间和各游戏引擎在服务端重复校验人数、房主权限、回合、动作参数和私密视角；客户端不能单独决定胜负或公开私牌。

## 公网发布前状态与要求

| 风险 | 当前观察 | 发布要求 |
| --- | --- | --- |
| WebSocket Origin | 默认仅接受请求自身 Origin；可由 `JSGAMES_ALLOWED_ORIGINS` 或工厂选项配置显式白名单；无 Origin 的原生 ws 客户端保留用于本地脚本 | 预发布/生产设置明确的 HTTPS Origin，并记录反代域名；本地开发使用同源或显式开关 |
| 消息大小 | `maxPayload` 默认 256 KiB；JSON 深度、累计字段数量和字符串长度也有限制，超限关闭连接 | 根据生产状态包观测调小/调大阈值；记录关闭原因并在预发布复测 |
| 连接与消息频率 | 已有每 IP 并发上限、会话/IP/房间消息窗口和拒绝计数；30 秒 ping/pong 清理失活连接 | 预发布按真实规格校准阈值；仍需补独立的空闲业务超时和监控告警 |
| 聊天输入 | 服务端限制 500 字符、去除控制字符/空白归一化并按连接限流；客户端日志使用 `escapeHtml` | 按公网用户量校准频率；继续保持纯文本渲染，不信任 HTML |
| 重连凭证 | `reconnectRoom` 默认要求原 `sessionToken`，并使用常量时间比较；缺少令牌或令牌不匹配时拒绝。可用 `JSGAMES_REQUIRE_RECONNECT_TOKEN=false` 仅为受控本地兼容场景关闭 | 生产不得关闭令牌要求；评估升级为一次性短期令牌并避免在日志/截图中暴露令牌 |
| HTTP 安全头 | 应用统一发送 CSP（当前为兼容视觉夹具保留 `unsafe-inline`）、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`；HTTPS 请求附加 HSTS，并禁用 `X-Powered-By` | 生产将视觉夹具脚本外置后移除 `unsafe-inline`；确认 Nginx HTTPS、HSTS 域名范围和 CSP 资源清单 |
| 进程与状态 | 已补 `/healthz`、SIGTERM/SIGINT 收尾和 WebSocket 心跳；房间/会话仍为进程内存，重启会丢失对局 | 上线前决定“单实例可丢局”还是引入持久化；把健康结果接入监控并补空闲业务超时 |
| 多实例 | 实时服务现通过 `server/realtime/room-store.js` 注入 Map 形状的房间存储；默认仍是进程内存，没有共享房间存储或粘性会话 | 禁止直接水平扩容；先选定 Redis/数据库等后端，补原子写入、快照版本、广播路由、RPO/RTO 和故障演练 |

## 验收方法

已自动覆盖：跨 Origin 握手、超大帧、畸形/深层 JSON、聊天洪泛、XSS 字符串规范化、无令牌重连、健康检查和安全响应头。仍需补充或在预发布验证：连接洪泛、过期/重复令牌、关闭期间新连接、心跳超时、空闲业务超时，以及真实阈值、返回码、关闭原因和服务器资源记录。

## 当前结论

本地依赖、消息边界、Origin、重连凭证、基础响应头、健康检查和权限/隐私回归通过；应用层仍有生产阈值校准、空闲业务超时、多实例状态策略、预发布监控以及人工环境验证，当前不能签署“公网安全全部完成”。每项外部验证完成后，应把证据链接和提交号补回本报告及 [`release-baseline.md`](./release-baseline.md)。
