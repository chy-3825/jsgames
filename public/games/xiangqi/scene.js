import * as THREE from '/vendor/three/build/three.module.js';

import { HEIGHT, LABELS, PIECE_FONT, RED_LABELS, RIVER_FONT, RIVER_INSCRIPTIONS, WIDTH, WOOD_TONES } from './constants.js';

export function createXiangqiScene({ mount, model, send, addLog }) {
    const $ = role => mount.querySelector(`[data-role="${role}"]`);
    const viewport = $('viewport'); const canvas = $('canvas'); const board2d = $('board2d'); const viewModeButton = $('viewModeButton'); const resetButton = $('resetButton'); const roomEl = $('room'); const turnEl = $('turn'); const lastEl = $('last'); const statusEl = $('status'); const hintEl = $('hint'); const logEl = $('log'); const blackEl = $('black'); const redEl = $('red'); const overlay = $('rulesOverlay');
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#211a16'); scene.fog = new THREE.Fog('#211a16', 25, 46);
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 75); let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (error) { viewport.innerHTML = '<div class="xiangqi3d-render-error"><strong>3D 棋盘无法启动</strong><span>当前浏览器没有可用的 WebGL 图形加速。</span></div>'; addLog?.(`中国象棋 3D 初始化失败：${error.message}`, 'error'); return { gameType: 'xiangqi', handleMessage() {}, getActionBindings() { return null; }, destroy() {} }; }
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .96; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.1 : 1.25));
    const board = new THREE.Group(); scene.add(board); const markers = new THREE.Group(); board.add(markers); const hits = []; const roots = new Map(); const shadows = new Map(); const textures = new Map(); const faceMaterials = new Map(); const riverSvgImages = new Map(); const riverTextMeshes = []; const animations = []; const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const lookAt = new THREE.Vector3(0, .04, 0);
    function makeBoardTexture() { const image = document.createElement('canvas'); image.width = 512; image.height = 512; const ctx = image.getContext('2d'); const base = ctx.createLinearGradient(0, 0, 512, 512); base.addColorStop(0, '#d2a873'); base.addColorStop(.5, '#d0a570'); base.addColorStop(1, '#cea16b'); ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512); for (let index = 0; index < 42; index += 1) { const y = 8 + index * 13; ctx.beginPath(); ctx.moveTo(-20, y); ctx.bezierCurveTo(120, y - 7, 280, y + 8, 532, y - 3); ctx.strokeStyle = 'rgba(86, 48, 24, ' + (.014 + (index % 4) * .006) + ')'; ctx.lineWidth = 1 + (index % 3) * .3; ctx.stroke(); } const map = new THREE.CanvasTexture(image); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.RepeatWrapping; map.repeat.set(1.05, 1.3); map.anisotropy = renderer.capabilities.getMaxAnisotropy(); return map; }
    const surfaceTexture = makeBoardTexture();
    const material = { top: new THREE.MeshStandardMaterial({ color: '#fff0d0', map: surfaceTexture, roughness: .82 }), line: new THREE.MeshStandardMaterial({ color: '#4c2b1a', roughness: .62 }), groove: new THREE.MeshStandardMaterial({ color: '#5f3b20', roughness: .86, metalness: 0 }), shadow: new THREE.MeshBasicMaterial({ color: '#21130b', alphaMap: contactShadowTexture(), transparent: true, opacity: .34, depthWrite: false, toneMapped: false }) };
    const pieceBodyMaterials = WOOD_TONES.map((tone, variant) => new THREE.MeshPhysicalMaterial({ color: tone, map: woodSideTexture(variant, false), bumpMap: woodSideTexture(variant, true), bumpScale: .011, roughness: .68, metalness: 0, clearcoat: .045, clearcoatRoughness: .82 }));
    // 黄杨木棋子采用轻微鼓边、双倒角和内收顶面。轮廓不能像直筒塑料按钮，
    // 也不能过厚成为饼干；顶部刻槽与棋面分离，光线才会留下真实的凹痕。
    const pieceProfile = [[0, -.108], [.255, -.108], [.286, -.103], [.315, -.088], [.337, -.056], [.344, -.012], [.342, .048], [.331, .092], [.313, .122], [.292, .143], [.274, .151], [0, .151]].map(([radius, height]) => new THREE.Vector2(radius, height));
    const pieceBodyGeometry = new THREE.LatheGeometry(pieceProfile, 64); pieceBodyGeometry.computeVertexNormals();
    const pieceRingGeometry = new THREE.RingGeometry(.279, .295, 64);
    const pieceInnerRingGeometry = new THREE.RingGeometry(.251, .258, 64);
    const pieceFaceGeometry = new THREE.CircleGeometry(.273, 64);
    const pieceShadowGeometry = new THREE.PlaneGeometry(.76, .57);
    const markerGeometry = { selected: new THREE.RingGeometry(.35, .382, 48), move: new THREE.CylinderGeometry(.068, .082, .022, 24), capture: new THREE.RingGeometry(.347, .385, 48) };
    const markerMaterial = { selected: new THREE.MeshBasicMaterial({ color: '#c39a4a', transparent: true, opacity: .9, depthWrite: false, toneMapped: false }), move: new THREE.MeshStandardMaterial({ color: '#b88a3f', roughness: .38, metalness: .28 }), capture: new THREE.MeshBasicMaterial({ color: '#8f352d', transparent: true, opacity: .92, depthWrite: false, toneMapped: false }) };
    const checkGlowGeometry = new THREE.PlaneGeometry(1.25, 1.25);
    const checkGlowMaterial = new THREE.MeshBasicMaterial({ map: checkGlowTexture(), color: '#ff392f', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    const activeCheckGlows = [];
    const viewModeStorageKey = 'jsgames.xiangqi.viewMode';
    const explicitViewModeStorageKey = `${viewModeStorageKey}.explicit`;
    const savedViewMode = localStorage.getItem(viewModeStorageKey);
    const isCompactPointer = window.matchMedia?.('(max-width: 760px), (pointer: coarse), (max-width: 900px) and (max-height: 500px)').matches;
    let state = model?.state || null; let previous = new Map(); let selected = null; let perspectiveColor = null; let viewMode = isCompactPointer && localStorage.getItem(explicitViewModeStorageKey) !== '1' ? '2d' : savedViewMode === '2d' ? '2d' : '3d'; let yaw = 0; let pitch = .75; let distance = 17; let dragging = false; let dragId = null; let lastPointer = { x: 0, y: 0 }; let frame = null; let renderUntil = 0; let destroyed = false; let graphicsFailed = false; const resizeTimers = [];
    // 棋盘所有可点击点、棋子和标记共用同一套格点转换，避免视觉网格与命中区域漂移。
    const GRID_X = .88; const GRID_Z = .88;
    const pos = (x, y, height = 0) => new THREE.Vector3((x - 4) * GRID_X, height, (y - 4.5) * GRID_Z);
    const SURFACE_TOP = -.11; const GRID_Y = SURFACE_TOP + .009; const DECAL_Y = SURFACE_TOP + .022; const SHADOW_Y = SURFACE_TOP + .003;
    function seedFrom(value) { let seed = 2166136261; for (const character of String(value)) { seed ^= character.codePointAt(0); seed = Math.imul(seed, 16777619); } return seed >>> 0; }
    function seededRandom(value) { let seed = seedFrom(value) || 1; return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; }; }
    function canvasTexture(key, size, draw, useColorSpace = false) { if (textures.has(key)) return textures.get(key); const image = document.createElement('canvas'); image.width = size; image.height = size; draw(image.getContext('2d'), image); const map = new THREE.CanvasTexture(image); if (useColorSpace) map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = renderer.capabilities.getMaxAnisotropy(); map.generateMipmaps = true; textures.set(key, map); return map; }
    function contactShadowTexture() { return canvasTexture('piece-contact-shadow', 256, (ctx, image) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, image.width, image.height); const glow = ctx.createRadialGradient(128, 128, 12, 128, 128, 122); glow.addColorStop(0, '#fff'); glow.addColorStop(.46, '#d5d5d5'); glow.addColorStop(.78, '#555'); glow.addColorStop(1, '#000'); ctx.fillStyle = glow; ctx.fillRect(0, 0, image.width, image.height); }); }
    function checkGlowTexture() { return canvasTexture('checking-piece-glow', 256, (ctx, image) => { const glow = ctx.createRadialGradient(128, 128, 4, 128, 128, 125); glow.addColorStop(0, 'rgba(255,78,55,.98)'); glow.addColorStop(.25, 'rgba(255,42,32,.7)'); glow.addColorStop(.58, 'rgba(219,15,12,.3)'); glow.addColorStop(1, 'rgba(120,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, image.width, image.height); }, true); }
    function woodSideTexture(variant, bump) {
        const key = `piece-side-${bump ? 'bump' : 'color'}-${variant}`;
        const map = canvasTexture(key, 512, (ctx, image) => {
            const random = seededRandom(`side-${variant}-${bump}`);
            ctx.fillStyle = bump ? '#858585' : '#f0dfbc'; ctx.fillRect(0, 0, image.width, image.height);
            for (let index = 0; index < 82; index += 1) {
                const x = random() * image.width; const sway = 4 + random() * 17; const phase = random() * Math.PI * 2;
                ctx.beginPath();
                for (let y = -16; y <= image.height + 16; y += 12) { const pointX = x + Math.sin(y * (.016 + random() * .004) + phase) * sway + Math.sin(y * .047 + phase) * 2.4; if (y === -16) ctx.moveTo(pointX, y); else ctx.lineTo(pointX, y); }
                const alpha = .018 + random() * .06; ctx.strokeStyle = bump ? `rgba(35,35,35,${alpha * 1.6})` : `rgba(91,55,25,${alpha})`; ctx.lineWidth = .6 + random() * 2.2; ctx.stroke();
            }
            for (let y = 7; y < image.height; y += 17 + Math.floor(random() * 8)) { ctx.strokeStyle = bump ? 'rgba(235,235,235,.035)' : 'rgba(255,248,220,.055)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(140, y + 3, 360, y - 4, 512, y + 1); ctx.stroke(); }
        }, !bump);
        map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.RepeatWrapping; map.repeat.set(1.35, 1.1); return map;
    }
    function pieceTextSize(ctx, text, size, fontFamily) { ctx.font = `${size}px ${fontFamily}`; const measured = ctx.measureText(text).width; return measured > 900 ? Math.max(72, Math.floor(size * 900 / measured)) : size; }
    function drawFaceWood(ctx, variant, bump) {
        const random = seededRandom(`face-${variant}-${bump}`); const centerX = 470 + (random() - .5) * 90; const centerY = 500 + (random() - .5) * 70; const rotation = (random() - .5) * .34;
        const base = bump ? '#8b8b8b' : WOOD_TONES[variant % WOOD_TONES.length]; ctx.fillStyle = base; ctx.fillRect(0, 0, 1024, 1024);
        if (!bump) { const light = ctx.createRadialGradient(420, 360, 40, 512, 512, 720); light.addColorStop(0, 'rgba(255,244,203,.2)'); light.addColorStop(.58, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(85,45,18,.11)'); ctx.fillStyle = light; ctx.fillRect(0, 0, 1024, 1024); }
        for (let index = 0; index < 18; index += 1) {
            const radius = 65 + index * 45 + (random() - .5) * 16;
            ctx.beginPath(); ctx.ellipse(centerX, centerY, radius * 1.14, radius * .75, rotation + Math.sin(index * .71) * .035, 0, Math.PI * 2);
            ctx.strokeStyle = bump ? `rgba(${index % 2 ? 58 : 210},${index % 2 ? 58 : 210},${index % 2 ? 58 : 210},.045)` : 'rgba(93,54,24,.045)'; ctx.lineWidth = 5 + random() * 7; ctx.stroke();
        }
        for (let index = 0; index < 64; index += 1) {
            const radius = 42 + index * 14.5 + (random() - .5) * 8;
            ctx.beginPath(); ctx.ellipse(centerX, centerY, radius * (1.05 + random() * .14), radius * (.7 + random() * .08), rotation + Math.sin(index * .43) * .025, 0, Math.PI * 2);
            const alpha = .018 + random() * .035; ctx.strokeStyle = bump ? `rgba(${index % 2 ? 45 : 225},${index % 2 ? 45 : 225},${index % 2 ? 45 : 225},${alpha})` : `rgba(91,52,22,${alpha})`; ctx.lineWidth = .8 + random() * 2.4; ctx.stroke();
        }
        for (let index = 0; index < 145; index += 1) { const x = random() * 1024; const y = random() * 1024; const length = 2 + random() * 8; ctx.strokeStyle = bump ? 'rgba(38,38,38,.05)' : 'rgba(77,43,19,.075)'; ctx.lineWidth = .5 + random(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + (random() - .5) * 2); ctx.stroke(); }
    }
    function faceTexture(text, ink, variant, bump = false, size = 540) {
        return canvasTexture(`piece-face-${bump ? 'bump' : 'color'}-${text}-${ink}-${variant}`, 1024, (ctx) => {
            drawFaceWood(ctx, variant, bump); const fittedSize = pieceTextSize(ctx, text, size, PIECE_FONT); ctx.font = `${fittedSize}px ${PIECE_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
            if (bump) { ctx.strokeStyle = '#242424'; ctx.lineWidth = 20; ctx.strokeText(text, 512, 518); ctx.fillStyle = '#101010'; ctx.fillText(text, 512, 518); }
            else { ctx.strokeStyle = ink === '#9d211b' ? 'rgba(92,19,15,.58)' : 'rgba(15,12,10,.62)'; ctx.lineWidth = 17; ctx.strokeText(text, 512, 519); ctx.strokeStyle = 'rgba(255,222,163,.22)'; ctx.lineWidth = 4; ctx.strokeText(text, 510, 515); ctx.fillStyle = ink; ctx.fillText(text, 512, 518); }
        }, !bump);
    }
    function faceMaterial(label, ink, variant) { const key = `${label}|${ink}|${variant}`; if (!faceMaterials.has(key)) faceMaterials.set(key, new THREE.MeshPhysicalMaterial({ color: '#fffaf0', map: faceTexture(label, ink, variant), bumpMap: faceTexture(label, ink, variant, true), bumpScale: .029, roughness: .64, metalness: 0, clearcoat: .035, clearcoatRoughness: .86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); return faceMaterials.get(key); }
    // The reference SVG stacks each phrase vertically and rotates the left
    // and right groups in opposite directions. This makes the finished text
    // run across the river while the two inscriptions face each other.
    function verticalRiverTexture(text) { const key = `river-ink|${text}`; if (textures.has(key)) return textures.get(key); const image = document.createElement('canvas'); image.width = 768; image.height = 1536; const ctx = image.getContext('2d'); ctx.clearRect(0, 0, image.width, image.height); ctx.fillStyle = '#2a170f'; ctx.font = `340px ${RIVER_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const characters = [...text]; const lineHeight = 372; const startY = image.height / 2 - (characters.length - 1) * lineHeight / 2; characters.forEach((character, index) => { ctx.save(); ctx.translate(image.width / 2 + (index ? -5 : 4), startY + index * lineHeight); ctx.rotate((index ? -1 : 1) * .012); ctx.globalAlpha = .9; ctx.fillText(character, 0, 0); ctx.restore(); }); const map = new THREE.CanvasTexture(image); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = renderer.capabilities.getMaxAnisotropy(); map.generateMipmaps = true; textures.set(key, map); return map; }
    function riverSvgImage(text) { if (!riverSvgImages.has(text)) riverSvgImages.set(text, verticalRiverTexture(text).image.toDataURL('image/png')); return riverSvgImages.get(text); }
    function riverSvgMarkup() {
        const fromBlackSide = state?.myColor === 'black';
        return RIVER_INSCRIPTIONS.map(({ text, svgX, svgY, svgRotation }) => {
            const x = fromBlackSide ? 900 - svgX : svgX;
            const y = fromBlackSide ? 1000 - svgY : svgY;
            const rotation = fromBlackSide ? svgRotation + 180 : svgRotation;
            return `<image class="river river-image" href="${riverSvgImage(text)}" x="${x - 41}" y="${y - 82}" width="82" height="164" preserveAspectRatio="none" transform="rotate(${rotation} ${x} ${y})" aria-label="${text}"/>`;
        }).join('');
    }
    function addRiverText(text, worldX, rotationY) { const map = verticalRiverTexture(text); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.72, 1.44), new THREE.MeshStandardMaterial({ map, color: '#fff1d6', transparent: true, alphaTest: .025, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, roughness: .95, metalness: 0 })); mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); mesh.rotateZ(rotationY); mesh.position.set(worldX, DECAL_Y + .006, 0); mesh.renderOrder = 8; mesh.userData.riverText = text; mesh.userData.riverRotation = rotationY; riverTextMeshes.push(mesh); board.add(mesh); }
    function environment() { const addBar = (start, end, width = .026, height = .018, mat = material.line) => { const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz) || .001; const bar = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), mat); bar.position.set((start.x + end.x) / 2, start.y, (start.z + end.z) / 2); bar.rotation.y = Math.atan2(-dz, dx); bar.receiveShadow = true; board.add(bar); }; scene.add(new THREE.HemisphereLight('#ffe8c2', '#2a1c15', 1.12)); const light = new THREE.DirectionalLight('#ffe2b6', 1.68); light.position.set(-6, 14, 8); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.radius = 4; light.shadow.bias = -.00025; light.shadow.camera.left = -6; light.shadow.camera.right = 6; light.shadow.camera.top = 7; light.shadow.camera.bottom = -7; scene.add(light); const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#1b1410', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.34; floor.receiveShadow = true; scene.add(floor); const surface = new THREE.Mesh(new THREE.BoxGeometry(8.35, .18, 9.85), material.top); surface.position.y = -.2; surface.receiveShadow = false; scene.add(surface); for (let y = 0; y < HEIGHT; y += 1) addBar(pos(0, y, GRID_Y), pos(8, y, GRID_Y), .026, .018); for (let x = 0; x < WIDTH; x += 1) { addBar(pos(x, 0, GRID_Y), pos(x, 4, GRID_Y), .026, .018); addBar(pos(x, 5, GRID_Y), pos(x, 9, GRID_Y), .026, .018); } addBar(pos(0, 4, GRID_Y), pos(0, 5, GRID_Y), .026, .018); addBar(pos(8, 4, GRID_Y), pos(8, 5, GRID_Y), .026, .018); RIVER_INSCRIPTIONS.forEach(({ text, worldX, rotationY }) => addRiverText(text, worldX, rotationY)); [[3, 0, 5, 2], [5, 0, 3, 2], [3, 9, 5, 7], [5, 9, 3, 7]].forEach(([x1, y1, x2, y2]) => addBar(pos(x1, y1, GRID_Y), pos(x2, y2, GRID_Y), .024, .016)); const starPoints = [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]; starPoints.forEach(([x, y]) => { const marker = new THREE.Mesh(new THREE.CircleGeometry(.05, 12), new THREE.MeshBasicMaterial({ color: '#563822' })); marker.rotation.x = -Math.PI / 2; marker.position.copy(pos(x, y, DECAL_Y)); board.add(marker); }); for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) { const hit = new THREE.Mesh(new THREE.PlaneGeometry(.82, .82), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.rotation.x = -Math.PI / 2; hit.position.copy(pos(x, y, .035)); hit.userData.square = { x, y }; board.add(hit); hits.push(hit); } }
    function shadowPosition(x, y) { const point = pos(x, y, SHADOW_Y); point.x += .012; point.z -= .018; return point; }
    function setShadowScale(shadow, amount = 1) { if (shadow) shadow.scale.set(amount, amount * .88, 1); }
    function ensureShadow(piece) { let shadow = shadows.get(piece.id); if (!shadow) { shadow = new THREE.Mesh(pieceShadowGeometry, material.shadow); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 4; board.add(shadow); shadows.set(piece.id, shadow); } shadow.position.copy(shadowPosition(piece.x, piece.y)); setShadowScale(shadow); return shadow; }
    function removeShadow(id) { const shadow = shadows.get(id); if (!shadow) return; board.remove(shadow); shadows.delete(id); }
    function createPiece(piece) {
        const root = new THREE.Group();
        root.userData.pieceId = piece.id;
        root.userData.square = { x: piece.x, y: piece.y };
        root.userData.type = piece.type;
        root.userData.color = piece.color;
        const variant = seedFrom(piece.id) % pieceBodyMaterials.length;
        const base = new THREE.Mesh(pieceBodyGeometry, pieceBodyMaterials[variant]);
        base.castShadow = true;
        base.receiveShadow = true;
        root.add(base);
        const topRing = new THREE.Mesh(pieceRingGeometry, material.groove);
        topRing.rotation.x = -Math.PI / 2;
        topRing.position.y = .154;
        root.add(topRing);
        const innerRing = new THREE.Mesh(pieceInnerRingGeometry, material.groove);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = .155;
        root.add(innerRing);
        const label = piece.color === 'red' ? RED_LABELS[piece.type] : LABELS[piece.type];
        const ink = piece.color === 'red' ? '#9d211b' : '#1f1914';
        const face = new THREE.Mesh(pieceFaceGeometry, faceMaterial(label, ink, variant));
        face.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        // CanvasTexture 的默认 Y 轴处理已经对齐棋面纹理；黑方棋子
        // 需要额外旋转 180°，使两方字面都朝向自己的执棋侧。
        if (piece.color === 'black') face.rotateZ(Math.PI);
        face.position.y = .1535;
        root.add(face);
        root.position.copy(pos(piece.x, piece.y));
        ensureShadow(piece);
        board.add(root);
        return root;
    }
    function setPosition(root, x, y) { root.position.copy(pos(x, y)); root.userData.square = { x, y }; const shadow = shadows.get(root.userData.pieceId); if (shadow) { shadow.position.copy(shadowPosition(x, y)); setShadowScale(shadow); } }
    function syncPieces(next) {
        const map = new Map(next.map(piece => [piece.id, piece]));
        if (viewMode === '2d') {
            settleAnimations();
            for (const [id, root] of roots) if (!map.has(id)) { board.remove(root); roots.delete(id); removeShadow(id); }
            for (const piece of next) {
                let root = roots.get(piece.id);
                if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) { if (root) board.remove(root); root = createPiece(piece); roots.set(piece.id, root); }
                setPosition(root, piece.x, piece.y);
            }
            previous = new Map(next.map(piece => [piece.id, piece]));
            return;
        }
        for (const [id, root] of roots) if (!map.has(id) && !animations.some(animation => animation.kind === 'capture' && animation.root === root)) animations.push({ kind: 'capture', root, shadow: shadows.get(id), start: performance.now(), duration: 240 });
        for (const piece of next) {
            const old = previous.get(piece.id);
            let root = roots.get(piece.id);
            if (!root || root.userData.type !== piece.type || root.userData.color !== piece.color) { if (root) board.remove(root); root = createPiece(piece); roots.set(piece.id, root); }
            else if (old && (old.x !== piece.x || old.y !== piece.y)) { animations.push({ kind: 'move', root, shadow: shadows.get(piece.id), from: pos(old.x, old.y), to: pos(piece.x, piece.y), shadowFrom: shadowPosition(old.x, old.y), shadowTo: shadowPosition(piece.x, piece.y), toX: piece.x, toY: piece.y, start: performance.now(), duration: 340 }); root.userData.square = { x: piece.x, y: piece.y }; }
            else setPosition(root, piece.x, piece.y);
        }
        previous = new Map(next.map(piece => [piece.id, piece]));
    }
    function pieceAt(x, y) { return state?.pieces?.find(piece => piece.x === x && piece.y === y) || null; }
    function clearMarkers() { while (markers.children.length) markers.remove(markers.children[0]); }
    function renderMarkers() {
        clearMarkers();
        activeCheckGlows.length = 0;
        const checkingIds = new Set(state?.lastMove?.gaveCheck ? (state.lastMove.checkingPieceIds?.length ? state.lastMove.checkingPieceIds : [state.lastMove.piece?.id]) : []);
        for (const checkingPiece of state?.pieces?.filter(piece => checkingIds.has(piece.id)) || []) {
            const glow = new THREE.Mesh(checkGlowGeometry, checkGlowMaterial); glow.rotation.x = -Math.PI / 2; glow.renderOrder = 7; glow.position.copy(pos(checkingPiece.x, checkingPiece.y, DECAL_Y + .004));
            const light = new THREE.PointLight('#ff2b24', 2.1, 2.15, 2); light.position.copy(pos(checkingPiece.x, checkingPiece.y, .18));
            markers.add(glow, light); activeCheckGlows.push({ glow, light });
        }
        if (!selected) return;
        const selectedMarker = new THREE.Mesh(markerGeometry.selected, markerMaterial.selected);
        selectedMarker.rotation.x = -Math.PI / 2;
        selectedMarker.position.copy(pos(selected.x, selected.y, DECAL_Y + .009));
        selectedMarker.renderOrder = 9;
        markers.add(selectedMarker);
        const piece = pieceAt(selected.x, selected.y);
        (state?.legalMoves?.[piece?.id] || []).forEach(square => {
            const targetPiece = pieceAt(square.x, square.y);
            const marker = targetPiece ? new THREE.Mesh(markerGeometry.capture, markerMaterial.capture) : new THREE.Mesh(markerGeometry.move, markerMaterial.move);
            if (targetPiece) marker.rotation.x = -Math.PI / 2;
            marker.position.copy(pos(square.x, square.y, targetPiece ? DECAL_Y + .009 : SURFACE_TOP + .017));
            marker.renderOrder = 9;
            markers.add(marker);
        });
    }
    function playerCard(el, player) { if (!player) { el.innerHTML = ''; return; } const color = player.color; el.className = `xiangqi3d-player ${color} ${player.isCurrentTurn ? 'is-current' : ''}`; el.innerHTML = `<small>${color === 'red' ? 'RED · 帥' : 'BLACK · 將'}</small><strong>${escapeHtml(player.name)}${player.id === state.myId ? ' · 我' : ''}</strong><span>${player.isCurrentTurn ? '正在行动' : player.isOnline === false ? '已离线' : color === state.myColor ? '你的棋子' : '等待中'}</span>`; }
    function renderState() { if (!state) return; roomEl.textContent = state.roomId ? `ROOM ${state.roomId}` : 'XIANGQI TABLE'; if (state.myColor && state.myColor !== perspectiveColor) { perspectiveColor = state.myColor; yaw = 0; updateCamera(); } const current = state.players?.find(player => player.id === state.currentTurn); const ended = state.status === 'ended'; const warning = !ended ? state.longCheckWarning : null; turnEl.innerHTML = ended ? `<i class="xq-dot ended"></i>${escapeHtml(state.winner?.name || state.drawReason || '和棋')}` : `<i class="xq-dot"></i>${state.myIsCurrentTurn ? '你的回合' : `${escapeHtml(current?.name || '对手')}的回合`}`; statusEl.textContent = ended ? (state.winner ? `${state.winner.name} 获胜` : state.drawReason || '和棋') : warning ? `长将警告 · 连续将军 ${warning.count} 次` : state.check ? '将军' : ''; statusEl.classList.toggle('is-warning', Boolean(warning)); hintEl.textContent = ended ? '本局已结束' : warning ? warning.message : state.myIsCurrentTurn ? selected ? '点击金色标记完成走棋' : '选择你的棋子' : `等待 ${current?.name || '对手'} 走棋`; lastEl.innerHTML = state.lastMove ? `<small>最后一步</small><strong>${state.lastMove.gaveCheck ? '将军' : state.lastMove.capture ? '吃子' : '移动'}</strong>` : '<small>棋局开始</small>'; logEl.innerHTML = (state.actionLog || []).slice(-4).reverse().map((entry, i) => `<span class="${i === 0 ? 'is-latest' : ''}">${escapeHtml(entry)}</span>`).join(''); playerCard(redEl, state.players?.find(player => player.color === 'red')); playerCard(blackEl, state.players?.find(player => player.color === 'black')); syncPieces(state.pieces || []); renderMarkers(); renderBoard2d(); requestRender(720); }
    function displayPoint(x, y) { return state?.myColor === 'black' ? { x: WIDTH - 1 - x, y: HEIGHT - 1 - y } : { x, y }; }
    function svgPoint(x, y) { const point = displayPoint(x, y); return { x: 50 + point.x * 100, y: 50 + point.y * 100 }; }
    function renderBoard2d() {
        if (!state || viewMode !== '2d') return;
        const lines = [];
        const addLine2d = (x1, y1, x2, y2, className = '') => { const a = svgPoint(x1, y1); const b = svgPoint(x2, y2); lines.push(`<line class="${className}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`); };
        for (let y = 0; y < HEIGHT; y += 1) addLine2d(0, y, 8, y);
        for (let x = 0; x < WIDTH; x += 1) { addLine2d(x, 0, x, 4); addLine2d(x, 5, x, 9); }
        addLine2d(0, 4, 0, 5, 'river-edge'); addLine2d(8, 4, 8, 5, 'river-edge');
        [[3, 0, 5, 2], [5, 0, 3, 2], [3, 9, 5, 7], [5, 9, 3, 7]].forEach(points => addLine2d(...points, 'palace'));
        const selectedPiece = selected && pieceAt(selected.x, selected.y);
        const legal = new Set((state.legalMoves?.[selectedPiece?.id] || []).map(move => `${move.x},${move.y}`));
        const pieces = [];
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
            const point = displayPoint(x, y); const piece = pieceAt(x, y); const target = legal.has(`${x},${y}`);
            const checkingIds = state.lastMove?.checkingPieceIds?.length ? state.lastMove.checkingPieceIds : [state.lastMove?.piece?.id];
            const isCheckingPiece = Boolean(piece && state.lastMove?.gaveCheck && checkingIds.includes(piece.id));
            const classes = ['xiangqi2d-node', piece ? `has-piece ${piece.color}` : '', selected?.x === x && selected?.y === y ? 'is-selected' : '', target ? (piece ? 'can-capture' : 'can-move') : '', isCheckingPiece ? 'is-checker' : ''].filter(Boolean).join(' ');
            const label = piece ? (piece.color === 'red' ? RED_LABELS[piece.type] : LABELS[piece.type]) : '';
            pieces.push(`<button type="button" class="${classes}" data-board-square data-x="${x}" data-y="${y}" style="--x:${point.x};--y:${point.y}" aria-label="${label || `位置 ${x + 1},${y + 1}`}">${escapeHtml(label)}</button>`);
        }
        board2d.innerHTML = `<svg viewBox="0 0 900 1000" aria-hidden="true"><rect x="10" y="10" width="880" height="980" rx="5" class="board-paper"/>${lines.join('')}${riverSvgMarkup()}</svg>${pieces.join('')}`;
    }
    function onWheel(event) { if (viewMode === '2d') return; event.preventDefault(); distance = THREE.MathUtils.clamp(distance + event.deltaY * .008, 14, 22); updateCamera(); }
    function onPointerDown(event) { if (viewMode === '2d') return; if (event.button === 2 || event.shiftKey) { dragging = true; dragId = event.pointerId; lastPointer = { x: event.clientX, y: event.clientY }; viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging'); return; } if (event.button === 0) selectFromPointer(event); }
    function onPointerMove(event) { if (!dragging || event.pointerId !== dragId) return; yaw -= (event.clientX - lastPointer.x) * .006; pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastPointer.y) * .004, .52, .9); lastPointer = { x: event.clientX, y: event.clientY }; updateCamera(); }
    function onPointerUp(event) { if (event.pointerId !== dragId) return; dragging = false; dragId = null; viewport.releasePointerCapture?.(event.pointerId); viewport.classList.remove('is-dragging'); }
    function activateSquare(square) { if (!state || state.status === 'ended' || animations.length) return; const targets = state.legalMoves?.[pieceAt(selected?.x, selected?.y)?.id] || []; if (selected && targets.some(target => target.x === square.x && target.y === square.y)) { send({ type: 'gameAction', action: { kind: 'move', from: selected, to: square } }); selected = null; renderMarkers(); renderBoard2d(); return; } const piece = pieceAt(square.x, square.y); selected = piece && piece.color === state.myColor && state.myIsCurrentTurn && (state.legalMoves?.[piece.id] || []).length ? { x: square.x, y: square.y } : null; renderMarkers(); renderBoard2d(); requestRender(280); }
    function selectFromPointer(event) { if (!state || state.status === 'ended' || animations.length) return; const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); let square = null; for (const hit of raycaster.intersectObjects(hits.concat([...roots.values()]), true)) { let object = hit.object; while (object) { if (object.userData.square) square = object.userData.square; object = object.parent; } if (square) break; } if (square) activateSquare(square); }
    function updateCamera() { const horizontal = Math.sin(pitch) * distance; const viewYaw = yaw + (perspectiveColor === 'black' ? Math.PI : 0); camera.position.set(Math.sin(viewYaw) * horizontal, Math.cos(pitch) * distance, Math.cos(viewYaw) * horizontal); camera.lookAt(lookAt); requestRender(240); }
    function setViewMode(mode, persist = true) { viewMode = mode === '2d' ? '2d' : '3d'; if (viewMode === '2d') settleAnimations(); if (persist) { localStorage.setItem(viewModeStorageKey, viewMode); localStorage.setItem(explicitViewModeStorageKey, '1'); } canvas.hidden = viewMode === '2d'; board2d.hidden = viewMode !== '2d'; viewport.classList.toggle('is-2d', viewMode === '2d'); viewModeButton.textContent = viewMode === '3d' ? '2D' : '3D'; viewModeButton.title = `切换到 ${viewModeButton.textContent} 棋盘`; resetButton.hidden = viewMode === '2d'; if (viewMode === '2d') renderBoard2d(); else { resize(); requestRender(360); } }
    function onUi(event) { const boardSquare = event.target.closest('[data-board-square]'); if (boardSquare) { activateSquare({ x: Number(boardSquare.dataset.x), y: Number(boardSquare.dataset.y) }); return; } const ui = event.target.closest('[data-ui]')?.dataset.ui; if (ui === 'viewMode') setViewMode(viewMode === '3d' ? '2d' : '3d'); if (ui === 'reset') { yaw = 0; pitch = .75; distance = 17; updateCamera(); } if (ui === 'rules') overlay.classList.remove('is-hidden'); if (ui === 'closeRules' || event.target === overlay) overlay.classList.add('is-hidden'); }
    function resize() { const rect = viewport.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return; renderer.setSize(Math.floor(rect.width), Math.floor(rect.height), false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); requestRender(); }
    function scheduleResize() { requestAnimationFrame(resize); [80, 260, 620].forEach(delay => resizeTimers.push(setTimeout(() => { if (!destroyed) resize(); }, delay))); }
    function requestRender(hold = 0) { if (graphicsFailed || destroyed || viewMode === '2d') return; renderUntil = Math.max(renderUntil, performance.now() + hold); if (frame === null) frame = requestAnimationFrame(draw); }
    function settleAnimations() {
        for (const animation of animations) {
            if (animation.kind === 'capture') {
                board.remove(animation.root);
                if (roots.get(animation.root.userData.pieceId) === animation.root) roots.delete(animation.root.userData.pieceId);
                removeShadow(animation.root.userData.pieceId);
            } else {
                animation.root.scale.setScalar(1);
                animation.root.rotation.z = 0;
                setPosition(animation.root, animation.toX, animation.toY);
            }
        }
        animations.length = 0;
    }
    function draw(now) {
        frame = null;
        if (graphicsFailed || destroyed || viewMode === '2d') return;
        for (const { glow, light } of activeCheckGlows) {
            const pulse = .94 + Math.sin(now * .009) * .08;
            glow.scale.setScalar(pulse);
            checkGlowMaterial.opacity = .78 + Math.sin(now * .009) * .12;
            light.intensity = 1.85 + Math.sin(now * .009) * .35;
        }
        for (let i = animations.length - 1; i >= 0; i -= 1) {
            const animation = animations[i];
            const progress = Math.min(1, (now - animation.start) / animation.duration);
            const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
            if (animation.kind === 'capture') {
                const remaining = Math.max(.05, 1 - eased);
                animation.root.scale.setScalar(remaining);
                setShadowScale(animation.shadow, remaining);
            } else {
                const lift = Math.sin(progress * Math.PI);
                animation.root.position.lerpVectors(animation.from, animation.to, eased);
                animation.root.position.y = lift * .058;
                animation.root.rotation.z = lift * .016;
                animation.shadow?.position.lerpVectors(animation.shadowFrom, animation.shadowTo, eased);
                setShadowScale(animation.shadow, 1 - lift * .22);
            }
            if (progress >= 1) {
                if (animation.kind === 'capture') {
                    board.remove(animation.root);
                    roots.delete(animation.root.userData.pieceId);
                    removeShadow(animation.root.userData.pieceId);
                } else {
                    animation.root.rotation.z = 0;
                    setPosition(animation.root, animation.toX, animation.toY);
                }
                animations.splice(i, 1);
            }
        }
        try { renderer.render(scene, camera); } catch (error) { graphicsFailed = true; viewport.innerHTML = `<div class="xiangqi3d-render-error"><strong>3D 棋盘已停止</strong><span>${escapeHtml(error.message)}</span></div>`; addLog?.(`中国象棋 3D 渲染失败：${error.message}`, 'error'); return; }
        if (animations.length || now < renderUntil) frame = requestAnimationFrame(draw);
    }
    environment(); updateCamera(); scheduleResize(); const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; observer?.observe(viewport); setViewMode(viewMode, false);
    Promise.all([document.fonts?.load?.('520px "HanWang LiSu"'), document.fonts?.load?.('340px "Xiangqi River"')]).then(() => { if (destroyed) return; faceMaterials.forEach(entry => entry.dispose()); faceMaterials.clear(); for (const [key, map] of textures) if (key.startsWith('piece-face-') || key.startsWith('river-ink|')) { map.dispose(); textures.delete(key); } riverSvgImages.clear(); riverTextMeshes.forEach(mesh => { mesh.material.map = verticalRiverTexture(mesh.userData.riverText); mesh.material.needsUpdate = true; }); roots.forEach(root => board.remove(root)); roots.clear(); previous.clear(); if (state) { syncPieces(state.pieces || []); renderMarkers(); renderBoard2d(); requestRender(200); } });

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
            onUi,
            onContextMenu(event) { event.preventDefault(); },
            onContextLost(event) { event.preventDefault(); addLog?.('中国象棋 WebGL 上下文已丢失', 'error'); },
        };
    }
    function handleMessage(message) {
        if (message.state) {
            state = message.state;
            if (model) model.state = state;
            if (state.studyMode && state.studyPhase === 'setup' && viewMode !== '2d') setViewMode('2d', false);
            if (selected && !pieceAt(selected.x, selected.y)) selected = null;
            renderState();
        }
        if (message.type === 'error') addLog(message.message || '操作失败', 'error');
        else if (message.action?.message) addLog(message.action.message, 'info');
    }

    return {
        gameType: 'xiangqi',
        handleMessage,
        getActionBindings,
        renderState,
        renderMarkers,
        renderBoard2d,
        destroy() {
            destroyed = true;
            if (model) model.destroyed = true;
            if (frame !== null) cancelAnimationFrame(frame);
            resizeTimers.splice(0).forEach(timer => clearTimeout(timer));
            observer?.disconnect();
            faceMaterials.forEach(entry => entry.dispose());
            textures.forEach(map => map.dispose());
            surfaceTexture.dispose();
            pieceBodyGeometry.dispose();
            pieceRingGeometry.dispose();
            pieceInnerRingGeometry.dispose();
            pieceFaceGeometry.dispose();
            pieceShadowGeometry.dispose();
            checkGlowGeometry.dispose();
            checkGlowMaterial.dispose();
            pieceBodyMaterials.forEach(entry => entry.dispose());
            Object.values(markerGeometry).forEach(entry => entry.dispose?.());
            Object.values(markerMaterial).forEach(entry => entry.dispose?.());
            Object.values(material).forEach(entry => entry.dispose?.());
            renderer.forceContextLoss?.();
            renderer.dispose();
        },
    };
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
