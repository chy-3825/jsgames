# 生产化部署模板

这两个 `.example` 文件只提供配置模板，不会自动修改服务器。安装前请把服务文件中的用户、工作目录和 Node 路径替换为实际值，并确认应用目录由该用户可读。

## systemd

```sh
sudo install -o root -g root -m 0644 deploy/jsgames.service.example /etc/systemd/system/jsgames.service
sudo systemctl daemon-reload
sudo systemctl enable --now jsgames
sudo systemctl status jsgames --no-pager
```

确认 `systemctl status` 正常后，用 `journalctl -u jsgames -e` 查看启动日志。生产环境默认只监听本机 `127.0.0.1:3000`，也可通过 `JSGAMES_HOST` 显式设置监听地址，由 Nginx 对外提供入口。

## Nginx 与 WebSocket

把 `deploy/nginx-jsgames.conf.example` 放入 Nginx 的 `http` 配置包含范围内；如果发行版只允许 `server` 配置放在 `sites-enabled`，请把 `map` 块放入 `/etc/nginx/nginx.conf` 的 `http {}`，再把 `server` 块放入站点文件。

```sh
sudo nginx -t
sudo systemctl reload nginx
```

`Upgrade`、`Connection` 和长连接超时配置是大厅 WebSocket 正常工作的必要条件。配置域名后应使用 HTTPS；证书可由 Certbot 或云平台证书服务托管。

Node 服务启动前应通过 systemd 的环境文件或等效安全配置设置明确的来源白名单，例如
`JSGAMES_ALLOWED_ORIGINS=https://table.example`。应用默认启用 256 KiB WebSocket 负载上限、JSON 结构检查、会话/IP/房间限流、聊天限制、心跳和重连令牌；不要在公网把 `JSGAMES_REQUIRE_RECONNECT_TOKEN` 设为 `false`。`/healthz` 返回进程版本、房间和连接计数，供反代或监控探活使用。

当前房间存储默认由 `server/realtime/room-store.js` 提供进程内存实现；它会在进程重启后丢失对局。没有完成持久化适配器、共享广播和故障演练前，只部署单个 Node 进程，禁止直接增加 systemd 实例或做无粘性的水平扩容。

## 云平台安全组

生产反代方案只需放行 TCP 80/443，并限制 TCP 3000 仅允许本机或内网访问。若暂时不使用 Nginx、直接对外测试 Node，则需显式设置 `JSGAMES_HOST=0.0.0.0`，并为实例安全组增加 IPv4 TCP 3000 入站规则；测试结束后应撤销该公网端口。

上线后检查：

1. `systemctl is-active jsgames` 返回 `active`。
2. `ss -ltnp` 显示 Node 监听 3000，Nginx 监听 80/443。
3. 浏览器可以创建房间、加入房间并保持 WebSocket 连接。
4. 云安全组只保留实际需要的端口；服务器凭据已轮换并改用 SSH 密钥。
5. `curl -fsS https://你的域名/healthz` 返回 `status: ok`，并确认响应包含 HSTS、CSP、`X-Content-Type-Options` 等安全头。

## 朋友内测包

在开发机运行 `npm run package:preview`，会将当前工作区的运行文件（包括尚未 Git 跟踪的新模块）打包到 `dist/`，并生成 SHA-256 校验文件。包内 `RELEASE_MANIFEST.json` 记录每个运行文件的哈希，便于固定、核对和回滚这一版。该命令不会提交 Git 或上传服务器。

将压缩包解到服务器的独立版本目录，执行 `npm ci --omit=dev`，再按上面的 systemd/Nginx 配置启动。保留上一版压缩包和独立配置。包不含 `node_modules`、测试脚本、评审页面、历史封面、Git 或本地环境变量；开发评审页面在生产模式下也返回 404。

本轮仍使用单进程内存房间：重启、更新或进程崩溃都会结束当前对局；应在朋友结束对局后维护。断线重连仅用于同一进程仍运行时的短时网络恢复，不能恢复服务器重启前的对局。

依赖通过 npm overrides 将 `qs` 固定到 `6.16.0`，修复本轮审计问题且保留 Express 4；未来升级 Express 时应复核并移除不再需要的覆盖。
