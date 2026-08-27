import * as THREE from '/vendor/three/build/three.module.js';

const WIDTH = 5;
const HEIGHT = 12;
const CAMPS = [[1, 2], [3, 2], [2, 3], [1, 4], [3, 4], [1, 7], [3, 7], [2, 8], [1, 9], [3, 9]];
const HEADQUARTERS = { blue: [[1, 0], [3, 0]], red: [[1, 11], [3, 11]] };
const RAIL_ROWS = [1, 5, 6, 10];
const PIECE_BASE_Y = -.037;
// Keep the logical 5x12 grid, but use a wider physical presentation so the
// board reads like a real army-chess board instead of a narrow runway.
const WORLD_X = 1.76;
const WORLD_Z = .98;
const CAMP_RADIUS_X = .42;
const CAMP_RADIUS_Z = .294; // 5:3.5, matching the 2D piece silhouette.
const CAMP_SVG_RX = 35;
const CAMP_SVG_RY = 24.5;
const STATION_HALF_X = .462;
const STATION_HALF_Z = .307;
const HQ_HALF_X = .616;
const HQ_HALF_Z = .323;
const HQ_SVG_HALF_X = 49;
const HQ_SVG_HALF_Y = 27;
const BOARD_TOP = -.11;
const BOARD_LINE_Y = BOARD_TOP + .006;
const BOARD_DETAIL_Y = BOARD_TOP + .014;
const PIECE_BODY_Y = .20;
// Slightly slimmer standing tiles keep the route network readable when all
// fifty pieces are on the board.
const PIECE_BODY_WIDTH = .80;
const PIECE_BODY_HEIGHT = .54;
const PIECE_BODY_DEPTH = .27;
// cameraPitch is measured from the board normal; .96 rad gives roughly a
// 35° tabletop viewing angle, so the standing piece faces remain readable.
const DEFAULT_CAMERA_PITCH = .96;
const DEFAULT_CAMERA_DISTANCE = 22.5;
const LABELS = { commander: '司令', army: '军长', division: '师长', brigade: '旅长', regiment: '团长', battalion: '营长', company: '连长', platoon: '排长', engineer: '工兵', mine: '地雷', bomb: '炸弹', flag: '军旗', unknown: '军棋' };
const SHORT_LABELS = { commander: '司', army: '军', division: '师', brigade: '旅', regiment: '团', battalion: '营', company: '连', platoon: '排', engineer: '工', mine: '雷', bomb: '炸', flag: '旗', unknown: '?' };

function isRailEdge(x1, y1, x2, y2) {
    if (Math.abs(x2 - x1) + Math.abs(y2 - y1) !== 1) return false;
    if (y1 === y2 && RAIL_ROWS.includes(y1)) return true;
    if (x1 === x2 && (x1 === 0 || x1 === WIDTH - 1) && y1 >= 1 && y1 <= 10 && y2 >= 1 && y2 <= 10) return true;
    return x1 === x2 && x1 === 2 && ((y1 === 5 && y2 === 6) || (y1 === 6 && y2 === 5));
}

function isCampSquare(x, y) { return CAMPS.some(([campX, campY]) => campX === x && campY === y); }
function isHeadquartersSquare(x, y) { return Object.values(HEADQUARTERS).some(squares => squares.some(([hqX, hqY]) => hqX === x && hqY === y)); }

