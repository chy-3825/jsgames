import * as THREE from '/vendor/three/build/three.module.js';

import { CHESS_SKINS, FILES, GLYPHS, SKIN_STORAGE_KEY, STARTING_TYPES } from './constants.js';

export function createChessScene({ mount, model, send, addLog }) {
    let skinId = CHESS_SKINS[localStorage.getItem(SKIN_STORAGE_KEY)] ? localStorage.getItem(SKIN_STORAGE_KEY) : 'walnut';

    const viewport = mount.querySelector('[data-role="viewport"]');
    const app = mount.querySelector('.chess3d-app');
    const canvas = mount.querySelector('[data-role="canvas"]');
    const board2d = mount.querySelector('[data-role="board2d"]');
    const viewModeButton = mount.querySelector('[data-role="viewModeButton"]');
    const resetButton = mount.querySelector('[data-role="resetButton"]');
    const stageStatus = mount.querySelector('[data-role="stageStatus"]');
    const hint = mount.querySelector('[data-role="hint"]');
    const roomEl = mount.querySelector('[data-role="room"]');
    const drawButton = mount.querySelector('[data-role="drawButton"]');
    const turnEl = mount.querySelector('[data-role="turn"]');
    const lastMoveEl = mount.querySelector('[data-role="lastMove"]');
    const logEl = mount.querySelector('[data-role="log"]');
    const capturedEl = mount.querySelector('[data-role="captured"]');
    const capturedWhiteEl = mount.querySelector('[data-role="capturedWhite"]');
    const capturedBlackEl = mount.querySelector('[data-role="capturedBlack"]');
    const blackPlayerEl = mount.querySelector('[data-role="blackPlayer"]');
    const whitePlayerEl = mount.querySelector('[data-role="whitePlayer"]');
    const overlay = mount.querySelector('[data-role="rulesOverlay"]');
    const settingsOverlay = mount.querySelector('[data-role="settingsOverlay"]');
    const skinSubtitle = mount.querySelector('[data-role="skinSubtitle"]');
    const skinButtons = [...mount.querySelectorAll('[data-ui="skin"]')];
    const promotionOverlay = mount.querySelector('[data-role="promotionOverlay"]');
    const promotionButtons = [...mount.querySelectorAll('[data-ui="promotion"]')];

    const initialSkin = CHESS_SKINS[skinId];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialSkin.scene);
    scene.fog = new THREE.Fog(initialSkin.scene, 14, 29);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
        viewport.innerHTML = '<div class="chess3d-render-error"><strong>3D 棋盘无法启动</strong><span>当前浏览器没有可用的 WebGL 图形加速，请更换浏览器或关闭硬件加速后重试。</span></div>';
        addLog?.(`国际象棋 3D 初始化失败：${error.message}`, 'error');
        return { gameType: 'chess', handleMessage() {}, getActionBindings() { return null; }, destroy() {} };
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.1 : 1.25));

    const boardScene = new THREE.Group();
    scene.add(boardScene);
    const tileMeshes = new Map();
    const pieceRoots = new Map();
    const pieceGeometries = new Set();
    const animations = [];
    const effects = [];
    const landingEffectGeometry = new THREE.RingGeometry(.18, .32, 24);
    const threatGlowGroup = new THREE.Group();
    const threatGlowGeometry = new THREE.PlaneGeometry(1.16, 1.16);
    const threatGlowTexture = createThreatGlowTexture();
    const threatGlowMaterials = {
        check: new THREE.MeshBasicMaterial({ map: threatGlowTexture, color: '#78000d', transparent: true, opacity: .76, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        mate: new THREE.MeshBasicMaterial({ map: threatGlowTexture, color: '#ff202d', transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        king: new THREE.MeshBasicMaterial({ map: threatGlowTexture, color: '#c20b1b', transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    };
    const activeThreatGlows = [];
    threatGlowGroup.renderOrder = 4;
    boardScene.add(threatGlowGroup);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const interactive = [];
    const lookTarget = new THREE.Vector3(0, 0.35, 0);
    const materials = createMaterials();
    const viewModeStorageKey = 'jsgames.chess.viewMode';
    const explicitViewModeStorageKey = `${viewModeStorageKey}.explicit`;
    const savedViewMode = localStorage.getItem(viewModeStorageKey);
    const isCompactPointer = window.matchMedia?.('(max-width: 760px), (pointer: coarse), (max-width: 900px) and (max-height: 500px)').matches;
    let state = model?.state || null;
    let previousPieces = new Map();
    let selected = null;
    let pendingPromotion = null;
    let studyPlacement = null;
    let viewMode = isCompactPointer && localStorage.getItem(explicitViewModeStorageKey) !== '1'
        ? '2d'
        : savedViewMode === '2d' ? '2d' : '3d';
    let cameraYaw = 0;
    let cameraPitch = .75;
    let cameraDistance = 14.2;
    let dragging = false;
    let dragPointerId = null;
    let lastPointer = { x: 0, y: 0 };
    let destroyed = false;
    let graphicsFailed = false;
    let frameId = null;
    let renderUntil = 0;
    let hemisphereLight;
    let keyLight;
    let rimLight;
    let tableMesh;

    createEnvironment();
    applySkin(skinId, false);
    resetCamera();
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(viewport);
    requestAnimationFrame(resize);
    setViewMode(viewMode, false);

    function getActionBindings() {
        return {
            windowRef: globalThis.window || globalThis,
            viewport,
            canvas,
            mount,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onWheel,
            onKeyDown,
            onUiClick,
            onContextMenu(event) { event.preventDefault(); },
            onContextLost(event) { event.preventDefault(); showGraphicsError('WebGL 图形上下文已丢失，可能是设备资源不足。'); },
        };
    }

    function createMaterials() {
        const skin = CHESS_SKINS[skinId];
        return {
            ivory: new THREE.MeshPhysicalMaterial({ color: skin.ivory, roughness: 0.43, metalness: 0.01, clearcoat: 0.28, clearcoatRoughness: 0.42 }),
            ebony: new THREE.MeshPhysicalMaterial({ color: skin.ebony, roughness: 0.38, metalness: 0.02, clearcoat: 0.34, clearcoatRoughness: 0.36 }),
            ivoryDetail: new THREE.MeshStandardMaterial({ color: skin.ivoryDetail, roughness: 0.76, metalness: 0 }),
            ebonyDetail: new THREE.MeshStandardMaterial({ color: skin.ebonyDetail, roughness: 0.68, metalness: 0.01 }),
            lightTile: new THREE.MeshPhysicalMaterial({ color: skin.lightTile, roughness: 0.42, metalness: 0.01, clearcoat: 0.24, clearcoatRoughness: 0.36 }),
            darkTile: new THREE.MeshPhysicalMaterial({ color: skin.darkTile, roughness: 0.36, metalness: 0.01, clearcoat: 0.28, clearcoatRoughness: 0.32 }),
            frame: new THREE.MeshPhysicalMaterial({ color: skin.frame, roughness: 0.34, metalness: 0.01, clearcoat: 0.58, clearcoatRoughness: 0.2 }),
            table: new THREE.MeshStandardMaterial({ color: skin.table, roughness: 0.64, metalness: 0.01 }),
        };
    }

    function createThreatGlowTexture() {
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 192; glowCanvas.height = 192;
        const context = glowCanvas.getContext('2d');
        const gradient = context.createRadialGradient(96, 96, 8, 96, 96, 92);
        gradient.addColorStop(0, 'rgba(255,255,255,.98)');
        gradient.addColorStop(.28, 'rgba(255,255,255,.78)');
        gradient.addColorStop(.63, 'rgba(255,255,255,.28)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 192, 192);
        const texture = new THREE.CanvasTexture(glowCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    function createEnvironment() {
        const skin = CHESS_SKINS[skinId];
        hemisphereLight = new THREE.HemisphereLight(skin.hemisphereSky, skin.hemisphereGround, 2.5);
        scene.add(hemisphereLight);
        keyLight = new THREE.DirectionalLight(skin.key, 3.8);
        keyLight.position.set(-5, 11, 7); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.left = -7; keyLight.shadow.camera.right = 7; keyLight.shadow.camera.top = 7; keyLight.shadow.camera.bottom = -7; keyLight.shadow.bias = -0.0007;
        scene.add(keyLight);
        rimLight = new THREE.DirectionalLight(skin.rim, skin.rimIntensity); rimLight.position.set(6, 5, -8); scene.add(rimLight);
        tableMesh = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 13.8, 0.35, 64), materials.table);
        tableMesh.position.y = -0.42; tableMesh.receiveShadow = true; scene.add(tableMesh);
        createBoard();
    }

    function applySkin(nextSkinId, persist = true) {
        const nextSkin = CHESS_SKINS[nextSkinId];
        if (!nextSkin) return;
        skinId = nextSkinId;
        app.dataset.skin = skinId;
        skinSubtitle.textContent = nextSkin.subtitle;
        scene.background.set(nextSkin.scene);
        scene.fog.color.set(nextSkin.scene);
        materials.ivory.color.set(nextSkin.ivory);
        materials.ebony.color.set(nextSkin.ebony);
        materials.ivoryDetail.color.set(nextSkin.ivoryDetail);
        materials.ebonyDetail.color.set(nextSkin.ebonyDetail);
        materials.lightTile.color.set(nextSkin.lightTile);
        materials.darkTile.color.set(nextSkin.darkTile);
        materials.frame.color.set(nextSkin.frame);
        materials.table.color.set(nextSkin.table);
        const isSlate = skinId === 'slate';
        materials.frame.metalness = isSlate ? .46 : .01;
        materials.frame.roughness = isSlate ? .3 : .34;
        materials.darkTile.metalness = isSlate ? .08 : .01;
        materials.table.metalness = isSlate ? .12 : .01;
        for (const [squareId, tile] of tileMeshes) {
            const [x, y] = squareId.split(',').map(Number);
            tile.userData.baseColor.set((x + y) % 2 === 0 ? nextSkin.lightTile : nextSkin.darkTile);
            tile.material.color.copy(tile.userData.baseColor);
            tile.material.metalness = (x + y) % 2 === 0 ? .01 : (isSlate ? .08 : .01);
        }
        hemisphereLight.color.set(nextSkin.hemisphereSky);
        hemisphereLight.groundColor.set(nextSkin.hemisphereGround);
        keyLight.color.set(nextSkin.key);
        rimLight.color.set(nextSkin.rim);
        rimLight.intensity = nextSkin.rimIntensity;
        skinButtons.forEach(button => {
            const active = button.dataset.skin === skinId;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (persist) localStorage.setItem(SKIN_STORAGE_KEY, skinId);
        if (state) renderTiles();
        else requestRender(360);
    }

    function createBoard() {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const material = (x + y) % 2 === 0 ? materials.lightTile.clone() : materials.darkTile.clone();
            const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), material);
            tile.position.set(x - 3.5, 0, y - 3.5); tile.receiveShadow = true; tile.userData.square = { x, y }; tile.userData.baseColor = material.color.clone();
            boardScene.add(tile); tileMeshes.set(`${x},${y}`, tile); interactive.push(tile);
        }
        const frameParts = [
            [0, -0.14, -4.15, 8.85, 0.35, 0.3], [0, -0.14, 4.15, 8.85, 0.35, 0.3],
            [-4.15, -0.14, 0, 0.3, 0.35, 8.0], [4.15, -0.14, 0, 0.3, 0.35, 8.0],
        ];
        frameParts.forEach(([x, y, z, sx, sy, sz]) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), materials.frame); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; boardScene.add(mesh); });
        const underlay = new THREE.Mesh(new THREE.BoxGeometry(9.05, 0.25, 9.05), materials.frame); underlay.position.y = -0.26; underlay.castShadow = true; underlay.receiveShadow = true; boardScene.add(underlay);
    }

    function createPiece(piece) {
        const root = new THREE.Group();
        root.userData.pieceId = piece.id; root.userData.type = piece.type; root.userData.color = piece.color; root.userData.square = { x: piece.x, y: piece.y };
        const material = piece.color === 'white' ? materials.ivory : materials.ebony;
        const model = piece.type === 'p' ? createPawn(material) : piece.type === 'n' ? createKnight(material) : piece.type === 'b' ? createBishop(material) : piece.type === 'r' ? createRook(material) : piece.type === 'q' ? createQueen(material) : createKing(material);
        model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
        root.add(model); setPiecePosition(root, piece.x, piece.y); boardScene.add(root); return root;
    }

    // Staunton 棋子的辨识首先来自一致的宽底座和逐级拉开的高度，随后才是冠部细节。
    // 这里保留程序化几何，确保两套皮肤、升变动画和点击命中继续共用同一套模型。
    function pieceMesh(geometry, material) { pieceGeometries.add(geometry); return new THREE.Mesh(geometry, material); }
    function lathe(profile, material, segments = 48) { const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments); geometry.computeVertexNormals(); return pieceMesh(geometry, material); }
    function detailMaterial(material) { return material === materials.ivory ? materials.ivoryDetail : materials.ebonyDetail; }
    function baseProfile(radius, neckRadius) {
        return [[0, 0], [radius * .78, 0], [radius * .94, .014], [radius, .045], [radius, .072], [radius * .96, .098], [radius * .86, .128], [radius * .82, .154], [radius * .79, .178], [radius * .68, .205], [radius * .58, .232], [neckRadius, .27], [neckRadius * .96, .305]];
    }
    function addCollar(root, material, y, radius, tube = .026) { const ring = pieceMesh(new THREE.TorusGeometry(radius, tube, 10, 40), material); ring.rotation.x = Math.PI / 2; ring.position.y = y; root.add(ring); return ring; }
    function createPawn(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.285, .115), [.13, .33], [.12, .405], [.135, .465], [.175, .505], [.155, .535]], material));
        const head = pieceMesh(new THREE.SphereGeometry(.168, 32, 22), material); head.position.y = .68; root.add(head);
        return root;
    }
    function createRook(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.34, .18), [.19, .36], [.185, .49], [.215, .565], [.255, .61], [.285, .655], [.292, .705], [.255, .73], [0, .73]], material));
        addCollar(root, material, .67, .266, .032);
        for (let index = 0; index < 6; index += 1) {
            const angle = index * Math.PI / 3;
            const merlon = pieceMesh(new THREE.BoxGeometry(.135, .145, .12, 2, 2, 2), material);
            merlon.position.set(Math.cos(angle) * .218, .795, Math.sin(angle) * .218);
            merlon.rotation.y = -angle;
            root.add(merlon);
        }
        const well = pieceMesh(new THREE.CylinderGeometry(.185, .185, .012, 40), detailMaterial(material)); well.position.y = .739; root.add(well);
        return root;
    }
    function addBishopMitre(root, material) {
        const grooveMaterial = detailMaterial(material);
        for (const z of [-.146, .146]) {
            const groove = pieceMesh(new THREE.CapsuleGeometry(.014, .17, 4, 8), grooveMaterial);
            groove.scale.z = .42;
            groove.rotation.z = -.47;
            groove.position.set(0, 1.005, z);
            root.add(groove);
        }
    }
    function createBishop(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.33, .115), [.135, .35], [.13, .53], [.115, .66], [.14, .72], [.205, .765], [.19, .81], [.11, .845]], material));
        addCollar(root, material, .765, .18, .027);
        root.add(lathe([[0, .84], [.105, .84], [.155, .875], [.178, .94], [.17, 1.005], [.125, 1.085], [.045, 1.17], [0, 1.19]], material));
        addBishopMitre(root, material);
        return root;
    }
    function addQueenCrown(root, material) {
        addCollar(root, material, 1.035, .178, .034);
        const up = new THREE.Vector3(0, 1, 0);
        for (let index = 0; index < 8; index += 1) {
            const angle = index * Math.PI / 4;
            const direction = new THREE.Vector3(Math.cos(angle) * .24, 1, Math.sin(angle) * .24).normalize();
            const spike = pieceMesh(new THREE.ConeGeometry(.035, .17, 12), material);
            spike.quaternion.setFromUnitVectors(up, direction);
            spike.position.set(Math.cos(angle) * .154, 1.13, Math.sin(angle) * .154);
            root.add(spike);
            const pearl = pieceMesh(new THREE.SphereGeometry(.036, 16, 12), material);
            pearl.position.set(Math.cos(angle) * .176, 1.225, Math.sin(angle) * .176);
            root.add(pearl);
        }
        const finial = pieceMesh(new THREE.SphereGeometry(.073, 24, 16), material); finial.position.y = 1.255; root.add(finial);
    }
    function createQueen(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.35, .125), [.145, .36], [.14, .57], [.12, .72], [.155, .79], [.225, .84], [.205, .895], [.145, .95], [.185, 1.01], [.165, 1.055], [0, 1.055]], material));
        addCollar(root, material, .84, .205, .026);
        addQueenCrown(root, material);
        return root;
    }
    function kingCrossGeometry() {
        const shape = new THREE.Shape();
        shape.moveTo(-.035, -.14); shape.lineTo(.035, -.14); shape.lineTo(.035, -.035); shape.lineTo(.115, -.035); shape.lineTo(.115, .035); shape.lineTo(.035, .035); shape.lineTo(.035, .14); shape.lineTo(-.035, .14); shape.lineTo(-.035, .035); shape.lineTo(-.115, .035); shape.lineTo(-.115, -.035); shape.lineTo(-.035, -.035); shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelThickness: .012, bevelSize: .01, bevelSegments: 3, curveSegments: 8 });
        geometry.translate(0, 0, -.035); return geometry;
    }
    function createKing(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.36, .13), [.15, .37], [.145, .59], [.125, .75], [.165, .82], [.23, .87], [.215, .925], [.15, .98], [.19, 1.04], [.135, 1.09], [0, 1.09]], material));
        addCollar(root, material, .87, .21, .028);
        const orb = pieceMesh(new THREE.SphereGeometry(.105, 28, 18), material); orb.position.y = 1.14; root.add(orb);
        const cross = pieceMesh(kingCrossGeometry(), material); cross.position.y = 1.355; root.add(cross);
        return root;
    }
    function knightShape() {
        const shape = new THREE.Shape();
        shape.moveTo(-.17, .405);
        shape.bezierCurveTo(-.21, .54, -.235, .69, -.17, .81);
        shape.bezierCurveTo(-.125, .9, -.075, .975, -.015, 1.015);
        shape.lineTo(-.045, 1.14);
        shape.lineTo(.018, 1.085);
        shape.lineTo(.075, 1.17);
        shape.lineTo(.112, 1.055);
        shape.bezierCurveTo(.205, 1.01, .285, .925, .32, .835);
        shape.bezierCurveTo(.35, .755, .3, .69, .225, .66);
        shape.bezierCurveTo(.175, .642, .12, .65, .085, .625);
        shape.bezierCurveTo(.052, .6, .07, .565, .12, .525);
        shape.bezierCurveTo(.175, .48, .2, .44, .185, .405);
        shape.closePath();
        return shape;
    }
    function addKnightFaceDetails(root, material, depth) {
        const accent = detailMaterial(material);
        for (const z of [-depth / 2 - .01, depth / 2 + .01]) {
            const eye = pieceMesh(new THREE.SphereGeometry(.026, 14, 10), accent); eye.scale.z = .48; eye.position.set(.13, .925, z); root.add(eye);
            const nostril = pieceMesh(new THREE.SphereGeometry(.016, 12, 8), accent); nostril.scale.z = .42; nostril.position.set(.262, .77, z); root.add(nostril);
            for (let index = 0; index < 3; index += 1) {
                const mane = pieceMesh(new THREE.CapsuleGeometry(.009, .085, 3, 6), accent); mane.scale.z = .36; mane.rotation.z = -.38; mane.position.set(-.13 + index * .018, .72 + index * .085, z); root.add(mane);
            }
        }
    }
    function createKnight(material) {
        const root = new THREE.Group();
        root.add(lathe([...baseProfile(.34, .17), [.205, .345], [.23, .39], [.215, .43], [.17, .455], [0, .455]], material));
        addCollar(root, material, .39, .215, .028);
        const depth = .29;
        const geometry = new THREE.ExtrudeGeometry(knightShape(), { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .028, bevelSegments: 4, curveSegments: 18 });
        geometry.translate(0, 0, -depth / 2); geometry.computeVertexNormals();
        root.add(pieceMesh(geometry, material));
        addKnightFaceDetails(root, material, depth);
        return root;
    }
    function setPiecePosition(root, x, y) { root.position.set(x - 3.5, .1, y - 3.5); root.userData.square = { x, y }; }

    function syncPieces(nextPieces) {
        const nextMap = new Map(nextPieces.map(piece => [piece.id, piece]));
        if (viewMode === '2d') {
            settleAnimations();
            for (const [id, root] of pieceRoots) if (!nextMap.has(id)) { boardScene.remove(root); pieceRoots.delete(id); }
            for (const piece of nextPieces) {
                let root = pieceRoots.get(piece.id);
                if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) { if (root) boardScene.remove(root); root = createPiece(piece); pieceRoots.set(piece.id, root); }
                root.userData.captured = false;
                setPiecePosition(root, piece.x, piece.y);
            }
            previousPieces = new Map(nextPieces.map(piece => [piece.id, piece]));
            return;
        }
        for (const [id, root] of pieceRoots) if (!nextMap.has(id) && !root.userData.captured) {
            root.userData.captured = true;
            animations.push({ kind: 'capture', root, start: performance.now(), duration: 260 });
        }
        for (const piece of nextPieces) {
            const old = previousPieces.get(piece.id); const root = pieceRoots.get(piece.id);
            if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) {
                if (root) boardScene.remove(root);
                const created = createPiece(piece);
                pieceRoots.set(piece.id, created);
                if (old && old.type === 'p' && piece.type !== 'p') animatePromotion(created, piece);
            } else if (old && (old.x !== piece.x || old.y !== piece.y)) {
                animatePiece(root, old.x, old.y, piece.x, piece.y, piece.type);
                root.userData.square = { x: piece.x, y: piece.y };
            }
            else setPiecePosition(root, piece.x, piece.y);
        }
        previousPieces = new Map(nextPieces.map(piece => [piece.id, piece]));
    }
    function animatePiece(root, fromX, fromY, toX, toY, type) {
        const knight = type === 'n';
        animations.push({
            kind: 'move', root, type,
            from: new THREE.Vector3(fromX - 3.5, .1, fromY - 3.5),
            to: new THREE.Vector3(toX - 3.5, .1, toY - 3.5),
            start: performance.now(), duration: knight ? 520 : 380,
            lift: knight ? .72 : .22, toX, toY,
        });
    }
    function animatePromotion(root, piece) {
        root.scale.setScalar(.12);
        animations.push({ kind: 'promotion', root, start: performance.now(), duration: 360, toX: piece.x, toY: piece.y });
    }
    function createLandingEffect(x, y) {
        const material = new THREE.MeshBasicMaterial({ color: '#e7bd58', transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(landingEffectGeometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x - 3.5, .08, y - 3.5);
        boardScene.add(ring);
        effects.push({ ring, material, start: performance.now(), duration: 260 });
    }
    function updateAnimations(now) {
        for (let i = animations.length - 1; i >= 0; i--) {
            const animation = animations[i];
            const progress = Math.min(1, (now - animation.start) / animation.duration);
            const eased = progress * progress * (3 - 2 * progress);
            if (animation.kind === 'capture') {
                animation.root.scale.setScalar(Math.max(.06, 1 - eased));
                animation.root.rotation.z = Math.sin(progress * Math.PI) * .18;
                animation.root.position.y = .1 + Math.sin(progress * Math.PI) * .14;
            } else if (animation.kind === 'promotion') {
                animation.root.scale.setScalar(.12 + eased * .88);
                animation.root.position.y = .1 + Math.sin(progress * Math.PI) * .12;
            } else {
                animation.root.position.lerpVectors(animation.from, animation.to, eased);
                animation.root.position.y = .1 + Math.sin(eased * Math.PI) * animation.lift;
                if (animation.type === 'n') animation.root.rotation.z = Math.sin(eased * Math.PI) * .045;
            }
            if (progress >= 1) {
                if (animation.kind === 'capture') {
                    boardScene.remove(animation.root);
                    if (pieceRoots.get(animation.root.userData.pieceId) === animation.root) pieceRoots.delete(animation.root.userData.pieceId);
                } else {
                    animation.root.scale.setScalar(1);
                    animation.root.rotation.z = 0;
                    setPiecePosition(animation.root, animation.toX ?? animation.root.userData.square.x, animation.toY ?? animation.root.userData.square.y);
                    createLandingEffect(animation.toX ?? animation.root.userData.square.x, animation.toY ?? animation.root.userData.square.y);
                }
                animations.splice(i, 1);
            }
        }
    }
    function updateEffects(now) {
        for (let i = effects.length - 1; i >= 0; i--) {
            const effect = effects[i];
            const progress = Math.min(1, (now - effect.start) / effect.duration);
            effect.ring.scale.setScalar(.72 + progress * 1.32);
            effect.material.opacity = .62 * (1 - progress);
            if (progress >= 1) {
                boardScene.remove(effect.ring);
                effect.material.dispose();
                effects.splice(i, 1);
            }
        }
    }

    function syncThreatGlows() {
        for (const glow of activeThreatGlows) threatGlowGroup.remove(glow);
        activeThreatGlows.length = 0;
        if (!state?.check) return;
        const mate = Boolean(state.checkmate);
        const threatIds = mate ? state.checkmateParticipantIds || [] : state.checkingPieceIds || [];
        const glowTargets = threatIds.map(id => ({ id, kind: mate ? 'mate' : 'check' }));
        if (mate && state.checkedKingId) glowTargets.push({ id: state.checkedKingId, kind: 'king' });
        const seen = new Set();
        for (const target of glowTargets) {
            if (seen.has(target.id)) continue;
            seen.add(target.id);
            const piece = state.pieces?.find(item => item.id === target.id);
            if (!piece) continue;
            const glow = new THREE.Mesh(threatGlowGeometry, threatGlowMaterials[target.kind]);
            glow.rotation.x = -Math.PI / 2;
            glow.position.set(piece.x - 3.5, .075, piece.y - 3.5);
            glow.scale.setScalar(target.kind === 'king' ? 1.06 : 1);
            glow.userData.baseScale = target.kind === 'king' ? 1.06 : 1;
            glow.renderOrder = 4;
            threatGlowGroup.add(glow);
            activeThreatGlows.push(glow);
        }
    }

    function updateThreatGlows(now) {
        if (!activeThreatGlows.length) return;
        const pulse = 1 + Math.sin(now * .007) * .045;
        for (const glow of activeThreatGlows) glow.scale.setScalar(glow.userData.baseScale * pulse);
    }

    function renderState() {
        if (!state) return;
        roomEl.textContent = state.roomId ? `房间 ${state.roomId}` : '自由对局';
        const current = state.players?.find(player => player.id === state.currentTurn);
        const ended = state.status === 'ended';
        turnEl.innerHTML = ended ? `<span class="chess3d-dot ended"></span>${escapeHtml(state.winner?.name || state.drawReason || '和棋')}` : `<span class="chess3d-dot"></span>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}`;
        stageStatus.textContent = ended ? (state.checkmate && state.winner ? `将杀 · ${state.winner.name} 获胜` : state.winner ? `${state.winner.name} 获胜` : state.drawReason || '和棋') : state.check ? '将军' : '';
        stageStatus.classList.toggle('is-check', Boolean(state.check && !ended));
        stageStatus.classList.toggle('is-mate', Boolean(state.checkmate));
        drawButton.hidden = ended || !state.canClaimDraw;
        hint.textContent = ended ? '本局已结束' : pendingPromotion ? '请选择升变棋子' : state.myIsCurrentTurn ? (selected ? '蓝色可走 · 红色可吃' : '选择你的棋子') : `等待 ${current?.name || '对手'} 走棋`;
        lastMoveEl.innerHTML = state.lastMove ? `<small>最后一步</small><strong>${formatMove(state.lastMove)}</strong>` : '<small>棋局开始</small>';
        logEl.innerHTML = (state.actionLog || []).slice(-4).reverse().map((entry, index) => `<span class="${index === 0 ? 'is-latest' : ''}">${escapeHtml(entry)}</span>`).join('');
        renderPlayer(blackPlayerEl, state.players?.find(player => player.color === 'black'), 'black');
        renderPlayer(whitePlayerEl, state.players?.find(player => player.color === 'white'), 'white');
        renderTiles(); renderCaptured(); syncPieces(state.pieces || []); syncThreatGlows(); renderBoard2d(); requestRender(state.check ? 1100 : 520);
    }
    function renderPlayer(element, player, color) { if (!player) { element.innerHTML = ''; return; } const me = player.id === state.myId; element.className = `chess3d-player-card ${color} ${player.isCurrentTurn ? 'is-current' : ''}`; element.innerHTML = `<span class="chess3d-player-color">${color === 'white' ? '白方' : '黑方'}</span><strong>${escapeHtml(player.name)}${me ? ' · 我' : ''}</strong><small>${player.isCurrentTurn ? '正在行动' : player.isOnline === false ? '已离线' : color === state.myColor ? '你的棋子' : '等待中'}</small>`; }
    function renderTiles() { const last = state.lastMove; for (const [id, tile] of tileMeshes) { const [x, y] = id.split(',').map(Number); const selectedHere = selected?.x === x && selected?.y === y; const target = selected ? legalTargetAt(x, y) : null; const captureHere = Boolean(target?.capture || (target && pieceAt(x, y))); const lastHere = Boolean(last && ((last.from.x === x && last.from.y === y) || (last.to.x === x && last.to.y === y))); tile.material.color.copy(tile.userData.baseColor); tile.material.emissive.set(selectedHere ? '#e7bd58' : captureHere ? '#d21f2b' : target ? '#247fc1' : lastHere ? '#967b43' : '#000000'); tile.material.emissiveIntensity = selectedHere ? .72 : captureHere ? .86 : target ? .64 : lastHere ? .25 : 0; } requestRender(); }
    function renderCaptured() {
        if (!state?.pieces) return;
        const alive = new Set(state.pieces.map(piece => piece.id));
        const missing = color => [
            ...STARTING_TYPES.map((type, index) => ({ id: `${color[0]}${type}${index}`, type })),
            ...Array.from({ length: 8 }, (_, index) => ({ id: `${color[0]}p${index}`, type: 'p' })),
        ].filter(piece => !alive.has(piece.id));
        const white = missing('white'); const black = missing('black');
        capturedWhiteEl.innerHTML = white.map(piece => `<span class="chess3d-captured-piece">${GLYPHS.white[piece.type]}</span>`).join('');
        capturedBlackEl.innerHTML = black.map(piece => `<span class="chess3d-captured-piece">${GLYPHS.black[piece.type]}</span>`).join('');
        capturedEl.classList.toggle('has-captured', white.length + black.length > 0);
    }

    function renderBoard2d() {
        if (!state || viewMode !== '2d') return;
        const flip = state.myColor === 'black';
        const last = state.lastMove;
        const checkingPieceIds = new Set(state.checkingPieceIds || []);
        const mateParticipantIds = new Set(state.checkmateParticipantIds || []);
        const squares = [];
        for (let screenY = 0; screenY < 8; screenY += 1) for (let screenX = 0; screenX < 8; screenX += 1) {
            const x = flip ? 7 - screenX : screenX;
            const y = flip ? 7 - screenY : screenY;
            const piece = pieceAt(x, y);
            const target = selected ? legalTargetAt(x, y) : null;
            const lastHere = Boolean(last && ((last.from.x === x && last.from.y === y) || (last.to.x === x && last.to.y === y)));
            const classes = ['chess2d-square', (x + y) % 2 ? 'is-dark' : 'is-light', selected?.x === x && selected?.y === y ? 'is-selected' : '', target ? (target.capture || piece ? 'can-capture' : 'can-move') : '', lastHere ? 'is-last' : '', piece && mateParticipantIds.has(piece.id) ? 'is-mate-participant' : '', piece && !state.checkmate && checkingPieceIds.has(piece.id) ? 'is-checker' : '', piece?.id === state.checkedKingId && state.checkmate ? 'is-checked-king' : ''].filter(Boolean).join(' ');
            const glyph = piece ? GLYPHS[piece.color]?.[piece.type] || '?' : '';
            const file = screenY === 7 ? `<small class="file-label">${FILES[x]}</small>` : '';
            const rank = screenX === 0 ? `<small class="rank-label">${8 - y}</small>` : '';
            squares.push(`<button type="button" class="${classes}" data-board-square data-x="${x}" data-y="${y}" aria-label="${piece ? `${piece.color} ${piece.type}` : `${FILES[x]}${8 - y}`}"><span class="chess2d-piece ${piece?.color || ''}">${glyph}</span>${file}${rank}</button>`);
        }
        board2d.innerHTML = `<div class="chess2d-grid">${squares.join('')}</div>`;
    }

    function onPointerDown(event) { if (viewMode === '2d') return; if (event.button === 2 || event.shiftKey) { dragging = true; dragPointerId = event.pointerId; lastPointer = { x: event.clientX, y: event.clientY }; viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging'); return; } if (event.button === 0) selectFromPointer(event); }
    function onPointerMove(event) { if (!dragging || event.pointerId !== dragPointerId) return; const dx = event.clientX - lastPointer.x; const dy = event.clientY - lastPointer.y; lastPointer = { x: event.clientX, y: event.clientY }; cameraYaw -= dx * .006; cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * .004, .52, .9); updateCamera(); }
    function onPointerUp(event) { if (event.pointerId !== dragPointerId) return; dragging = false; dragPointerId = null; viewport.releasePointerCapture?.(event.pointerId); viewport.classList.remove('is-dragging'); }
    function onWheel(event) { if (viewMode === '2d') return; event.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .008, 11.8, 18.5); updateCamera(); }
    function activateSquare(square) { if (!state || state.status === 'ended' || animations.length || pendingPromotion) return; if (state.studyMode && state.studyPhase === 'setup' && studyPlacement) { const placement = studyPlacement; studyPlacement = null; send({ type: 'gameAction', action: { kind: 'studySetup', op: placement.remove ? 'remove' : 'place', x: square.x, y: square.y, ...(placement.remove ? {} : { pieceType: placement.type, color: state.myColor }) } }); return; } const piece = pieceAt(square.x, square.y); if (selected && isLegalTarget(square.x, square.y)) { const moving = pieceAt(selected.x, selected.y); const promotionRank = square.y === 0 || square.y === 7; if (moving?.type === 'p' && promotionRank) { pendingPromotion = { from: selected, to: { x: square.x, y: square.y }, color: moving.color }; selected = null; showPromotionChoices(moving.color); renderTiles(); renderBoard2d(); return; } sendMove(selected, { x: square.x, y: square.y }); selected = null; renderTiles(); renderBoard2d(); return; } selected = piece && piece.color === state.myColor && state.myIsCurrentTurn && (state.legalMoves?.[piece.id] || []).length ? { x: square.x, y: square.y } : null; renderTiles(); renderBoard2d(); }
    function selectFromPointer(event) { if (!state || state.status === 'ended' || animations.length || pendingPromotion) return; const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(interactive.concat([...pieceRoots.values()]), true); let square = null; let pieceId = null; for (const hit of hits) { let object = hit.object; while (object) { if (object.userData.square) square = object.userData.square; if (object.userData.pieceId) pieceId = object.userData.pieceId; object = object.parent; } if (square || pieceId) break; } if (!square && pieceId) { const located = state.pieces.find(piece => piece.id === pieceId); square = located ? { x: located.x, y: located.y } : null; } if (square) activateSquare(square); }
    function sendMove(from, to, promotion = null) { const action = { kind: 'move', from, to }; if (promotion) action.promotion = promotion; send({ type: 'gameAction', action }); }
    function showPromotionChoices(color) { promotionButtons.forEach(button => { button.textContent = GLYPHS[color][button.dataset.promotion]; button.classList.toggle('is-black', color === 'black'); }); promotionOverlay.classList.remove('is-hidden'); }
    function choosePromotion(type) { if (!pendingPromotion) return; const move = pendingPromotion; pendingPromotion = null; promotionOverlay.classList.add('is-hidden'); sendMove(move.from, move.to, type); renderTiles(); renderBoard2d(); }
    function pieceAt(x, y) { return state?.pieces?.find(piece => piece.x === x && piece.y === y) || null; }
    function legalTargetAt(x, y) { if (!selected) return null; const piece = pieceAt(selected.x, selected.y); return piece ? state.legalMoves?.[piece.id]?.find(move => move.x === x && move.y === y) || null : null; }
    function isLegalTarget(x, y) { return Boolean(legalTargetAt(x, y)); }
    function resetCamera() { cameraYaw = state?.myColor === 'black' ? Math.PI : 0; cameraPitch = .75; cameraDistance = 14.2; updateCamera(); }
    function setViewMode(mode, persist = true) { viewMode = mode === '2d' ? '2d' : '3d'; if (viewMode === '2d') settleAnimations(); if (persist) { localStorage.setItem(viewModeStorageKey, viewMode); localStorage.setItem(explicitViewModeStorageKey, '1'); } canvas.hidden = viewMode === '2d'; board2d.hidden = viewMode !== '2d'; viewport.classList.toggle('is-2d', viewMode === '2d'); viewModeButton.textContent = viewMode === '3d' ? '2D' : '3D'; viewModeButton.title = `切换到 ${viewModeButton.textContent} 棋盘`; resetButton.hidden = viewMode === '2d'; if (viewMode === '2d') renderBoard2d(); else { resize(); requestRender(360); } }
    function updateCamera() { const horizontal = Math.sin(cameraPitch) * cameraDistance; camera.position.set(Math.sin(cameraYaw) * horizontal, Math.cos(cameraPitch) * cameraDistance, Math.cos(cameraYaw) * horizontal); camera.lookAt(lookTarget); requestRender(240); }
    function formatMove(move) { return `${FILES[move.from.x]}${8 - move.from.y} → ${FILES[move.to.x]}${8 - move.to.y}`; }
    function onUiClick(event) { const boardSquare = event.target.closest('[data-board-square]'); if (boardSquare) { activateSquare({ x: Number(boardSquare.dataset.x), y: Number(boardSquare.dataset.y) }); return; } const control = event.target.closest('[data-ui]'); const ui = control?.dataset.ui; if (ui === 'draw') send({ type: 'gameAction', action: { kind: 'claimDraw' } }); if (ui === 'promotion') choosePromotion(event.target.closest('[data-promotion]')?.dataset.promotion); if (ui === 'viewMode') setViewMode(viewMode === '3d' ? '2d' : '3d'); if (ui === 'reset') resetCamera(); if (ui === 'settings') { overlay.classList.add('is-hidden'); settingsOverlay.classList.remove('is-hidden'); settingsOverlay.querySelector('[data-ui="closeSettings"]')?.focus(); } if (ui === 'skin') { applySkin(control.dataset.skin); settingsOverlay.classList.add('is-hidden'); } if (ui === 'closeSettings' || event.target === settingsOverlay) settingsOverlay.classList.add('is-hidden'); if (ui === 'rules') { settingsOverlay.classList.add('is-hidden'); overlay.classList.remove('is-hidden'); } if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden'); }
    function onKeyDown(event) { if (event.key !== 'Escape') return; settingsOverlay.classList.add('is-hidden'); overlay.classList.add('is-hidden'); }
    function handleMessage(message) { if (message.state) { state = message.state; if (model) model.state = state; if (state.studyMode && state.studyPhase === 'setup' && viewMode !== '2d') setViewMode('2d', false); if (selected && !pieceAt(selected.x, selected.y)) selected = null; if (pendingPromotion && state.lastMove) { pendingPromotion = null; promotionOverlay.classList.add('is-hidden'); } if (state.myColor) resetCamera(); renderState(); } if (message.type === 'error') addLog(message.message || '操作失败', 'error'); else if (message.action?.message) addLog(message.action.message, 'info'); }
    function resize() { const rect = viewport.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return; const width = Math.floor(rect.width); const height = Math.floor(rect.height); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); requestRender(); }
    function settleAnimations() { for (const animation of animations) { if (animation.kind === 'capture') { boardScene.remove(animation.root); if (pieceRoots.get(animation.root.userData.pieceId) === animation.root) pieceRoots.delete(animation.root.userData.pieceId); } else { animation.root.scale.setScalar(1); animation.root.rotation.z = 0; setPiecePosition(animation.root, animation.toX ?? animation.root.userData.square.x, animation.toY ?? animation.root.userData.square.y); } } animations.length = 0; for (const effect of effects) { boardScene.remove(effect.ring); effect.material.dispose(); } effects.length = 0; }
    function requestRender(holdMs = 0) { if (graphicsFailed || destroyed || viewMode === '2d') return; renderUntil = Math.max(renderUntil, performance.now() + holdMs); if (frameId === null) frameId = requestAnimationFrame(drawFrame); }
    function drawFrame(now) { frameId = null; if (graphicsFailed || destroyed || viewMode === '2d') return; updateAnimations(now); updateEffects(now); updateThreatGlows(now); try { renderer.render(scene, camera); } catch (error) { showGraphicsError(`3D 渲染失败：${error.message}`); return; } if (animations.length || effects.length || now < renderUntil) frameId = requestAnimationFrame(drawFrame); }
    function showGraphicsError(message) { if (graphicsFailed) return; graphicsFailed = true; if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; viewport.innerHTML = `<div class="chess3d-render-error"><strong>3D 棋盘已停止</strong><span>${escapeHtml(message)}</span><small>可以先返回大厅，或尝试降低浏览器缩放和关闭其他占用显卡的页面。</small></div>`; addLog?.(message, 'error'); }

    return {
        gameType: 'chess',
        handleMessage,
        getActionBindings,
        renderState,
        renderTiles,
        renderBoard2d,
        setStudyPlacement(mode) {
            studyPlacement = mode && (mode.remove || mode.type) ? { ...mode } : null;
            if (model) model.studyPlacement = studyPlacement;
            if (mode && state?.studyMode && state.studyPhase === 'setup' && viewMode !== '2d') setViewMode('2d', false);
        },
        destroy() {
            destroyed = true;
            if (model) model.destroyed = true;
            studyPlacement = null;
            if (model) model.studyPlacement = null;
            if (frameId !== null) cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
            resizeObserver?.disconnect();
            effects.forEach(effect => effect.material.dispose());
            effects.length = 0;
            activeThreatGlows.length = 0;
            landingEffectGeometry.dispose();
            threatGlowGeometry.dispose();
            threatGlowTexture.dispose();
            Object.values(threatGlowMaterials).forEach(material => material.dispose());
            pieceGeometries.forEach(geometry => geometry.dispose());
            tileMeshes.forEach(tile => tile.material.dispose());
            Object.values(materials).forEach(material => material.dispose());
            renderer.forceContextLoss?.();
            renderer.dispose();
        },
    };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
