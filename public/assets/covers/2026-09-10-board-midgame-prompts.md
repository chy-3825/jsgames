# 跳棋与五子棋：对局感修正

采用内置 image_gen 编辑。旧版问题：跳棋两条整齐斜线过于装饰化；五子棋黑五连、白棋分散且金色连线呈现规则示意而非攻防过程。

新版以不对称的中盘布局为目标。目视核对跳棋红青各十枚，五子棋黑白各十枚，黑四连两端有白棋封堵。生成图未作逐步棋谱可达性验证，不将提示词坐标视为最终像素的严格保证。

## checkers-v12

原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-19d55bea-78c5-4567-9004-3eaf7c2a81ee.png

初始提示词：

Use case: precise-object-edit. Edit target: Chinese checkers cover. Keep the wooden six-pointed star board, authentic regular 121-hole triangular lattice, camera angle, two glass marble colors and warm photographic light. REPLACE THE ENTIRE MARBLE ARRANGEMENT. Current two straight diagonal color queues are wrong and must disappear completely. Show a believable lively midgame with EXACTLY TEN RUBY RED and TEN PETROL TEAL marbles, each centered in a distinct existing hole, no extra colors. Red started at bottom star tip, teal at top. Red distribution: three stragglers in separate bottom-arm holes, five scattered asymmetrically across central hexagon progressing upward (two left of center, two right of center, one center), two advanced red pieces just inside upper target arm. Teal distribution: three stragglers in upper arm, five irregularly spaced through central hexagon going downward interleaved with red, two advanced teal pieces just inside lower target arm. This means BOTH top and bottom triangles contain SOME red AND SOME teal at different holes. Show gaps, lateral detours, small mixed-color clusters and one plausible jump bridge: an occupied hole flanked by one occupied start hole and an empty landing hole along a lattice direction. Do not draw the jump. Visual must feel like a photographed real game paused after many alternating moves. No more than three same-color marbles in ANY straight line. NO parallel queues, NO two clean color-separated halves, NO symmetry, NO decorative patterns, NO full starting formations. Preserve lattice and wood, do not invent new holes to accommodate pieces. Strong rich translucent marble material, grounded contact shadows. Full landscape 16:9. No words, arrows, motion trails, glowing paths, hands, logos.

数量修正提示词：

Precise single-object removal. Remove ONLY the isolated red glass marble at the far RIGHT side of the central hexagon, approximately 66% of image width and 52% of image height (just left of an empty hole near the right edge, above the two lower-central red marbles). Restore its underlying normal empty board hole, wood and grid lines. There are currently eleven red marbles; after this removal there must be exactly TEN RED and TEN TEAL marbles. Preserve every other marble and every other pixel composition, especially the interleaved midgame arrangement. No moving or recoloring other pieces. Same 16:9.

## gobang-v3

原图：/home/chy/.codex/generated_images/01a08a16-0b62-7110-b95b-867321437dd7/exec-94886b1b-7db3-40da-9760-186f9dba13b3.png

初始提示词：

Use case: precise-object-edit. Redesign stone arrangement and reframe this Go-moku cover to show a REAL contested unfinished game. Preserve the refined ink-wash misty garden, bamboo, weathered warm wooden board and quiet black-white aesthetic. Remove the gold glowing line COMPLETELY. Bring wooden board into the main foreground with a higher camera angle, occupying roughly right 75% of image; keep atmospheric garden at left as a soft supporting background. Accurate regular square intersection grid, thin crisp straight lines; black and ivory-white stones centered precisely on intersections, never in cell interiors. Replace existing nine stones with EXACTLY TWENTY stones: TEN BLACK and TEN WHITE, clustered in a believable irregular central tactical position with adjacent opposing blocks and shorter developing lines. Use this exact local 9x9 coordinate arrangement, rows top-to-bottom and columns left-to-right before applying perspective, embedded within the larger board; numbers are instructions ONLY and MUST NOT be printed. Black coordinates (row,column): (5,3),(5,4),(5,5),(5,6),(4,4),(3,3),(6,5),(7,6),(4,7),(6,3). White coordinates: (5,2),(5,7),(2,2),(6,6),(4,5),(6,4),(3,5),(4,6),(7,4),(3,7). This creates a horizontal four-black line blocked by white at both ends, several short diagonal relationships and closely interleaved defense; neither player has five in a row. All 20 stones same realistic diameter just below grid spacing; stones must be visibly BLACK versus WHITE, no extra stones, no golden stones. Asymmetrical close tactical struggle, not a neat decorative line, not an opening setup, not a completed victory. Soft daylight on stones, clear visual contrast, gentle realistic contact shadows. No diagrams or overlay, no labels, no gold connection, no title, no hands, no watermark. Landscape 16:9.

数量修正提示词：

Precise additive edit to fix alternating-turn piece counts. Preserve entire image, all ten black stones and all seven white stones already present, camera and board grid. Add exactly THREE new WHITE ivory stones to empty grid INTERSECTIONS, equal size and lighting to existing white stones. Add one at the EMPTY intersection immediately above the black stone that sits directly above the horizontal four-black chain (roughly x=63%, y=38%); one at the empty intersection immediately below-left of the leftmost lower black stone (roughly x=56%, y=72%); one at the empty intersection directly above the right-hand end of the four-black chain, between existing upper-right black stone and the central upper white stone (roughly x=74%, y=39%). Snap additions to actual nearest free grid crossings. Final total must be TEN BLACK and TEN WHITE, no removal or recoloring. Black horizontal four stays blocked by white on both ends; no five-in-a-row victory. Preserve garden, bamboo, wood, existing exact composition. No gold line, no additional text or overlays. Same 16:9.
