# 四款封面调整 · 2026-09-10

使用 Codex 内置 image_gen 编辑。高清 1280×720 WebP，缩略图 640×360 WebP。旧版保留。

## junqi-v14

输入：junqi-v13.webp

初始提示词：

Use case: precise-object-edit. Edit target: attached current Chinese military chess game cover. Produce one polished 16:9 landscape cover, no title or logo. Preserve the existing desert sand-table realism, red versus dark teal upright rectangular military chess pieces, EXACT board topology, station rectangles, camps, railway lines, piece positions and existing Chinese lettering. Reframe the camera closer so the board and its pieces occupy about 85% of the frame width, with all board corners inside the image and a narrow desert margin. Reduce distracting foreground rocks and loose buried pieces. Strengthen board-line contrast and softly illuminate piece faces so 军旗, 工兵, 师长, 旅长, 地雷, 炸弹 are easier to read. Keep their exact existing characters, do not invent text. Restrained atmospheric dunes only in the far background; board is sharp and the main subject. Warm sand, rich oxblood and deep teal. Do not add pieces, do not redesign the board, no tanks, no soldiers, no floating symbols.

最终修正提示词（重新以原版为输入，弃用改变棋盘结构的初稿）：

Edit this image conservatively. This is a geometry-sensitive Chinese military chess board. Keep the EXACT original camera angle, original perspective, EVERY original board line, ALL 60 station locations, all ten circular camps, all four headquarters and all chess pieces in identical relative locations. Do not redraw or reinterpret board geometry. Only perform a modest uniform camera zoom / crop of approximately 1.15x centered on the board, leaving all four board corners visible; remove only unnecessary outer desert margins. Slightly brighten the red chess-piece faces and increase existing lettering contrast without altering any glyphs. Keep the cinematic desert sand and original warm realistic style. Output landscape 16:9. NO straightening, NO new camera angle, NO new board layout, NO added text, NO new pieces. Preserve original image content as faithfully as possible; small readability enhancement is more important than radical redesign.

最终生成原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-ffd4922f-5bfe-4e8f-93ed-8ee871c1d8c7.png

## monopoly-v3

输入：monopoly-v2.webp

初始提示词：

Use case: precise-object-edit. Edit target: attached Hong Kong circular Monopoly cover. Produce one polished 16:9 landscape cover, no titles or logos. Preserve the Hong Kong painterly cinema-poster texture, deep teal and gold palette, iconic circular property board floating in Victoria Harbour, colored property strips, red hotels and green houses. Simplify decisively: remove ALL portrait faces from the sky and replace with calm deep teal painted sky; simplify distant skyline to a few recognizable Hong Kong silhouettes with restrained lights; reduce tiny reflections and glitter by about two thirds. Inside the ring keep a small coherent group of about five prominent skyline buildings with breathing room rather than a dense forest. Make the wide cream property ring and clearly separated red hotels and green houses the main focal subject. Keep a small red tram as a secondary Hong Kong cue. Maintain grandeur and warm luminous board edge but avoid overexposure. Clear strong silhouette at thumbnail scale, visually restful background, no new text, no human figures.

最终生成原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-b277914b-c71e-476e-a974-9ad763374d5a.png

## xiangqi-v4

输入：xiangqi-v3.webp

初始提示词：

Use case: precise-object-edit. Edit target: attached Chinese xiangqi wooden chess cover. Produce one 16:9 landscape cover. Preserve its premium aged wooden board, authentic engraved Chinese round wooden pieces, red versus black calligraphy, quiet contemplative Chinese aesthetic and warm directional light. Improve readability: bring camera closer and somewhat lower so existing foreground 帅 and nearby 卒 pieces become larger visual anchors, retaining the river and opposing 将 visible further back. Keep board geometry, existing piece identities, count and arrangement intact under camera perspective. Lift dark shadows considerably, especially the lower half and right, brighten piece faces, make carved red characters saturated vermilion and black characters crisp ink black; balanced soft warm light, restrained cool shadows. Reduce edge vignette and needless background. Clear readable 楚河 and 汉界 on river. No additional text, title, logo, arrows, decorative objects or extra pieces. The large foreground red 帅 is the main focal point; all visible characters must be real and accurately rendered Chinese chess characters.

最终生成原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-1ff08ba1-6e02-47b6-a76b-354ad65a0b79.png

## checkers-v11

输入：checkers-v10.webp

初始提示词：

Use case: precise-object-edit. Edit target: attached Chinese checkers glass-marble wooden board cover. Produce one polished 16:9 landscape cover, no title or logo. Preserve the premium honey wood, red and teal translucent glass marbles, authentic six-pointed Chinese-checkers star with its regular triangular hole lattice, and two-player red/teal game character. Adjust camera to a much higher near-overhead three-quarter view, orient star with one point up and one down, show all six tips clearly with comfortable margin. Preserve the existing valid lattice topology and marble count (ten red and ten teal), marbles seated in holes. Improve composition so opposed colored marble groups read as a diagonal crossing encounter through the center, with clean distinct spacing. Make glass marbles slightly more visually prominent, rich ruby and petrol teal, refined specular highlights and delicate colored caustics; soften the contrast of EMPTY holes and connecting lines so they do not overwhelm marbles. Beautiful directional daylight and subtle cinematic depth, no plain ecommerce flat lighting, no excessive blur; star remains immediately recognizable. No extra colors, no floating marbles, no arrows or trails, no invented holes.

最终修正提示词（以上一轮生成图为输入）：

Precise single-object color correction on this image. The lone amber/gold glass marble near the TOP star tip, just below-left of the topmost teal marble, must be changed to the SAME deep petrol-teal translucent glass as the other teal marbles. This yields ten teal marbles and ten red marbles. Change ONLY that gold marble color and its immediate tiny caustic to teal. Preserve the entire rest of the image exactly: camera, board lattice, all hole positions, all marble positions and counts, red marbles, wood grain, lighting, framing. No other changes. Output same landscape 16:9.

最终生成原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-863bbbf1-ad35-4a7c-b118-e62dd2d7c70b.png

## 检查范围

逐张目视检查主体、文字与缩略图可读性。跳棋修正异色棋子，目视为红、青各十枚。军棋采用保守构图调整，保留十个行营和原有棋子分布；生成图不具备程序级棋盘几何保证。象棋沿用原图残局示意，未验证局面可达性。
