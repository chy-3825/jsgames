# 政变：封面风格角色卡（2026-09-18）

五张角色插画与共用卡背由内置 imagegen 工具生成，以 `public/assets/covers/coup-v2.webp` 为风格参考。原始生成图保存在本机 imagegen 输出目录；本目录保存接入游戏的 JPEG 文件（1024 × 1536）。文字由 HTML 渲染，图片不包含规则或文字。

## 提示词集

共同提示：Use case: stylized-concept. Create ONE portrait 2:3 full bleed game card illustration for Coup. Reference image is STYLE reference: sophisticated Art Deco geometric angular flat illustration, matte black, antique gold, ivory and restrained oxblood red, subtle lithographic paper grain. Waist-up central portrait, head fully visible with top margin, face in upper third, strong distinctive silhouette legible at tiny sizes. Lower quarter simpler darker clothing for UI text overlay. No typography, letters, numbers, watermark, rounded corners, mockup, neon, photographic realism or fantasy armor. Refined political intrigue poster aesthetic, coherent with cover.

- `duke.jpg`：Imposing suited political aristocrat, slick dark hair, steepled gloved hands, angular gold-lit face, abstract stepped government architecture behind.
- `assassin.jpg`：Enigmatic lean figure in high-collared black tailored coat, three-quarter profile, short swept hair, gloved hand holding a small discreet dagger upright near chest, dramatic diagonal shadow, oxblood angular backdrop.
- `captain.jpg`：Confident naval officer wearing a structured peaked cap and double-breasted coat with restrained gold epaulettes, broad shoulders, angular harbor and ship silhouette behind, one hand on belt.
- `ambassador.jpg`：Mature silver-haired diplomat in elegant formal suit, composed three-quarter pose, holding a sealed diplomatic envelope, stepped embassy architecture and ivory background.
- `contessa.jpg`：Poised aristocratic woman with sculptural dark updo, elegant black evening jacket with angular ivory lapels, discreet gold earring, raised gloved hand holding a closed fan protectively across torso, dark red sun and architectural backdrop.
- `back.jpg`：Absolutely no people or faces. Symmetrical geometric Art Deco emblem of a stepped tower within a diamond, antique gold linework, black and oxblood radiating architectural shapes, balanced ivory detailing. Identical appearance rotated 180 degrees. Full card ornamental composition.（卡背不采用人物构图段落。）

入口：`public/__coup_cards_visual_test.html`。游戏中的手牌、隐藏牌、牌库、声明、阻挡、角色说明及播报共用这套资源。
