# 游戏大厅专项验收

- WebSocket registry 返回 26 个联机项目（情书默认使用 BGG 美术版）；狼人杀线下辅助使用正常房间创建、加入和状态广播流程。
- 两条独立 WebSocket 连接分别获得不同的 `playerId` 和 `sessionToken`；前端会话令牌已从 `localStorage` 改为 `sessionStorage`，同源的两个浏览器窗口不会再互相接管身份。玩家昵称仍按用户意愿保存在本地。
- 断线/Promise 异常提示现在带“知道了”按钮，不会永久遮挡大厅；错误提示仍记录到大厅日志。
- 静态 HTTP 检查通过：`/`可访问；大厅游戏数量显示为 26，已不再暴露 `/werewolf-dealer.html`。
- 结果：大厅入口、身份隔离、狼人杀房间和错误提示通过专项验收。
