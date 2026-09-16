# 跳棋 v13：从合法行棋生成布局

使用项目跳棋引擎从标准双人开局走出 22 手（双方各 11 手），包含 9 次两跳或以上的连续跳跃。以确定性启发式选择推进走法，不是人类棋谱或最优策略。

position.cjs 保存并重新通过 handleAction 回放全部动作；position.json 保存棋子坐标及完整走法。render.html 使用引擎 121 个棋位与最终 20 枚棋子生成 Three.js 底稿 layout.png。运行：在仓库根目录执行 node review/checkers-cover/position.cjs，然后 node review/checkers-cover/render.cjs。

内置 image_gen 仅要求润色材质、背景与光线。最终逐枚目视比对颜色和所属棋位，与底稿一致；布局源数据可回放验证，生成图的像素几何仍属于目视检查范围。

最终原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-f8d66a7c-d131-4c5d-82bd-797a391e976e.png

成品：public/assets/covers/checkers-v13.webp；缩略图：public/assets/covers/thumbs/checkers-v13.webp。保留旧版。

## 完整提示词

Use case: style-transfer, geometry-locked surface finishing. Edit target is the attached exact 3D rendering of a LEGAL Chinese checkers game after 22 alternating moves. ALL 20 marble positions and colors, all 121 holes, the entire triangular grid, camera pose, framing and board outline MUST be preserved exactly. Do not rearrange, add, remove, resize or recolor marbles. Do not invent a new composition. TOP group is petrol teal; bottom group ruby red; specific advanced marbles crossing the center MUST remain exactly in their supplied holes, not redistributed. Transform only surface appearance: premium honey-colored wooden board with subtle natural grain, empty holes as shallow round dark recesses, delicate engraved lines, richly translucent ruby and petrol-teal glass marbles with realistic bright small highlights, smooth refraction and contact shadows. Add a thin dark walnut edge to the existing board boundary without moving it. Quiet textured warm-gray stone tabletop background. Warm soft afternoon daylight from upper left, graceful long soft shadows, natural believable photograph of a real game left on a table. No extra game props, hands, words, numbers, arrows, trails, decorations, symmetry correction or aesthetics-driven arrangement. Preserve the EXACT provided physical scene and projected marble centers; improve only materials and lighting. Landscape 16:9 full bleed premium game cover.