export function createGameClient({ mount, send, addLog }) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/games/junqi/style.css?v=20260826-mobile-games-2';
    document.head.appendChild(style);
    mount.innerHTML = `<section class="junqi3d-app">
        <header class="junqi3d-header"><div class="junqi3d-title"><span class="junqi3d-title-mark">軍</span><div><strong>军棋</strong><small>双人暗棋对战</small></div></div><div class="junqi3d-actions"><span data-role="room">房间</span><button data-ui="viewMode" data-role="viewModeButton" type="button">切换 2D</button><button data-ui="reset" data-role="resetButton" type="button">复位视角</button><button data-ui="rules" type="button">完整规则</button></div></header>
        <main class="junqi3d-main">
            <aside class="junqi3d-side blue" data-role="blueSide"><section class="junqi3d-player-card" data-role="bluePlayer"></section><section class="junqi3d-chronicle" data-role="chronicle"><header><strong>战场记录</strong><span>最近行动</span></header><div class="junqi3d-log" data-role="log"></div></section></aside>
            <section class="junqi3d-stage"><div class="junqi3d-viewport" data-role="viewport"><canvas data-role="canvas" aria-label="三维军棋棋盘"></canvas><div class="junqi2d-board" data-role="board2d" aria-label="二维军棋棋盘" hidden></div><div class="junqi3d-stage-status" data-role="stageStatus"></div><section class="junqi3d-battle" data-role="battle" hidden></section><div class="junqi3d-hint" data-role="hint">选择自己的棋子</div></div><div class="junqi3d-captured" data-role="captured"><span>战损</span><div data-role="capturedRed"></div><i></i><div data-role="capturedBlue"></div></div></section>
            <aside class="junqi3d-side red" data-role="redSide"><section class="junqi3d-player-card" data-role="redPlayer"></section><section class="junqi3d-brief"><header><strong>最近战况</strong><span>公开信息</span></header><div class="junqi3d-last-move" data-role="lastMove"></div></section></aside>
        </main>
        <section class="junqi3d-setup is-hidden" data-role="setupPanel"><div class="junqi3d-setup-head"><div><strong>暗棋布阵</strong><small>选择军阶后点击空位；点击棋盘棋子可直接改位或交换</small></div><span data-role="setupProgress">0 / 25</span></div><div class="junqi3d-setup-tray" data-role="setupTray"></div><div class="junqi3d-setup-rules"><span>旗驻大本营</span><span>雷在后两排</span><span>炸弹不在前排</span></div><div class="junqi3d-setup-actions"><button type="button" data-ui="setupReset">清空重摆</button><button type="button" class="is-primary" data-ui="setupReady">确认布阵</button></div></section>
        <footer class="junqi3d-footer"><div class="junqi3d-turn" data-role="turn"></div><div class="junqi3d-footer-guide" data-role="footerGuide">点击棋子查看合法位置</div><div>右键拖动视角 · 滚轮缩放</div></footer>
        <div class="junqi3d-overlay is-hidden" data-role="rulesOverlay" role="dialog" aria-modal="true" aria-labelledby="junqi-rules-title"><article><button data-ui="closeRules" type="button" aria-label="关闭规则">×</button><span>完整规则</span><h2 id="junqi-rules-title">军棋怎么玩</h2><p>双方各有 25 枚棋子，军阶对外隐藏。夺取敌方军旗，或让对方没有任何合法移动，即可获胜。</p><div class="junqi3d-rule-grid"><section><b>01 · 布阵</b><ul><li>军旗必须放入己方大本营。</li><li>地雷只能放在最后两排。</li><li>炸弹不能放在最前排，行营不能布子。</li></ul></section><section><b>02 · 移动</b><ul><li>公路线每次移动一站，行营连接斜线。</li><li>铁路上可直线走任意空站；工兵可沿铁路转弯。</li><li>地雷、军旗及进入大本营的棋子不能移动。</li></ul></section><section><b>03 · 交战</b><ul><li>军阶高者获胜，同级棋子同归于尽。</li><li>工兵可以排雷，其他棋子碰到地雷会被消灭。</li><li>炸弹与任何棋子交战都会同归于尽。</li></ul></section><section><b>04 · 保护与夺旗</b><ul><li>行营中的棋子不能被攻击。</li><li>司令阵亡后，本方军旗会公开。</li><li>军旗被夺后立即结束棋局。</li></ul></section></div></article></div>
    </section>`;

    const app = mount.querySelector('.junqi3d-app');
    const viewport = mount.querySelector('[data-role="viewport"]');
    const canvas = mount.querySelector('[data-role="canvas"]');
    const roomEl = mount.querySelector('[data-role="room"]');
    const turnEl = mount.querySelector('[data-role="turn"]');
    const lastMoveEl = mount.querySelector('[data-role="lastMove"]');
    const stageStatus = mount.querySelector('[data-role="stageStatus"]');
    const hintEl = mount.querySelector('[data-role="hint"]');
    const logEl = mount.querySelector('[data-role="log"]');
    const chronicleEl = mount.querySelector('[data-role="chronicle"]');
    const battleEl = mount.querySelector('[data-role="battle"]');
    const capturedRedEl = mount.querySelector('[data-role="capturedRed"]');
    const capturedBlueEl = mount.querySelector('[data-role="capturedBlue"]');
    const redPlayerEl = mount.querySelector('[data-role="redPlayer"]');
    const bluePlayerEl = mount.querySelector('[data-role="bluePlayer"]');
    const setupPanel = mount.querySelector('[data-role="setupPanel"]');
    const setupTray = mount.querySelector('[data-role="setupTray"]');
    const setupProgress = mount.querySelector('[data-role="setupProgress"]');
    const blueSide = mount.querySelector('[data-role="blueSide"]');
    const redSide = mount.querySelector('[data-role="redSide"]');
    const rulesOverlay = mount.querySelector('[data-role="rulesOverlay"]');
    const board2d = mount.querySelector('[data-role="board2d"]');
    const viewModeButton = mount.querySelector('[data-role="viewModeButton"]');
    const resetButton = mount.querySelector('[data-role="resetButton"]');
    const footerGuide = mount.querySelector('[data-role="footerGuide"]');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#182420');
    scene.fog = new THREE.Fog('#182420', 25, 46);
    // 三种棋类共用同一套“桌面视角”：军棋棋盘更长，只单独放宽镜头距离。
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 90);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (error) {
        viewport.innerHTML = '<div class="junqi3d-render-error"><strong>3D 军棋无法启动</strong><span>当前浏览器没有可用的 WebGL 图形加速，请更换浏览器或关闭硬件加速后重试。</span></div>';
        addLog?.(`军棋 3D 初始化失败：${error.message}`, 'error');
        return { gameType: 'junqi', handleMessage() {}, destroy() { style.remove(); mount.innerHTML = ''; } };
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .96;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.1 : 1.25));

    const boardScene = new THREE.Group();
    scene.add(boardScene);
    const pieceRoots = new Map();
    const hitMeshes = [];
    const markers = new THREE.Group();
    boardScene.add(markers);
    const animations = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const textureCache = new Map();
    const pieceBodyMaterials = new Map();
    const pieceFaceMaterials = new Map();
    let pieceGeometry = null;
    let pieceFaceGeometry = null;
    let stationOutlineGeometry = null;
    let campOutlineGeometry = null;
    let hqOutlineGeometry = null;
    const lookTarget = new THREE.Vector3(0, .15, 0);
    const materials = {
        board: new THREE.MeshStandardMaterial({ color: '#a99d8e', roughness: .82, metalness: 0 }),
        boardTop: new THREE.MeshStandardMaterial({ color: '#f3efe7', map: makeBoardTexture(), roughness: .94, metalness: 0 }),
        line: new THREE.MeshBasicMaterial({ color: '#a42e2b' }),
        rail: new THREE.MeshBasicMaterial({ color: '#242422' }),
        railLight: new THREE.MeshBasicMaterial({ color: '#f5f1e9' }),
        diagonal: new THREE.MeshBasicMaterial({ color: '#a42e2b' }),
        campLine: new THREE.LineBasicMaterial({ color: '#a7332d', transparent: true, opacity: .9 }),
    };
    const viewModeStorageKey = 'jsgames.junqi.viewMode';
    const explicitViewModeStorageKey = `${viewModeStorageKey}.explicit`;
    const savedViewMode = localStorage.getItem(viewModeStorageKey);
    const isCompactPointer = window.matchMedia?.('(max-width: 760px), (pointer: coarse), (max-width: 900px) and (max-height: 500px)').matches;
    let state = null;
    let viewMode = isCompactPointer && localStorage.getItem(explicitViewModeStorageKey) !== '1'
        ? '2d'
        : savedViewMode === '2d' ? '2d' : '3d';
    let previousPieces = new Map();
    let selected = null;
    let selectedSetupPieceId = null;
    let cameraYaw = 0;
    let cameraPitch = DEFAULT_CAMERA_PITCH;
    let cameraDistance = DEFAULT_CAMERA_DISTANCE;
    let cameraColor = null;
    let previousPhase = null;
    let dragging = false;
    let dragPointerId = null;
    let lastPointer = { x: 0, y: 0 };
    let destroyed = false;
    let graphicsFailed = false;
    let frameId = null;
    let renderUntil = 0;
    const resizeTimers = [];

    createEnvironment();
    resetCamera();
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(viewport);
    scheduleResize();
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('contextmenu', event => event.preventDefault());
    mount.addEventListener('click', onUiClick);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); showGraphicsError('WebGL 图形上下文已丢失，可能是设备资源不足。'); });
    setViewMode(viewMode, false);

    function worldPosition(x, y, height = PIECE_BASE_Y) { return new THREE.Vector3((x - 2) * WORLD_X, height, (y - 5.5) * WORLD_Z); }
    function createEnvironment() {
        scene.add(new THREE.HemisphereLight('#ffe9c9', '#20302a', 1.24));
        const keyLight = new THREE.DirectionalLight('#ffe8c7', 1.46); keyLight.position.set(-5, 13, 7); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.radius = 4; keyLight.shadow.bias = -.0002; keyLight.shadow.camera.left = -6; keyLight.shadow.camera.right = 6; keyLight.shadow.camera.top = 7; keyLight.shadow.camera.bottom = -7; scene.add(keyLight);
        const rim = new THREE.DirectionalLight('#b8cec5', .18); rim.position.set(7, 8, -9); scene.add(rim);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ color: '#121b18', roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -.52; floor.receiveShadow = true; scene.add(floor);
        // A thin paper board reads more like classic white/red army chess
        // than a deep wooden tray, while still receiving a soft contact shadow.
        const surface = new THREE.Mesh(new THREE.BoxGeometry(9.2, .12, 12.5), materials.boardTop); surface.position.y = BOARD_TOP - .06; surface.receiveShadow = true; scene.add(surface);
        const campOutlinePoints = new THREE.EllipseCurve(0, 0, CAMP_RADIUS_X, CAMP_RADIUS_Z, 0, Math.PI * 2, false, 0).getPoints(64).map(point => new THREE.Vector3(point.x, point.y, 0));
        campOutlineGeometry = new THREE.BufferGeometry().setFromPoints(campOutlinePoints);
        hqOutlineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-HQ_HALF_X, -HQ_HALF_Z, 0),
            new THREE.Vector3(HQ_HALF_X, -HQ_HALF_Z, 0),
            new THREE.Vector3(HQ_HALF_X, HQ_HALF_Z, 0),
            new THREE.Vector3(-HQ_HALF_X, HQ_HALF_Z, 0),
        ]);
        const stationOutlinePoints = [];
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
            if (isCampSquare(x, y) || isHeadquartersSquare(x, y)) continue;
            const center = worldPosition(x, y, BOARD_DETAIL_Y + .014);
            const topLeft = new THREE.Vector3(center.x - STATION_HALF_X, center.y, center.z - STATION_HALF_Z);
            const topRight = new THREE.Vector3(center.x + STATION_HALF_X, center.y, center.z - STATION_HALF_Z);
            const bottomRight = new THREE.Vector3(center.x + STATION_HALF_X, center.y, center.z + STATION_HALF_Z);
            const bottomLeft = new THREE.Vector3(center.x - STATION_HALF_X, center.y, center.z + STATION_HALF_Z);
            stationOutlinePoints.push(topLeft, topRight, topRight, bottomRight, bottomRight, bottomLeft, bottomLeft, topLeft);
        }
        stationOutlineGeometry = new THREE.BufferGeometry().setFromPoints(stationOutlinePoints);
        const connectionPoint = (x, y, towardX, towardY, height) => {
            const center = worldPosition(x, y, height);
            const dx = (towardX - x) * WORLD_X; const dz = (towardY - y) * WORLD_Z;
            let scale;
            if (isCampSquare(x, y)) scale = 1 / Math.sqrt((dx / CAMP_RADIUS_X) ** 2 + (dz / CAMP_RADIUS_Z) ** 2);
            else if (isHeadquartersSquare(x, y)) scale = Math.min(dx ? HQ_HALF_X / Math.abs(dx) : Infinity, dz ? HQ_HALF_Z / Math.abs(dz) : Infinity);
            else return center;
            center.x += dx * scale; center.z += dz * scale;
            return center;
        };
        const connection = (x, y, towardX, towardY, height) => [connectionPoint(x, y, towardX, towardY, height), connectionPoint(towardX, towardY, x, y, height)];
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH - 1; x += 1) if (!isRailEdge(x, y, x + 1, y)) addLine(connection(x, y, x + 1, y, BOARD_LINE_Y));
        for (let x = 0; x < WIDTH; x += 1) for (let y = 0; y < HEIGHT - 1; y += 1) if (!isRailEdge(x, y, x, y + 1)) addLine(connection(x, y, x, y + 1, BOARD_LINE_Y));

        // Railway network used by the two-player board.  The center connector
        // at x=2 is easy to miss visually, but it is a legal railway edge in
        // the server topology and must be drawn as well.
        addRailLine([worldPosition(0, 1, BOARD_LINE_Y + .002), worldPosition(0, 10, BOARD_LINE_Y + .002)]);
        addRailLine([worldPosition(4, 1, BOARD_LINE_Y + .002), worldPosition(4, 10, BOARD_LINE_Y + .002)]);
        RAIL_ROWS.forEach(y => addRailLine([worldPosition(0, y, BOARD_LINE_Y + .002), worldPosition(4, y, BOARD_LINE_Y + .002)]));
        addRailLine([worldPosition(2, 5, BOARD_LINE_Y + .002), worldPosition(2, 6, BOARD_LINE_Y + .002)]);

        // Camps allow diagonal movement.  Draw each unique camp edge so the
        // visible map agrees with _roadDirections() on the server.
        const diagonalEdges = new Set();
        CAMPS.forEach(([x, y]) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
            const nx = x + dx; const ny = y + dy;
            if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) return;
            const a = `${x},${y}`; const b = `${nx},${ny}`; const edge = [a, b].sort().join('|');
            if (diagonalEdges.has(edge)) return;
            diagonalEdges.add(edge);
            addDiagonalLine(connection(x, y, nx, ny, BOARD_LINE_Y + .006));
        }));

        // Camps and headquarters are unfilled map markings. Their interiors
        // remain the board paper; only the outline and label are rendered.
        boardScene.add(new THREE.LineSegments(stationOutlineGeometry, materials.campLine));
        CAMPS.forEach(([x, y]) => {
            const outline = new THREE.LineLoop(campOutlineGeometry, materials.campLine);
            outline.rotation.x = -Math.PI / 2;
            outline.position.copy(worldPosition(x, y, BOARD_DETAIL_Y + .014)); boardScene.add(outline);
            const labelPosition = worldPosition(x, y, BOARD_DETAIL_Y + .02);
            addTextPlate('行营', labelPosition.x, labelPosition.y, labelPosition.z, .66, .23, '#9d302b');
        });
        Object.values(HEADQUARTERS).flat().forEach(([x, y]) => {
            const outline = new THREE.LineLoop(hqOutlineGeometry, materials.campLine);
            outline.rotation.x = -Math.PI / 2;
            outline.position.copy(worldPosition(x, y, BOARD_DETAIL_Y + .014)); boardScene.add(outline);
            const labelPosition = worldPosition(x, y, BOARD_DETAIL_Y + .02);
            addTextPlate('大本营', labelPosition.x, labelPosition.y, labelPosition.z, .94, .28, '#9d302b');
        });
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) { const hit = new THREE.Mesh(new THREE.PlaneGeometry(.82, .82), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.rotation.x = -Math.PI / 2; hit.position.copy(worldPosition(x, y, .04)); hit.userData.square = { x, y }; hit.userData.hitSquare = true; boardScene.add(hit); hitMeshes.push(hit); }
    }
    function addBar(start, end, width, material, height = .008) { const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz) || .001; const bar = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), material); bar.position.set((start.x + end.x) / 2, start.y, (start.z + end.z) / 2); bar.rotation.y = Math.atan2(-dz, dx); bar.castShadow = false; bar.receiveShadow = false; boardScene.add(bar); }
    function addLine(points) { addBar(points[0], points[1], .022, materials.line, .008); }
    function addRailLine(points) {
        const [start, end] = points;
        const dx = end.x - start.x; const dz = end.z - start.z;
        const blocks = Math.max(2, Math.round(Math.hypot(dx, dz) / .34));
        // Chinese map symbol: a continuous black strip with inset white
        // blocks. The dark rim keeps it visibly continuous rather than a
        // transparent dashed line.
        addBar(new THREE.Vector3(start.x, start.y + .001, start.z), new THREE.Vector3(end.x, end.y + .001, end.z), .082, materials.rail, .009);
        for (let index = 0; index < blocks; index += 1) {
            const from = (index + .08) / blocks; const to = (index + .58) / blocks;
            const ax = start.x + dx * from; const az = start.z + dz * from; const bx = start.x + dx * to; const bz = start.z + dz * to;
            addBar(new THREE.Vector3(ax, start.y + .006, az), new THREE.Vector3(bx, end.y + .006, bz), .058, materials.railLight, .011);
        }
    }
    function addDiagonalLine(points) { addBar(points[0], points[1], .018, materials.diagonal, .008); }
    function addTextPlate(text, x, y, z, width = 1.25, height = .48, color = '#9d302b') { const texture = makeTexture(text, color, 'rgba(0,0,0,0)', 42); const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material); plate.rotation.x = -Math.PI / 2; plate.position.set(x, y, z); boardScene.add(plate); }
    function makeBoardTexture() { const key = 'junqi-classic-paper-board'; if (textureCache.has(key)) return textureCache.get(key); const canvasTexture = document.createElement('canvas'); canvasTexture.width = 512; canvasTexture.height = 1024; const context = canvasTexture.getContext('2d'); context.fillStyle = '#f3efe7'; context.fillRect(0, 0, canvasTexture.width, canvasTexture.height); const image = context.getImageData(0, 0, canvasTexture.width, canvasTexture.height); for (let index = 0; index < image.data.length; index += 4) { const noise = ((index * 17) % 5) - 2; image.data[index] = Math.max(0, image.data[index] + noise); image.data[index + 1] = Math.max(0, image.data[index + 1] + noise); image.data[index + 2] = Math.max(0, image.data[index + 2] + noise); image.data[index + 3] = 255; } context.putImageData(image, 0, 0); context.strokeStyle = 'rgba(126, 72, 55, .012)'; context.lineWidth = 1; for (let y = 12; y < canvasTexture.height; y += 28) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvasTexture.width, y + 2); context.stroke(); } const texture = new THREE.CanvasTexture(canvasTexture); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, .7); textureCache.set(key, texture); return texture; }
    function makeTexture(text, color, background, size = 64) { const key = `${text}|${color}|${background}|${size}`; if (textureCache.has(key)) return textureCache.get(key); const canvasTexture = document.createElement('canvas'); canvasTexture.width = 512; canvasTexture.height = 256; const context = canvasTexture.getContext('2d'); context.fillStyle = background; context.fillRect(0, 0, 512, 256); context.fillStyle = color; context.font = `bold ${size * 2}px "Noto Serif CJK SC", "Songti SC", SimSun, serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 132); const texture = new THREE.CanvasTexture(canvasTexture); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textureCache.set(key, texture); return texture; }
    function seedFrom(value) { let hash = 2166136261; for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
    function seededRandom(seed) { let value = seed || 1; return () => { value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }
    function roundedCanvasPath(context, x, y, width, height, radius) { context.beginPath(); context.moveTo(x + radius, y); context.lineTo(x + width - radius, y); context.quadraticCurveTo(x + width, y, x + width, y + radius); context.lineTo(x + width, y + height - radius); context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); context.lineTo(x + radius, y + height); context.quadraticCurveTo(x, y + height, x, y + height - radius); context.lineTo(x, y + radius); context.quadraticCurveTo(x, y, x + radius, y); context.closePath(); }
    function makeTileSurfaceTexture(color, variant, bump = false) {
        const key = `junqi-tile-surface|${color}|${variant}|${bump ? 'bump' : 'color'}`;
        if (textureCache.has(key)) return textureCache.get(key);
        const image = document.createElement('canvas'); image.width = 512; image.height = 512;
        const context = image.getContext('2d'); const random = seededRandom(seedFrom(key));
        context.fillStyle = bump ? '#8d8d8d' : color === 'red' ? ['#dbcdb3', '#e1d3ba', '#d8c7aa', '#e4d8c1'][variant] : ['#cfd2c9', '#d6d8cf', '#c7ccc4', '#d9d9cf'][variant]; context.fillRect(0, 0, 512, 512);
        for (let index = 0; index < 90; index += 1) { const y = random() * 512; context.strokeStyle = bump ? `rgba(${112 + random() * 34},${112 + random() * 34},${112 + random() * 34},.22)` : color === 'red' ? 'rgba(112,78,43,.075)' : 'rgba(48,72,67,.07)'; context.lineWidth = .5 + random() * 1.5; context.beginPath(); context.moveTo(0, y); context.bezierCurveTo(150, y + random() * 7 - 3.5, 350, y + random() * 7 - 3.5, 512, y + random() * 5 - 2.5); context.stroke(); }
        for (let index = 0; index < 150; index += 1) { const value = 92 + Math.floor(random() * 68); context.fillStyle = bump ? `rgba(${value},${value},${value},.18)` : `rgba(74,53,33,${.025 + random() * .035})`; context.beginPath(); context.ellipse(random() * 512, random() * 512, .7 + random() * 2.4, .4 + random(), random() * Math.PI, 0, Math.PI * 2); context.fill(); }
        const texture = new THREE.CanvasTexture(image); if (!bump) texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.4, 1.2); texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textureCache.set(key, texture); return texture;
    }
    function pieceBodyMaterial(piece) { const variant = seedFrom(piece.id) % 4; const key = `${piece.color}|${variant}`; if (!pieceBodyMaterials.has(key)) pieceBodyMaterials.set(key, new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: makeTileSurfaceTexture(piece.color, variant), bumpMap: makeTileSurfaceTexture(piece.color, variant, true), bumpScale: .012, roughness: .7, metalness: 0, clearcoat: .035, clearcoatRoughness: .84 })); return pieceBodyMaterials.get(key); }
    function makePieceTexture(piece) {
        const hidden = piece.type === 'unknown'; const key = `junqi-piece-face|${piece.color}|${hidden ? 'back' : piece.type}`;
        if (textureCache.has(key)) return textureCache.get(key);
        const image = document.createElement('canvas'); image.width = 512; image.height = 350;
        const context = image.getContext('2d'); const random = seededRandom(seedFrom(key)); context.clearRect(0, 0, 512, 350);
        roundedCanvasPath(context, 18, 15, 476, 320, 34); const fill = context.createLinearGradient(20, 10, 490, 340);
        if (hidden) { fill.addColorStop(0, '#263f3d'); fill.addColorStop(.52, '#35534e'); fill.addColorStop(1, '#1e3433'); } else { fill.addColorStop(0, piece.color === 'red' ? '#f0e5cf' : '#e6e8df'); fill.addColorStop(.55, piece.color === 'red' ? '#ddcdb0' : '#cdd3cc'); fill.addColorStop(1, piece.color === 'red' ? '#cdbb9d' : '#b9c2bb'); }
        context.fillStyle = fill; context.fill();
        for (let index = 0; index < 52; index += 1) { context.fillStyle = hidden ? `rgba(227,207,154,${.018 + random() * .028})` : `rgba(83,58,32,${.018 + random() * .025})`; context.fillRect(32 + random() * 448, 28 + random() * 292, .8 + random() * 2.2, .5 + random()); }
        const ink = piece.color === 'red' ? '#962c27' : '#243f4b'; const border = hidden ? '#d0aa5a' : ink;
        roundedCanvasPath(context, 34, 30, 444, 290, 25); context.strokeStyle = border; context.lineWidth = hidden ? 7 : 6; context.stroke();
        roundedCanvasPath(context, 48, 44, 416, 262, 18); context.strokeStyle = hidden ? 'rgba(225,195,125,.42)' : `${border}80`; context.lineWidth = 2; context.stroke();
        if (hidden) { context.save(); context.translate(256, 175); context.rotate(Math.PI / 4); context.fillStyle = 'rgba(225,195,125,.15)'; context.strokeStyle = '#d7b76d'; context.lineWidth = 7; context.fillRect(-62, -62, 124, 124); context.strokeRect(-62, -62, 124, 124); context.strokeStyle = 'rgba(231,207,148,.72)'; context.lineWidth = 3; context.strokeRect(-42, -42, 84, 84); context.restore(); context.fillStyle = '#ead39a'; context.font = '700 66px "Noto Serif CJK SC", "Songti SC", SimSun, serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('軍', 256, 178); }
        else { const text = LABELS[piece.type] || '?'; context.fillStyle = ink; context.shadowColor = 'rgba(255,255,255,.55)'; context.shadowBlur = 1; context.shadowOffsetY = 1; context.font = `700 ${text.length > 2 ? 76 : 96}px "Noto Serif CJK SC", "Songti SC", SimSun, serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 181); context.shadowColor = 'transparent'; context.fillStyle = `${ink}b8`; context.beginPath(); context.arc(76, 70, 5, 0, Math.PI * 2); context.arc(436, 280, 5, 0, Math.PI * 2); context.fill(); }
        const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); texture.generateMipmaps = true; textureCache.set(key, texture); return texture;
    }
    function pieceFaceMaterial(piece) { const key = `${piece.color}|${piece.type}`; if (!pieceFaceMaterials.has(key)) pieceFaceMaterials.set(key, new THREE.MeshStandardMaterial({ map: makePieceTexture(piece), transparent: true, alphaTest: .06, side: THREE.FrontSide, depthWrite: true, roughness: .72, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); return pieceFaceMaterials.get(key); }
    function roundedPieceGeometry(width, height, depth, radius) {
        const shape = new THREE.Shape();
        const x = width / 2; const y = height / 2;
        shape.moveTo(-x + radius, -y); shape.lineTo(x - radius, -y);
        shape.quadraticCurveTo(x, -y, x, -y + radius); shape.lineTo(x, y - radius);
        shape.quadraticCurveTo(x, y, x - radius, y); shape.lineTo(-x + radius, y);
        shape.quadraticCurveTo(-x, y, -x, y - radius); shape.lineTo(-x, -y + radius);
        shape.quadraticCurveTo(-x, -y, -x + radius, -y);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 4, curveSegments: 12 });
        geometry.translate(0, 0, -depth / 2); geometry.computeVertexNormals();
        return geometry;
    }
    function createPiece(piece) { const root = new THREE.Group(); root.userData.pieceId = piece.id; root.userData.square = { x: piece.x, y: piece.y }; root.userData.type = piece.type; root.userData.color = piece.color; root.rotation.y = piece.color === 'blue' ? Math.PI : 0; pieceGeometry ||= roundedPieceGeometry(PIECE_BODY_WIDTH, PIECE_BODY_HEIGHT, PIECE_BODY_DEPTH, .055); pieceFaceGeometry ||= new THREE.PlaneGeometry(.70, .45); const body = new THREE.Mesh(pieceGeometry, pieceBodyMaterial(piece)); body.position.y = PIECE_BODY_Y; body.castShadow = true; body.receiveShadow = true; root.add(body); const faceMaterial = pieceFaceMaterial(piece); const faceY = PIECE_BODY_Y; const faceZ = PIECE_BODY_DEPTH / 2 + .031; if (piece.type === 'unknown') { const back = new THREE.Mesh(pieceFaceGeometry, faceMaterial); back.rotation.y = Math.PI; back.position.set(0, faceY, -faceZ); root.add(back); } else { const face = new THREE.Mesh(pieceFaceGeometry, faceMaterial); face.position.set(0, faceY, faceZ); root.add(face); const revealedBack = new THREE.Mesh(pieceFaceGeometry, faceMaterial); revealedBack.rotation.y = Math.PI; revealedBack.position.set(0, faceY, -faceZ); root.add(revealedBack); } root.position.copy(worldPosition(piece.x, piece.y)); boardScene.add(root); return root; }
    function setPiecePosition(root, x, y) { root.position.copy(worldPosition(x, y)); root.userData.square = { x, y }; }
    function clearMarkers() { while (markers.children.length) { const marker = markers.children[0]; marker.geometry.dispose(); marker.material.dispose(); markers.remove(marker); } }
    function renderMarkers() { clearMarkers(); if (!selected || !state) return; const piece = pieceAt(selected.x, selected.y); if (!piece) return; const selection = new THREE.Mesh(new THREE.PlaneGeometry(1.08, .76), new THREE.MeshBasicMaterial({ color: '#e0b455', transparent: true, opacity: .38, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); selection.rotation.x = -Math.PI / 2; selection.position.copy(worldPosition(selected.x, selected.y, BOARD_DETAIL_Y + .012)); selection.userData.square = { ...selected }; selection.userData.markerKind = 'selection'; markers.add(selection); const targets = state.legalMoves?.[piece.id] || []; const uniqueTargets = [...new Map(targets.map(target => [`${target.x},${target.y}`, target])).values()]; uniqueTargets.forEach(target => { const occupant = pieceAt(target.x, target.y); const marker = occupant ? new THREE.Mesh(new THREE.PlaneGeometry(1.04, .72), new THREE.MeshBasicMaterial({ color: '#a32f2a', transparent: true, opacity: .46, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })) : new THREE.Mesh(new THREE.CylinderGeometry(.115, .15, .045, 28), new THREE.MeshStandardMaterial({ color: '#cf9840', emissive: '#5b3107', emissiveIntensity: .18, roughness: .5, metalness: .08 })); marker.rotation.x = occupant ? -Math.PI / 2 : 0; marker.position.copy(worldPosition(target.x, target.y, occupant ? BOARD_DETAIL_Y + .014 : BOARD_DETAIL_Y + .035)); marker.userData.square = { x: target.x, y: target.y }; marker.userData.markerKind = occupant ? 'capture' : 'move'; markers.add(marker); }); }
    function syncPieces(nextPieces) { const nextMap = new Map(nextPieces.map(piece => [piece.id, piece])); if (viewMode === '2d') {
        settleAnimations();
        for (const [id, root] of pieceRoots) if (!nextMap.has(id)) { boardScene.remove(root); pieceRoots.delete(id); }
        for (const piece of nextPieces) { let root = pieceRoots.get(piece.id); if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) { if (root) boardScene.remove(root); root = createPiece(piece); pieceRoots.set(piece.id, root); } setPiecePosition(root, piece.x, piece.y); }
        previousPieces = new Map(nextPieces.map(piece => [piece.id, piece])); return;
    } for (const [id, root] of pieceRoots) if (!nextMap.has(id)) { animations.push({ kind: 'capture', root, start: performance.now(), duration: 250 }); }
        for (const piece of nextPieces) { const old = previousPieces.get(piece.id); let root = pieceRoots.get(piece.id); if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) { if (root) boardScene.remove(root); root = createPiece(piece); pieceRoots.set(piece.id, root); } else if (old && (old.x !== piece.x || old.y !== piece.y)) { animations.push({ kind: 'move', root, from: worldPosition(old.x, old.y), to: worldPosition(piece.x, piece.y), start: performance.now(), duration: 340, toX: piece.x, toY: piece.y }); root.userData.square = { x: piece.x, y: piece.y }; } else setPiecePosition(root, piece.x, piece.y); }
        previousPieces = new Map(nextPieces.map(piece => [piece.id, piece]));
    }
    function renderState() {
        if (!state) return;
        const current = state.players?.find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended'; const setup = state.phase === 'setup'; const setupDone = Boolean(state.setup?.ready);
        app.classList.toggle('is-setup', setup); app.classList.toggle('is-ended', ended);
        roomEl.textContent = state.roomId ? `房间 ${state.roomId}` : '军棋对局';
        turnEl.innerHTML = ended ? `<span class="junqi3d-dot ended"></span>${escapeHtml(state.winner?.name || '棋局结束')}` : setup ? `<span class="junqi3d-dot setup"></span>${setupDone ? '布阵已确认，等待对手' : '你的布阵阶段'}` : `<span class="junqi3d-dot"></span>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}`;
        stageStatus.textContent = ended ? (state.winner ? `${state.winner.name} 获胜` : state.drawReason || '和棋') : setup ? `暗棋布阵 · ${state.setup?.pieces?.filter(piece => piece.placed).length || 0}/25` : '';
        const selectedSetup = state.setup?.pieces?.find(piece => piece.id === selectedSetupPieceId);
        hintEl.textContent = ended ? '本局已结束' : setup ? (selectedSetup ? `已选${LABELS[selectedSetup.type]}：${selectedSetup.placed ? '点击空位改位，点击另一枚棋子交换' : '点击己方空位放置'}` : '从己方信息栏选择军阶，或直接点击棋盘棋子') : state.myIsCurrentTurn ? (selected ? '金色为已选棋子；铜色可移动，红色可攻击' : '选择有合法走法的己方棋子') : `等待 ${current?.name || '对手'} 走棋`;
        footerGuide.textContent = setup ? '布阵规则由服务器校验，确认后不可更改' : viewMode === '2d' ? '金色选中 · 铜色移动 · 深红攻击' : '左键走棋 · 右键拖动 · 滚轮缩放';
        logEl.innerHTML = (state.actionLog || []).slice(-5).reverse().map((entry, index) => `<span class="${index === 0 ? 'is-latest' : ''}"><i>${String((state.actionLog || []).length - index).padStart(2, '0')}</i>${escapeHtml(entry)}</span>`).join('') || '<em>等待第一步行动</em>';
        renderPlayer(redPlayerEl, state.players?.find(player => player.color === 'red'), 'red');
        renderPlayer(bluePlayerEl, state.players?.find(player => player.color === 'blue'), 'blue');
        renderCaptured(); renderSetup(); renderBattle();
        const pieces = setup ? (state.setup?.pieces || []).filter(piece => piece.placed).map(piece => ({ ...piece, revealed: true })) : (state.pieces || []);
        syncPieces(pieces); renderMarkers(); renderBoard2d(); requestRender(520);
    }
    function renderPlayer(element, player, color) {
        if (!player) { element.innerHTML = ''; return; }
        const alive = state.phase === 'setup' ? 25 : (state.pieces || []).filter(piece => piece.color === color).length;
        const status = player.isOnline === false ? '已离线' : player.isCurrentTurn && state.phase === 'play' ? '正在行动' : state.phase === 'setup' ? (player.id === state.myId && state.setup?.ready ? '已确认布阵' : player.id === state.myId ? '正在布阵' : '等待确认') : color === state.myColor ? '你的部队' : '对方部队';
        element.className = `junqi3d-player-card ${color} ${player.isCurrentTurn ? 'is-current' : ''}`;
        element.innerHTML = `<div class="junqi3d-player-heading"><span class="junqi3d-player-color">${color === 'red' ? '红方' : '蓝方'}</span><small>${player.id === state.myId ? '我方' : '对手'}</small></div><div class="junqi3d-player-main"><div class="junqi3d-avatar">${escapeHtml(player.name.slice(0, 1))}</div><div><strong>${escapeHtml(player.name)}</strong><small>${status}</small></div></div><div class="junqi3d-strength"><span><b>${alive}</b> 在场</span><span><b>${25 - alive}</b> 损失</span></div>`;
    }
    function renderCaptured() {
        if (state.phase === 'setup') { capturedRedEl.textContent = state.myColor === 'red' ? (state.setup?.ready ? '我方已确认' : '我方布阵中') : '红方等待确认'; capturedBlueEl.textContent = state.myColor === 'blue' ? (state.setup?.ready ? '我方已确认' : '我方布阵中') : '蓝方等待确认'; return; }
        const alive = color => (state.pieces || []).filter(piece => piece.color === color).length;
        capturedRedEl.textContent = `红方损失 ${25 - alive('red')}`; capturedBlueEl.textContent = `蓝方损失 ${25 - alive('blue')}`;
    }
    function renderSetup() {
        const setup = state.phase === 'setup' && state.setup;
        setupPanel.classList.toggle('is-hidden', !setup);
        if (!setup) { setupTray.innerHTML = ''; return; }
        const host = state.myColor === 'blue' ? blueSide : redSide; if (setupPanel.parentElement !== host) host.appendChild(setupPanel);
        const pieces = setup.pieces || []; const placed = pieces.filter(piece => piece.placed).length; setupProgress.textContent = `${placed} / ${pieces.length}`;
        const types = Object.keys(LABELS).filter(type => type !== 'unknown');
        setupTray.innerHTML = types.map(type => { const group = pieces.filter(piece => piece.type === type); if (!group.length) return ''; const groupPlaced = group.filter(piece => piece.placed).length; const selectedInGroup = group.some(piece => piece.id === selectedSetupPieceId); const candidate = group.find(piece => piece.id === selectedSetupPieceId) || group.find(piece => !piece.placed) || group[0]; return `<button type="button" class="junqi3d-setup-piece ${groupPlaced === group.length ? 'is-complete' : ''} ${selectedInGroup ? 'is-selected' : ''}" data-setup-piece="${escapeHtml(candidate.id)}" ${setup.ready ? 'disabled' : ''} title="${groupPlaced === group.length ? '全部已放置；可选择后改位' : `还有 ${group.length - groupPlaced} 枚待放置`}"><b>${SHORT_LABELS[type] || '?'}</b><span><strong>${LABELS[type]}</strong><small>${groupPlaced}/${group.length}</small></span></button>`; }).join('');
        setupPanel.querySelector('[data-ui="setupReady"]').disabled = setup.ready || placed < pieces.length;
        setupPanel.querySelector('[data-ui="setupReset"]').disabled = setup.ready;
    }
    function renderBattle() {
        const move = state.lastMove; const capture = move?.capture;
        battleEl.hidden = !capture;
        if (!capture) { battleEl.innerHTML = ''; lastMoveEl.innerHTML = move ? '<span class="junqi3d-move-mark">→</span><div><strong>棋子移动</strong><small>未发生交战</small></div>' : '<div><strong>等待开局</strong><small>尚无公开战况</small></div>'; return; }
        const attacker = move.piece || {}; const defender = capture.defender || { type: capture.defenderType };
        const outcome = { 'attacker-wins': ['进攻方胜', '击败'], 'defender-wins': ['防守方胜', '守住'], 'both-exploded': ['炸弹引爆', '同归于尽'], 'both-removed': ['军阶相同', '同归于尽'], 'flag-captured': ['军旗被夺', '夺旗'] }[capture.outcome] || ['交战结束', '对决'];
        const attackerLabel = LABELS[attacker.type] || '未知棋子'; const defenderLabel = LABELS[defender.type || capture.defenderType] || '未知棋子';
        const attackerColor = attacker.color || state.turn; const defenderColor = defender.color || (attackerColor === 'red' ? 'blue' : 'red');
        battleEl.className = `junqi3d-battle outcome-${escapeHtml(capture.outcome || 'unknown')}`;
        battleEl.innerHTML = `<small>公开交战</small><div><span class="${attackerColor}"><i>攻</i><b>${attackerLabel}</b></span><em>${outcome[1]}</em><span class="${defenderColor}"><i>守</i><b>${defenderLabel}</b></span></div><strong>${outcome[0]}</strong>`;
        lastMoveEl.innerHTML = `<div class="junqi3d-brief-pieces"><span class="${attackerColor}">${attackerLabel}</span><i>对</i><span class="${defenderColor}">${defenderLabel}</span></div><strong>${outcome[0]}</strong><small>${outcome[1]}</small>`;
    }
    function visiblePieces() { return state?.phase === 'setup' ? (state.setup?.pieces || []).filter(piece => piece.placed) : (state?.pieces || []); }
    function pieceAt(x, y) { return visiblePieces().find(piece => piece.x === x && piece.y === y) || null; }
    function displayPoint(x, y) { return state?.myColor === 'blue' ? { x: WIDTH - 1 - x, y: HEIGHT - 1 - y } : { x, y }; }
    function boardSvgPoint(x, y) { const point = displayPoint(x, y); return { x: 105 + point.x * 122.5, y: 85 + point.y * (830 / 11) }; }
    function renderBoard2d() {
        if (!state || viewMode !== '2d') return;
        const roads = [];
        const connectionPoint = (x, y, towardX, towardY) => {
            const center = boardSvgPoint(x, y);
            const target = boardSvgPoint(towardX, towardY); const dx = target.x - center.x; const dy = target.y - center.y;
            let scale;
            if (isCampSquare(x, y)) scale = 1 / Math.sqrt((dx / CAMP_SVG_RX) ** 2 + (dy / CAMP_SVG_RY) ** 2);
            else if (isHeadquartersSquare(x, y)) scale = Math.min(dx ? HQ_SVG_HALF_X / Math.abs(dx) : Infinity, dy ? HQ_SVG_HALF_Y / Math.abs(dy) : Infinity);
            else return center;
            return { x: center.x + dx * scale, y: center.y + dy * scale };
        };
        const addRoad = (x1, y1, x2, y2, kind = 'road') => {
            const a = kind === 'rail' ? boardSvgPoint(x1, y1) : connectionPoint(x1, y1, x2, y2);
            const b = kind === 'rail' ? boardSvgPoint(x2, y2) : connectionPoint(x2, y2, x1, y1);
            if (kind !== 'rail') { roads.push(`<line class="${kind}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`); return; }
            roads.push(`<line class="rail-base" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
            const blocks = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 28));
            for (let index = 0; index < blocks; index += 1) {
                const from = (index + .08) / blocks; const to = (index + .58) / blocks;
                const ax = a.x + (b.x - a.x) * from; const ay = a.y + (b.y - a.y) * from; const bx = a.x + (b.x - a.x) * to; const by = a.y + (b.y - a.y) * to;
                roads.push(`<line class="rail-light" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
            }
        };
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH - 1; x += 1) if (!isRailEdge(x, y, x + 1, y)) addRoad(x, y, x + 1, y);
        for (let x = 0; x < WIDTH; x += 1) for (let y = 0; y < HEIGHT - 1; y += 1) if (!isRailEdge(x, y, x, y + 1)) addRoad(x, y, x, y + 1);
        const diagonalEdges = new Set();
        CAMPS.forEach(([x, y]) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => { const nx = x + dx; const ny = y + dy; if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) return; const edge = [`${x},${y}`, `${nx},${ny}`].sort().join('|'); if (!diagonalEdges.has(edge)) { diagonalEdges.add(edge); addRoad(x, y, nx, ny); } }));
        addRoad(0, 1, 0, 10, 'rail'); addRoad(4, 1, 4, 10, 'rail'); RAIL_ROWS.forEach(y => addRoad(0, y, 4, y, 'rail')); addRoad(2, 5, 2, 6, 'rail');
        const areas = [...CAMPS.map(([x, y]) => ({ x, y, kind: 'camp', label: '行营' })), ...Object.entries(HEADQUARTERS).flatMap(([color, squares]) => squares.map(([x, y]) => ({ x, y, kind: `hq ${color}`, label: '大本营' })))].map(area => { const point = boardSvgPoint(area.x, area.y); const shape = area.kind === 'camp' ? `<ellipse cx="${point.x}" cy="${point.y}" rx="${CAMP_SVG_RX}" ry="${CAMP_SVG_RY}"/>` : `<rect x="${point.x - HQ_SVG_HALF_X}" y="${point.y - HQ_SVG_HALF_Y}" width="${HQ_SVG_HALF_X * 2}" height="${HQ_SVG_HALF_Y * 2}" rx="4"/>`; return `<g class="area ${area.kind}">${shape}<text x="${point.x}" y="${point.y + 5}">${area.label}</text></g>`; }).join('');
        const selectedPiece = selected && pieceAt(selected.x, selected.y);
        const legal = new Set((state.legalMoves?.[selectedPiece?.id] || []).map(move => `${move.x},${move.y}`));
        const nodes = [];
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
            const display = displayPoint(x, y); const piece = pieceAt(x, y); const isLegal = legal.has(`${x},${y}`); const isSelected = selected?.x === x && selected?.y === y;
            const classes = ['junqi2d-node', isCampSquare(x, y) ? 'is-camp' : '', isHeadquartersSquare(x, y) ? 'is-hq' : '', piece ? 'has-piece' : '', piece?.color || '', piece?.type === 'unknown' ? 'is-unknown' : '', isSelected ? 'is-selected' : '', isLegal ? (piece ? 'can-capture' : 'can-move') : ''].filter(Boolean).join(' ');
            nodes.push(`<button type="button" class="${classes}" data-board-square data-x="${x}" data-y="${y}" style="--x:${display.x};--y:${display.y}" aria-label="${piece ? escapeHtml(piece.label || LABELS[piece.type] || '未知棋子') : `位置 ${x + 1},${y + 1}`}">${piece ? `<span>${escapeHtml(piece.type === 'unknown' ? '軍' : LABELS[piece.type] || '?')}</span>` : ''}</button>`);
        }
        board2d.innerHTML = `<svg viewBox="0 0 700 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect class="paper" x="13" y="13" width="674" height="974" rx="8"/>${roads.join('')}${areas}</svg>${nodes.join('')}`;
    }
    function onPointerDown(event) { if (viewMode === '2d') return; if (event.button === 2 || event.shiftKey) { dragging = true; dragPointerId = event.pointerId; lastPointer = { x: event.clientX, y: event.clientY }; viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging'); return; } if (event.button === 0) selectFromPointer(event); }
    function onPointerMove(event) { if (!dragging || event.pointerId !== dragPointerId) return; const dx = event.clientX - lastPointer.x; const dy = event.clientY - lastPointer.y; lastPointer = { x: event.clientX, y: event.clientY }; cameraYaw -= dx * .006; cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * .004, .48, .98); updateCamera(); }
    function onPointerUp(event) { if (event.pointerId !== dragPointerId) return; dragging = false; dragPointerId = null; viewport.releasePointerCapture?.(event.pointerId); viewport.classList.remove('is-dragging'); }
    function onWheel(event) { if (viewMode === '2d') return; event.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .009, 20.5, 28); updateCamera(); }
    function projectBounds(points, rect) {
        const projected = points.map(point => point.clone().project(camera));
        const xs = projected.map(point => rect.left + (point.x + 1) * rect.width / 2);
        const ys = projected.map(point => rect.top + (1 - point.y) * rect.height / 2);
        return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    }
    function boundsScore(event, bounds, padding = 0) {
        if (!bounds || event.clientX < bounds.left - padding || event.clientX > bounds.right + padding || event.clientY < bounds.top - padding || event.clientY > bounds.bottom + padding) return Infinity;
        const halfWidth = Math.max(8, (bounds.right - bounds.left) / 2 + padding);
        const halfHeight = Math.max(8, (bounds.bottom - bounds.top) / 2 + padding);
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        return ((event.clientX - centerX) / halfWidth) ** 2 + ((event.clientY - centerY) / halfHeight) ** 2;
    }
    function pieceScreenScore(event, piece, rect) {
        const root = pieceRoots.get(piece.id);
        if (!root) return Infinity;
        root.updateWorldMatrix(true, false);
        const points = [];
        for (const x of [-.42, .42]) for (const y of [-.08, .5]) for (const z of [-.18, .18]) points.push(root.localToWorld(new THREE.Vector3(x, y, z)));
        return boundsScore(event, projectBounds(points, rect), 7);
    }
    function squareScreenScore(event, square, rect) {
        const center = worldPosition(square.x, square.y, .055);
        const points = [[-.43, -.43], [.43, -.43], [.43, .43], [-.43, .43]].map(([dx, dz]) => new THREE.Vector3(center.x + dx, center.y, center.z + dz));
        return boundsScore(event, projectBounds(points, rect), 4);
    }
    function screenPickCandidate(event) {
        const rect = canvas.getBoundingClientRect();
        camera.updateMatrixWorld(true);
        boardScene.updateWorldMatrix(true, true);
        const choices = [];
        const pieces = visiblePieces();
        pieces.forEach(piece => {
            const score = pieceScreenScore(event, piece, rect);
            if (Number.isFinite(score)) choices.push({ square: { x: piece.x, y: piece.y }, pieceId: piece.id, markerKind: null, hitSquare: false, score });
        });
        const selectedPiece = selected && pieceAt(selected.x, selected.y);
        const targets = state?.legalMoves?.[selectedPiece?.id] || [];
        for (const target of targets) {
            const occupant = pieceAt(target.x, target.y);
            const squareScore = squareScreenScore(event, target, rect);
            const occupantScore = occupant ? pieceScreenScore(event, occupant, rect) : Infinity;
            const score = Math.min(squareScore, occupantScore);
            if (Number.isFinite(score)) choices.push({ square: { x: target.x, y: target.y }, pieceId: occupant?.id || null, markerKind: occupant ? 'capture' : 'move', hitSquare: !occupant, score: score - .04 });
        }
        if (state?.phase === 'setup') for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
            const score = squareScreenScore(event, { x, y }, rect);
            if (Number.isFinite(score)) choices.push({ square: { x, y }, pieceId: null, markerKind: null, hitSquare: true, score: score + .12 });
        }
        choices.sort((left, right) => left.score - right.score);
        return choices[0] || null;
    }
    function pointerCandidates(event) {
        const screenCandidate = screenPickCandidate(event);
        if (screenCandidate) return [screenCandidate];
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([...markers.children, ...pieceRoots.values(), ...hitMeshes], true);
        const candidates = [];
        const seen = new Set();
        for (const hit of hits) {
            let object = hit.object;
            let square = null;
            let pieceId = null;
            let markerKind = null;
            let hitSquare = false;
            while (object) {
                if (!square && object.userData.square) square = object.userData.square;
                pieceId ||= object.userData.pieceId || null;
                markerKind ||= object.userData.markerKind || null;
                hitSquare ||= Boolean(object.userData.hitSquare);
                object = object.parent;
            }
            if (!square) continue;
            const identity = `${square.x},${square.y}|${markerKind || pieceId || (hitSquare ? 'board' : 'object')}`;
            if (seen.has(identity)) continue;
            seen.add(identity);
            candidates.push({ square: { x: square.x, y: square.y }, pieceId, markerKind, hitSquare });
        }
        return candidates;
    }
    function activateSquare(square) {
        if (!state || state.status === 'ended' || animations.length) return;
        if (state.phase === 'setup') {
            const piece = pieceAt(square.x, square.y);
            const selectedSetupPiece = state.setup?.pieces?.find(item => item.id === selectedSetupPieceId);
            if (selectedSetupPieceId && !piece) {
                send({ type: 'gameAction', action: { kind: 'setupPlace', pieceId: selectedSetupPieceId, x: square.x, y: square.y } });
                selectedSetupPieceId = null;
                renderMarkers();
                renderBoard2d();
                return;
            }
            if (selectedSetupPieceId && piece?.id === selectedSetupPieceId) { selectedSetupPieceId = null; renderSetup(); renderBoard2d(); return; }
            if (selectedSetupPiece?.placed && piece?.ownerId === state.myId) { send({ type: 'gameAction', action: { kind: 'setupSwap', pieceId: selectedSetupPieceId, targetPieceId: piece.id } }); selectedSetupPieceId = null; renderMarkers(); renderBoard2d(); return; }
            if (piece?.ownerId === state.myId) selectedSetupPieceId = piece.id;
            renderSetup();
            renderBoard2d();
            return;
        }
        const selectedPiece = selected && pieceAt(selected.x, selected.y);
        const legalTargets = state.legalMoves?.[selectedPiece?.id] || [];
        const legalKeys = new Set(legalTargets.map(move => `${move.x},${move.y}`));
        if (selectedPiece && legalKeys.has(`${square.x},${square.y}`)) {
            hintEl.textContent = pieceAt(square.x, square.y) ? '正在结算战斗…' : '正在移动…';
            send({ type: 'gameAction', action: { kind: 'move', from: { ...selected }, to: { ...square } } });
            selected = null;
            renderMarkers();
            renderBoard2d();
            return;
        }
        const piece = pieceAt(square.x, square.y);
        selected = piece && piece.ownerId === state.myId && state.myIsCurrentTurn && (state.legalMoves?.[piece.id] || []).length ? { x: square.x, y: square.y } : null;
        hintEl.textContent = selected ? '金色为已选棋子；铜色可移动，深红色可攻击' : state.myIsCurrentTurn ? '请选择有合法走法的己方棋子' : '等待对手走棋';
        renderMarkers();
        renderBoard2d();
        requestRender(300);
    }
    function selectFromPointer(event) {
        if (!state || state.status === 'ended' || animations.length) return;
        const candidates = pointerCandidates(event);
        if (!candidates.length) return;
        const selectedPiece = selected && pieceAt(selected.x, selected.y);
        const legalTargets = state.legalMoves?.[selectedPiece?.id] || [];
        const legalKeys = new Set(legalTargets.map(move => `${move.x},${move.y}`));
        const legalMarker = candidates.find(candidate => ['move', 'capture'].includes(candidate.markerKind) && legalKeys.has(`${candidate.square.x},${candidate.square.y}`));
        const legalPiece = candidates.find(candidate => candidate.pieceId && legalKeys.has(`${candidate.square.x},${candidate.square.y}`));
        const ownPiece = candidates.find(candidate => candidate.pieceId && pieceAt(candidate.square.x, candidate.square.y)?.ownerId === state.myId);
        const legalBoard = candidates.find(candidate => candidate.hitSquare && legalKeys.has(`${candidate.square.x},${candidate.square.y}`));
        const candidate = legalMarker || legalPiece || ownPiece || legalBoard || candidates.find(item => item.pieceId) || candidates.find(item => item.hitSquare) || candidates[0];
        activateSquare(candidate.square);
    }
    function setViewMode(mode, persist = true) {
        viewMode = mode === '2d' ? '2d' : '3d';
        if (viewMode === '2d') settleAnimations();
        if (persist) {
            localStorage.setItem(viewModeStorageKey, viewMode);
            localStorage.setItem(explicitViewModeStorageKey, '1');
        }
        app.classList.toggle('is-2d', viewMode === '2d');
        canvas.hidden = viewMode === '2d';
        board2d.hidden = viewMode !== '2d';
        viewport.classList.toggle('is-2d', viewMode === '2d');
        viewModeButton.textContent = viewMode === '3d' ? '切换 2D' : '切换 3D';
        viewModeButton.title = viewMode === '3d' ? '切换到二维棋盘' : '切换到三维棋盘';
        resetButton.hidden = viewMode === '2d';
        if (footerGuide) footerGuide.textContent = state?.phase === 'setup' ? '布阵规则由服务器校验，确认后不可更改' : viewMode === '2d' ? '金色选中 · 铜色移动 · 深红攻击' : '左键走棋 · 右键拖动 · 滚轮缩放';
        if (viewMode === '2d') renderBoard2d(); else { resize(); requestRender(360); }
    }
    function resetCamera() { const blueView = state?.myColor === 'blue'; cameraYaw = blueView ? Math.PI : 0; cameraPitch = DEFAULT_CAMERA_PITCH; cameraDistance = DEFAULT_CAMERA_DISTANCE; lookTarget.z = blueView ? -.45 : .45; updateCamera(); }
    function updateCamera() { const horizontal = Math.sin(cameraPitch) * cameraDistance; camera.position.set(Math.sin(cameraYaw) * horizontal, Math.cos(cameraPitch) * cameraDistance, Math.cos(cameraYaw) * horizontal); camera.lookAt(lookTarget); requestRender(240); }
    function onUiClick(event) { const boardSquare = event.target.closest('[data-board-square]'); if (boardSquare) { activateSquare({ x: Number(boardSquare.dataset.x), y: Number(boardSquare.dataset.y) }); return; } const setupPiece = event.target.closest('[data-setup-piece]')?.dataset.setupPiece; if (setupPiece) { selectedSetupPieceId = setupPiece; renderSetup(); renderBoard2d(); return; } const ui = event.target.closest('[data-ui]')?.dataset.ui; if (ui === 'viewMode') setViewMode(viewMode === '3d' ? '2d' : '3d'); if (ui === 'reset') resetCamera(); if (ui === 'rules') rulesOverlay.classList.remove('is-hidden'); if (ui === 'setupReady') { send({ type: 'gameAction', action: { kind: 'setupReady' } }); selectedSetupPieceId = null; } if (ui === 'setupReset') { send({ type: 'gameAction', action: { kind: 'setupReset' } }); selectedSetupPieceId = null; } if (ui === 'closeRules' || event.target === rulesOverlay) rulesOverlay.classList.add('is-hidden'); }
    function handleMessage(message) { if (message.state) { state = message.state; if (previousPhase !== null && previousPhase !== state.phase) { selected = null; selectedSetupPieceId = null; } previousPhase = state.phase; if (selected && !pieceAt(selected.x, selected.y)) selected = null; if (selectedSetupPieceId && !state.setup?.pieces?.some(piece => piece.id === selectedSetupPieceId)) selectedSetupPieceId = null; if (state.myColor && cameraColor !== state.myColor) { cameraColor = state.myColor; resetCamera(); } renderState(); } if (message.type === 'error') addLog(message.message || '操作失败', 'error'); else if (message.action?.message) addLog(message.action.message, 'info'); }
    function updateAnimations(now) { for (let index = animations.length - 1; index >= 0; index -= 1) { const animation = animations[index]; const progress = Math.min(1, (now - animation.start) / animation.duration); const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10); if (animation.kind === 'capture') { animation.root.scale.setScalar(Math.max(.06, 1 - eased)); animation.root.position.y = PIECE_BASE_Y + Math.sin(progress * Math.PI) * .06; animation.root.rotation.z = Math.sin(progress * Math.PI) * .025; } else { animation.root.position.lerpVectors(animation.from, animation.to, eased); animation.root.position.y = PIECE_BASE_Y + Math.sin(progress * Math.PI) * .09; animation.root.rotation.z = Math.sin(progress * Math.PI) * .018; } if (progress >= 1) { if (animation.kind === 'capture') { boardScene.remove(animation.root); pieceRoots.delete(animation.root.userData.pieceId); } else { animation.root.rotation.z = 0; setPiecePosition(animation.root, animation.toX, animation.toY); } animations.splice(index, 1); } } }
    function settleAnimations() { for (const animation of animations) { if (animation.kind === 'capture') { boardScene.remove(animation.root); if (pieceRoots.get(animation.root.userData.pieceId) === animation.root) pieceRoots.delete(animation.root.userData.pieceId); } else { animation.root.scale.setScalar(1); animation.root.rotation.z = 0; setPiecePosition(animation.root, animation.toX, animation.toY); } } animations.length = 0; }
    function resize() { const rect = viewport.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return; const width = Math.floor(rect.width); const height = Math.floor(rect.height); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); requestRender(); }
    function scheduleResize() {
        requestAnimationFrame(resize);
        [80, 260, 620].forEach(delay => {
            const timer = setTimeout(() => { if (!destroyed) resize(); }, delay);
            resizeTimers.push(timer);
        });
    }
    function requestRender(holdMs = 0) { if (graphicsFailed || destroyed || viewMode === '2d') return; renderUntil = Math.max(renderUntil, performance.now() + holdMs); if (frameId === null) frameId = requestAnimationFrame(drawFrame); }
    function drawFrame(now) { frameId = null; if (graphicsFailed || destroyed || viewMode === '2d') return; updateAnimations(now); try { renderer.render(scene, camera); } catch (error) { showGraphicsError(`3D 渲染失败：${error.message}`); return; } if (animations.length || now < renderUntil) frameId = requestAnimationFrame(drawFrame); }
    function showGraphicsError(message) { if (graphicsFailed) return; graphicsFailed = true; if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; viewport.innerHTML = `<div class="junqi3d-render-error"><strong>3D 棋盘已停止</strong><span>${escapeHtml(message)}</span><small>可以先返回大厅，或尝试降低浏览器缩放和关闭其他占用显卡的页面。</small></div>`; addLog?.(message, 'error'); }

    return { gameType: 'junqi', handleMessage, destroy() { destroyed = true; if (frameId !== null) cancelAnimationFrame(frameId); resizeTimers.splice(0).forEach(timer => clearTimeout(timer)); window.removeEventListener('resize', resize); resizeObserver?.disconnect(); textureCache.forEach(texture => texture.dispose()); pieceBodyMaterials.forEach(material => material.dispose()); pieceFaceMaterials.forEach(material => material.dispose()); Object.values(materials).forEach(material => material.dispose?.()); pieceGeometry?.dispose(); pieceFaceGeometry?.dispose(); stationOutlineGeometry?.dispose(); campOutlineGeometry?.dispose(); hqOutlineGeometry?.dispose(); renderer.forceContextLoss?.(); renderer.dispose(); style.remove(); mount.innerHTML = ''; } };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
