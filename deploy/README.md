# 生产化部署模板

这两个 `.example` 文件只提供配置模板，不会自动修改服务器。安装前请把服务文件中的用户、工作目录和 Node 路径替换为实际值，并确认应用目录由该用户可读。

## systemd

```sh
sudo install -o root -g root -m 0644 deploy/jsgames.service.example /etc/systemd/system/jsgames.service
sudo systemctl daemon-reload
sudo systemctl enable --now jsgames
sudo systemctl status jsgames --no-pager
```

确认 `systemctl status` 正常后，用 `journalctl -u jsgames -e` 查看启动日志。应用只监听本机 `127.0.0.1:3000` 或 `*:3000`，由 Nginx 对外提供入口。

## Nginx 与 WebSocket

把 `deploy/nginx-jsgames.conf.example` 放入 Nginx 的 `http` 配置包含范围内；如果发行版只允许 `server` 配置放在 `sites-enabled`，请把 `map` 块放入 `/etc/nginx/nginx.conf` 的 `http {}`，再把 `server` 块放入站点文件。

```sh
sudo nginx -t
sudo systemctl reload nginx
```

`Upgrade`、`Connection` 和长连接超时配置是大厅 WebSocket 正常工作的必要条件。配置域名后应使用 HTTPS；证书可由 Certbot 或云平台证书服务托管。

## 云平台安全组

生产反代方案只需放行 TCP 80/443，并限制 TCP 3000 仅允许本机或内网访问。若暂时不使用 Nginx、直接对外测试 Node，则需要为实例安全组增加 IPv4 TCP 3000 入站规则；测试结束后应撤销该公网端口。

上线后检查：

1. `systemctl is-active jsgames` 返回 `active`。
2. `ss -ltnp` 显示 Node 监听 3000，Nginx 监听 80/443。
3. 浏览器可以创建房间、加入房间并保持 WebSocket 连接。
4. 云安全组只保留实际需要的端口；服务器凭据已轮换并改用 SSH 密钥。
