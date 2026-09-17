/**
 * CYBER-BREACH: DUAL-ENGINE SYSTEM (2D RETRO ARENA & 3D TRON INFINITE)
 * Powered by TypeSafe AI's Jev Model (System One Calibrated Inference)
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : 'http://localhost:8000';

class CyberGameEngine {
    constructor() {
        console.log("⚡ Booting CyberGame Dual-Engine (2D Retro / 3D Tron)...");
        this.container = document.getElementById('arena-container');
        this.canvas2d = document.getElementById('game-canvas-2d');
        this.canvas3d = document.getElementById('game-canvas-3d');
        this.ctx2d = this.canvas2d ? this.canvas2d.getContext('2d') : null;

        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
        this.cockpitOverlay = document.getElementById('cockpit-overlay');
        this.hudCanvas = document.getElementById('cockpit-hud-canvas');
        this.hudCtx = this.hudCanvas ? this.hudCanvas.getContext('2d') : null;

        // View Mode: '3d' or '2d'
        this.renderMode = '3d';

        // High score & progression
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_high_score') || '0', 10);
        this.wave = 1;
        this.enemiesDefeated = 0;
        this.isGameOver = false;
        this.autoPilot = false;

        // 3D Camera Controls
        this.cameraMode = 'chase'; // 'chase', 'tactical', 'cockpit'
        this.camPitch = 0.40;
        this.camZoom = 42;
        this.camSmoothing = 0.12;
        this.isLookingBack = false;
        this.rearThreatDetected = false;
        this.nearestPursuerDist = 9999;
        this.rearAlertSoundTimer = 0;

        // Screen Shake & Time
        this.screenShake = 0;
        this.lastTime = performance.now();

        // Game Director
        this.directorCooldown = 7.0;
        this.directorTimer = 0;
        this.activeHazards = [];

        // Unified Player State (Pos: X, Z on 3D ground plane / X, Y on 2D plane)
        this.player = {
            pos: new THREE.Vector3(0, 0, 0),
            vel: new THREE.Vector3(0, 0, 0),
            speed: 165,
            angle: 0,
            targetAngle: 0,
            bankAngle: 0,
            pitchAngle: 0,
            radius: 16, // for 2D collision & rendering
            hp: 100,
            maxHp: 100,
            shield: 100,
            maxShield: 100,
            shieldRechargeTimer: 0,
            shieldHitFlash: 0,
            dashCharges: 2,
            maxDashCharges: 2,
            dashRechargeTimer: 0,
            isDashing: false,
            dashTimer: 0,
            invulnerableTimer: 0,
            heat: 0,
            isOverheated: false,
            fireCooldown: 0,
            overdriveTimer: 0,
            speedBoostTimer: 0,
            lastDamageTime: 0,
            triPlasmaTimer: 0,
            blinkInvulnTimer: 0,
            isBlinking: false,
            wallHoppedThisBlink: false,
            trailPoints: [],
            maxTrailPoints: 80,
        };

        // Collections
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.pickups = [];
        this.particles2d = [];
        this.voxelParticles3d = [];
        this.floatingTexts = [];
        this.mines = [];
        this.mineCooldown = 0;
        this.maxMineCooldown = 3.5;
        this.shockwaves = [];
        this.arenaPylonPositions = [];

        // Identity Disc Arsenal
        this.discCooldown = 0;
        this.maxDiscCooldown = 2.8;
        this.identityDisc = {
            active: false,
            returning: false,
            x: 0,
            z: 0,
            vx: 0,
            vz: 0,
            speed: 185,
            returnSpeed: 235,
            bounces: 0,
            maxBounces: 4,
            lifespan: 3.2,
            maxLifespan: 3.2,
            radius: 5.5,
            spinAngle: 0,
            mesh: null
        };
        this.copilotGroup = null;
        this.copilotChevrons = [];
        this.copilotPulse = 0;
        this.lastWallHazardAlertTime = 0;
        this.exhaustPlumes = [];

        // Phase 4 Systems: Combos, Boss, Target Lock, Speed Warp, Time Dilation
        this.combo = 0;
        this.comboTimer = 0;
        this.maxComboTimer = 4.5;
        this.comboMultiplier = 1.0;
        this.comboRank = 'CYBER';
        this.timeDilation = 1.0;
        this.timeDilationTimer = 0.0;
        this.targetLockMesh = null;
        this.currentTargetEnemy = null;
        this.lastTargetLocked = false;
        this.speedWarpMesh = null;
        this.activeBoss = null;

        // Input Controls
        this.keys = {};
        this.mouseScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.isMouseDown = false;
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.aimPoint = new THREE.Vector3(0, 0, 0);

        // Jev Decision State
        this.enemyDecisionTimer = 0;
        this.botDecisionTimer = 0;
        this.botIntent = {
            nav: "circle_strafe_cw",
            targetPriority: "focus_nearest",
            fire: true,
            dash: false,
            urgency: 0.3
        };

        // Initialize Subsystems
        this.initThree();
        this.init2DCanvas();
        this.initEvents();
        this.checkBackendHealth();
        this.startWave(1);

        // Start Loop
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /* --------------------------------------------------------------------- */
    /* 3D THREE.JS ENGINE SETUP                                              */
    /* --------------------------------------------------------------------- */
    initThree() {
        const width = this.container.clientWidth || (window.innerWidth - 370);
        const height = this.container.clientHeight || (window.innerHeight - 52);

        // Scene & Fog (Luminous Tron Cyber Horizon)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x06142a);
        this.scene.fog = new THREE.FogExp2(0x06142a, 0.0009);

        // Perspective Camera
        this.camera = new THREE.PerspectiveCamera(62, width / height, 0.5, 3500);
        this.camera.rotation.order = 'YXZ';
        this.camera.position.set(0, 30, 45);
        this.camera.lookAt(0, 0, 0);

        this.hasWebGL = false;
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas3d,
                antialias: true,
                alpha: false,
                powerPreference: "high-performance"
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
            this.hasWebGL = true;

            // Phase 6: Precision Calibrated UnrealBloomPass Pipeline (High-contrast, zero wash-out)
            if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
                try {
                    const renderPass = new THREE.RenderPass(this.scene, this.camera);
                    const bloomRes = new THREE.Vector2(width, height);
                    // Calibrated Bloom: threshold 0.78 (only hot lasers & thrusters bloom), strength 0.45, radius 0.22
                    this.bloomPass = new THREE.UnrealBloomPass(bloomRes, 0.45, 0.22, 0.78);
                    this.composer = new THREE.EffectComposer(this.renderer);
                    this.composer.addPass(renderPass);
                    this.composer.addPass(this.bloomPass);
                    this.hasBloom = true;
                    console.log("✨ Phase 6: Precision UnrealBloomPass pipeline active (threshold: 0.78, strength: 0.45).");
                } catch (postErr) {
                    console.warn("⚠️ Post-processing bloom failed to initialize:", postErr);
                    this.composer = null;
                    this.hasBloom = false;
                }
            }
        } catch (err) {
            console.warn("⚠️ WebGL context creation failed. Defaulting to 2D Classic Mode:", err);
            this.hasWebGL = false;
            this.renderMode = '2d';
        }

        // Atmospheric Tron Fog (Deep dark cyber void)
        this.scene.fog = new THREE.FogExp2(0x020816, 0.0014);
        if (this.renderer) this.renderer.setClearColor(0x020816, 1.0);

        // Precision Tron Lighting Rig (Deep Void Contrast, No Specular Blowouts)
        // 1. Sky/Ground Hemisphere Light (Subtle Ambient Cyber Fill)
        this.hemiLight = new THREE.HemisphereLight(0x1e3a5f, 0x080b18, 0.55);
        this.scene.add(this.hemiLight);

        // 2. Primary Key Sun Light (Cool Cyber Blue)
        this.sunLight = new THREE.DirectionalLight(0x4a90e2, 0.85);
        this.sunLight.position.set(90, 180, 90);
        this.scene.add(this.sunLight);

        // 3. Secondary Rim Fill Light (Subtle Magenta Accent)
        this.rimLight = new THREE.DirectionalLight(0x881144, 0.45);
        this.rimLight.position.set(-90, 130, -90);
        this.scene.add(this.rimLight);

        // 4. Player Forward Flight Spotlight (Focused road beam, non-blinding)
        this.playerHeadlight = new THREE.SpotLight(0x00f0ff, 1.6, 280, Math.PI / 4.5, 0.5, 1.2);
        this.playerHeadlight.position.set(0, 3.5, 0);
        this.playerHeadlightTarget = new THREE.Object3D();
        this.scene.add(this.playerHeadlightTarget);
        this.playerHeadlight.target = this.playerHeadlightTarget;
        this.scene.add(this.playerHeadlight);

        // Infinite Tron Floor Grids (Radiant Neon Architecture)
        this.gridCellSize = 25;
        // Primary Cyan Glowing Grid
        this.gridHelper = new THREE.GridHelper(1200, 48, 0x00ffff, 0x0099bb);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);

        // Electric Purple Radiant Sub-Grid
        this.subGridHelper = new THREE.GridHelper(2400, 96, 0xd946ef, 0x3b0764);
        this.subGridHelper.position.y = -0.05;
        this.scene.add(this.subGridHelper);

        // High-Gloss Obsidian Tron Digital Highway Floor Plane (Reflective Cyber Mirror)
        const floorGeom = new THREE.PlaneGeometry(3200, 3200);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x020409,
            roughness: 0.08,
            metalness: 0.92,
            emissive: 0x010510,
            depthWrite: false
        });
        this.floorMesh = new THREE.Mesh(floorGeom, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.y = -0.1;
        this.scene.add(this.floorMesh);

        // Tron Horizon Cyber Monoliths & Skyline
        this.buildTronSkyline();

        // Arena Perimeter Energy Pylons (Parallax speed cues)
        this.buildArenaPylons();

        // Speed Motes / Cyber Dust (Gives High-Speed Momentum)
        this.initCyberDust();

        // Player 3D Interceptor Craft
        this.buildPlayerMesh();

        // Player Light Ribbon Wall
        this.initPlayerLightTrail();

        // Holographic 3D Ground Targeting Reticle
        this.init3DTargetReticle();

        // Procedural Cyber Monoliths, Data Arches & Coherent Energy Gates
        this.initProceduralGridWorld();

        // 3D Identity Disc Weapon Mesh
        this.buildIdentityDiscMesh();

        // 3D Holographic JEV Copilot Tactical Guidance Vectors
        this.buildCopilotVectorMesh();

        // Phase 4: 3D Holographic Target Lock Reticle
        this.buildTargetLockMesh();

        // Phase 4: Hyperspace Speed Warp Streaks
        this.buildSpeedWarpMesh();

        // Phase 5: Radiant Perimeter Forcefield & Arena Boundary Rings
        this.buildPerimeterForcefield();
    }

    /* --------------------------------------------------------------------- */
    /* PROCEDURAL CYBER GRID WORLD & ENERGY GATES                            */
    /* --------------------------------------------------------------------- */
    initProceduralGridWorld() {
        this.proceduralChunks = new Map();
        this.energyGates = [];
        this.proceduralRoot = new THREE.Group();
        this.scene.add(this.proceduralRoot);

        // Luminous Monolith & Architectural Materials
        // Luminous Dark Carbon Obelisks & Architectural Materials
        this.monolithMaterial = new THREE.MeshStandardMaterial({
            color: 0x02050b,
            roughness: 0.70,
            metalness: 0.20,
            emissive: 0x000000
        });
        this.neonCyanMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2.0 });
        this.neonMagentaMat = new THREE.LineBasicMaterial({ color: 0xff0088, linewidth: 2.0 });
        this.neonAmberMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2.0 });

        // Radiant Energy Gate Materials
        this.gateRingMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide
        });
        this.gateFieldMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.20,
            blending: THREE.AdditiveBlending
        });
    }

    _chunkHash(cx, cz) {
        return `${cx},${cz}`;
    }

    _seededRandom(seed) {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    generateChunk(cx, cz) {
        const key = this._chunkHash(cx, cz);
        const chunkGroup = new THREE.Group();
        let seed = ((cx * 374761393) ^ (cz * 668265263)) >>> 0;

        const rnd = () => {
            seed = (seed + 0x7ED55D16) >>> 0;
            return this._seededRandom(seed);
        };

        const originX = cx * 250;
        const originZ = cz * 250;

        // Skip spawn chunk center to keep clear arena for start
        if (Math.abs(cx) > 0 || Math.abs(cz) > 0) {
            // 2 Slender Monolith Spires per outer chunk (Strictly outside combat ring)
            for (let m = 0; m < 2; m++) {
                const posX = originX + (rnd() - 0.5) * 170;
                const posZ = originZ + (rnd() - 0.5) * 170;

                // Phase 6: Ensure combat dogfighting sector (radius < 310) is 100% unobstructed
                if (Math.hypot(posX, posZ) < 310) continue;

                const w = 18 + rnd() * 14;
                const d = 18 + rnd() * 14;
                const h = 80 + rnd() * 130;

                const boxGeom = new THREE.BoxGeometry(w, h, d);
                const mesh = new THREE.Mesh(boxGeom, this.monolithMaterial);
                mesh.position.set(posX, h / 2, posZ);

                const isCyan = rnd() > 0.45;
                const edgeMat = isCyan ? this.neonCyanMat : this.neonMagentaMat;
                const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeom), edgeMat);
                mesh.add(edges);

                // Sleek Wireframe Crown on Roof (No solid glowing box caps)
                const crownGeom = new THREE.BufferGeometry();
                const cw = w * 0.5;
                const cd = d * 0.5;
                const crownVerts = new Float32Array([
                    -cw, h / 2 + 0.8, -cd,   cw, h / 2 + 0.8, -cd,
                    cw, h / 2 + 0.8, -cd,    cw, h / 2 + 0.8, cd,
                    cw, h / 2 + 0.8, cd,     -cw, h / 2 + 0.8, cd,
                    -cw, h / 2 + 0.8, cd,    -cw, h / 2 + 0.8, -cd
                ]);
                crownGeom.setAttribute('position', new THREE.BufferAttribute(crownVerts, 3));
                mesh.add(new THREE.LineSegments(crownGeom, edgeMat));

                // Thin Wireframe Circuit Ribs around Obelisk
                const numBands = 2 + Math.floor(rnd() * 3);
                for (let b = 0; b < numBands; b++) {
                    const bandY = -h / 2 + 20 + b * (h / (numBands + 1));
                    const ribGeom = new THREE.BufferGeometry();
                    const rw = w * 0.505;
                    const rd = d * 0.505;
                    const ribVerts = new Float32Array([
                        -rw, bandY, -rd,   rw, bandY, -rd,
                        rw, bandY, -rd,    rw, bandY, rd,
                        rw, bandY, rd,     -rw, bandY, rd,
                        -rw, bandY, rd,    -rw, bandY, -rd
                    ]);
                    ribGeom.setAttribute('position', new THREE.BufferAttribute(ribVerts, 3));
                    mesh.add(new THREE.LineSegments(ribGeom, (b % 2 === 0) ? edgeMat : this.neonAmberMat));
                }

                chunkGroup.add(mesh);
            }

            // Energy Gate or Cyber Arch (Outside combat ring)
            if ((Math.abs(cx) + Math.abs(cz)) % 2 === 1) {
                const gateX = originX + (rnd() - 0.5) * 100;
                const gateZ = originZ + (rnd() - 0.5) * 100;

                if (Math.hypot(gateX, gateZ) >= 300) {
                    const gateGroup = new THREE.Group();
                    const ringGeom = new THREE.TorusGeometry(15, 1.8, 12, 32);
                    const ringMesh = new THREE.Mesh(ringGeom, this.gateRingMat);
                    gateGroup.add(ringMesh);

                    // Outer accent ring
                    const outerRingGeom = new THREE.TorusGeometry(18, 0.6, 8, 24);
                    const outerRingMat = new THREE.MeshBasicMaterial({ color: 0xff00aa, wireframe: true });
                    const outerRingMesh = new THREE.Mesh(outerRingGeom, outerRingMat);
                    gateGroup.add(outerRingMesh);

                    const fieldGeom = new THREE.CircleGeometry(14.0, 24);
                    const fieldMesh = new THREE.Mesh(fieldGeom, this.gateFieldMat);
                    gateGroup.add(fieldMesh);

                    // Calibrated Point Light
                    const gateLight = new THREE.PointLight(0x00ffff, 1.2, 45, 1.2);
                    gateGroup.add(gateLight);

                    gateGroup.position.set(gateX, 6.5, gateZ);
                    const isRotated = rnd() > 0.5;
                    if (isRotated) gateGroup.rotation.y = Math.PI / 2;

                    chunkGroup.add(gateGroup);

                    const gateData = {
                        x: gateX,
                        z: gateZ,
                        mesh: gateGroup,
                        ring: ringMesh,
                        outerRing: outerRingMesh,
                        light: gateLight,
                        chunkKey: key,
                        lastTrigger: 0
                    };
                    this.energyGates.push(gateData);
                }
            } else {
                // Cyber Arch spanning data highway (Strictly outside combat ring)
                const archX = originX + (rnd() - 0.5) * 110;
                const archZ = originZ + (rnd() - 0.5) * 110;

                if (Math.hypot(archX, archZ) >= 300) {
                    const archGroup = new THREE.Group();
                    const archGeom = new THREE.BoxGeometry(48, 5, 12);
                    const archMesh = new THREE.Mesh(archGeom, this.monolithMaterial);
                    archMesh.position.y = 28;
                    archMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(archGeom), this.neonCyanMat));

                    // Underside Radiant Highway Light Beam
                    const beamGeom = new THREE.PlaneGeometry(44, 10);
                    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
                    const beamMesh = new THREE.Mesh(beamGeom, beamMat);
                    beamMesh.rotation.x = Math.PI / 2;
                    beamMesh.position.y = -2.6;
                    archMesh.add(beamMesh);

                    archGroup.add(archMesh);

                    const pillarGeom = new THREE.BoxGeometry(5, 28, 10);
                    const pLeft = new THREE.Mesh(pillarGeom, this.monolithMaterial);
                    pLeft.position.set(-21, 14, 0);
                    pLeft.add(new THREE.LineSegments(new THREE.EdgesGeometry(pillarGeom), this.neonCyanMat));
                    archGroup.add(pLeft);

                    const pRight = new THREE.Mesh(pillarGeom, this.monolithMaterial);
                    pRight.position.set(21, 14, 0);
                    pRight.add(new THREE.LineSegments(new THREE.EdgesGeometry(pillarGeom), this.neonCyanMat));
                    archGroup.add(pRight);

                    archGroup.position.set(archX, 0, archZ);
                    chunkGroup.add(archGroup);
                }
            }
        }

        this.proceduralRoot.add(chunkGroup);
        this.proceduralChunks.set(key, { group: chunkGroup, cx, cz });
    }

    updateProceduralGridWorld(dt) {
        if (!this.proceduralChunks) return;

        const pX = this.player.pos.x;
        const pZ = this.player.pos.z;
        const pcx = Math.round(pX / 250);
        const pcz = Math.round(pZ / 250);

        // Keep 5x5 chunks around player
        const range = 2;
        const activeKeys = new Set();

        for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = this._chunkHash(cx, cz);
                activeKeys.add(key);

                if (!this.proceduralChunks.has(key)) {
                    this.generateChunk(cx, cz);
                }
            }
        }

        // Cull distant chunks
        for (const [key, chunk] of this.proceduralChunks.entries()) {
            if (!activeKeys.has(key)) {
                this.proceduralRoot.remove(chunk.group);
                this.energyGates = this.energyGates.filter(g => g.chunkKey !== key);
                this.proceduralChunks.delete(key);
            }
        }

        // Animate & Check Energy Gates fly-through
        const now = performance.now();
        for (let i = 0; i < this.energyGates.length; i++) {
            const gate = this.energyGates[i];
            if (gate.ring) {
                gate.ring.rotation.z += dt * 1.8;
            }

            const dist = Math.hypot(pX - gate.x, pZ - gate.z);
            if (dist < 14.0 && (now - gate.lastTrigger > 8000)) {
                gate.lastTrigger = now;
                this.player.speedBoostTimer = 4.0;
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + 25);
                this.spawnFloatingText("⚡ ENERGY GATE SURGE: +35% WARP / +25 SHIELD", pX, pZ, '#00ffcc');
                if (window.audioManager && window.audioManager.playPowerup) {
                    window.audioManager.playPowerup();
                } else if (window.audioManager && window.audioManager.playBlink) {
                    window.audioManager.playBlink();
                }
            }
        }
    }

    buildTronSkyline() {
        this.skylineGroup = new THREE.Group();
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x0c254b,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x061a3d
        });
        const edgeCyan = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2.0 });
        const edgePink = new THREE.LineBasicMaterial({ color: 0xff00aa, linewidth: 2.0 });

        // 48 Monolithic Towers on distant perimeter with bright beacon tops
        for (let i = 0; i < 48; i++) {
            const angle = (i / 48) * Math.PI * 2;
            const dist = 650 + (i % 5) * 45;
            const w = 35 + (i % 3) * 20;
            const d = 35 + (i % 4) * 15;
            const h = 100 + (i % 6) * 60;

            const boxGeom = new THREE.BoxGeometry(w, h, d);
            const tower = new THREE.Mesh(boxGeom, boxMat);
            const edgeMat = (i % 3 === 0) ? edgePink : edgeCyan;
            tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeom), edgeMat));

            // Sleek Rooftop Wireframe Crown & Antenna (No solid white glare slabs)
            const crownGeom = new THREE.BufferGeometry();
            const cw = w * 0.5;
            const cd = d * 0.5;
            const crownVerts = new Float32Array([
                -cw, h / 2 + 1, -cd,   cw, h / 2 + 1, -cd,
                cw, h / 2 + 1, -cd,    cw, h / 2 + 1, cd,
                cw, h / 2 + 1, cd,     -cw, h / 2 + 1, cd,
                -cw, h / 2 + 1, cd,    -cw, h / 2 + 1, -cd
            ]);
            crownGeom.setAttribute('position', new THREE.BufferAttribute(crownVerts, 3));
            tower.add(new THREE.LineSegments(crownGeom, edgeMat));

            // Central Antenna Beacon Line
            const antGeom = new THREE.BufferGeometry();
            antGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, h / 2, 0, 0, h / 2 + 10, 0]), 3));
            tower.add(new THREE.Line(antGeom, edgeMat));

            tower.position.set(Math.cos(angle) * dist, h / 2 - 5, Math.sin(angle) * dist);
            tower.rotation.y = angle;
            this.skylineGroup.add(tower);
        }

        // Primary Radiant Horizon Neon Ring
        const ringGeom = new THREE.RingGeometry(850, 868, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.55
        });
        const horizonRing = new THREE.Mesh(ringGeom, ringMat);
        horizonRing.rotation.x = -Math.PI / 2;
        horizonRing.position.y = 0.5;
        this.skylineGroup.add(horizonRing);

        // Secondary Outer Magenta Ring
        const outerRingGeom = new THREE.RingGeometry(940, 955, 64);
        const outerRingMat = new THREE.MeshBasicMaterial({
            color: 0xd946ef,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        const outerHorizonRing = new THREE.Mesh(outerRingGeom, outerRingMat);
        outerHorizonRing.rotation.x = -Math.PI / 2;
        outerHorizonRing.position.y = 0.6;
        this.skylineGroup.add(outerHorizonRing);

        this.scene.add(this.skylineGroup);
    }

    buildArenaPylons() {
        this.pylonGroup = new THREE.Group();
        const pylonCoords = [
            [-160, -160], [160, -160],
            [-160, 160], [160, 160],
            [0, -220], [0, 220],
            [-220, 0], [220, 0]
        ];

        const pylonGeom = new THREE.CylinderGeometry(2.4, 3.8, 85, 6);
        const pylonMat = new THREE.MeshStandardMaterial({
            color: 0x040e1c,
            metalness: 0.85,
            roughness: 0.4,
            emissive: 0x000000
        });

        pylonCoords.forEach(([px, pz], idx) => {
            const pylon = new THREE.Mesh(pylonGeom, pylonMat);
            pylon.position.set(px, 42.5, pz);

            const isPink = (idx % 2 === 1);
            const edgeMat = new THREE.LineBasicMaterial({
                color: isPink ? 0xff00aa : 0x00f0ff,
                linewidth: 2.0
            });
            pylon.add(new THREE.LineSegments(new THREE.EdgesGeometry(pylonGeom), edgeMat));

            // Top beacon orb (Calibrated non-glaring node)
            const orbGeom = new THREE.SphereGeometry(1.6, 8, 8);
            const orbMat = new THREE.MeshBasicMaterial({
                color: isPink ? 0xff00aa : 0x00f0ff,
                transparent: true,
                opacity: 0.65
            });
            const orb = new THREE.Mesh(orbGeom, orbMat);
            orb.position.set(0, 44, 0);
            pylon.add(orb);

            // Radiant Energy Rings around column
            [-15, 0, 15].forEach(yOff => {
                const ringGeom = new THREE.RingGeometry(2.6, 3.4, 16);
                ringGeom.rotateX(-Math.PI / 2);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: isPink ? 0xff00aa : 0x00f0ff,
                    transparent: true,
                    opacity: 0.45
                });
                const ring = new THREE.Mesh(ringGeom, ringMat);
                ring.position.y = yOff;
                pylon.add(ring);
            });

            this.pylonGroup.add(pylon);
        });

        this.arenaPylonPositions = pylonCoords.map(([px, pz]) => ({ x: px, z: pz, radius: 12 }));
        this.scene.add(this.pylonGroup);
    }

    /* --------------------------------------------------------------------- */
    /* PHASE 5: PERIMETER FORCEFIELD & CYBER BOUNDARIES                      */
    /* --------------------------------------------------------------------- */
    buildPerimeterForcefield() {
        this.forcefieldGroup = new THREE.Group();

        // Circular cylindrical energy boundary wall around radius 270
        const wallGeom = new THREE.CylinderGeometry(270, 270, 28, 48, 2, true);
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.22,
            wireframe: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.forcefieldWall = new THREE.Mesh(wallGeom, wallMat);
        this.forcefieldWall.position.y = 14;
        this.forcefieldGroup.add(this.forcefieldWall);

        // Lower and Upper Glowing Perimeter Rings
        const ringGeom = new THREE.RingGeometry(268, 272, 64);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });
        const bottomRing = new THREE.Mesh(ringGeom, ringMat);
        bottomRing.position.y = 0.1;
        this.forcefieldGroup.add(bottomRing);

        const topRing = bottomRing.clone();
        topRing.position.y = 28.0;
        this.forcefieldGroup.add(topRing);

        // Concentric Sector Pulse Rings on the ground
        this.sectorPulseRings = [];
        for (let r = 60; r <= 240; r += 60) {
            const pulseGeom = new THREE.RingGeometry(r - 0.4, r + 0.4, 48);
            pulseGeom.rotateX(-Math.PI / 2);
            const pulseMat = new THREE.MeshBasicMaterial({
                color: (r % 120 === 0) ? 0xff00aa : 0x00f0ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            });
            const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
            pulseMesh.position.y = 0.04;
            this.forcefieldGroup.add(pulseMesh);
            this.sectorPulseRings.push(pulseMesh);
        }

        this.scene.add(this.forcefieldGroup);
    }

    buildIdentityDiscMesh() {
        const discGroup = new THREE.Group();

        // Outer Torus Ring
        const ringGeom = new THREE.TorusGeometry(3.0, 0.45, 8, 32);
        ringGeom.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.95
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        discGroup.add(ring);

        // Outer glow aura ring
        const auraGeom = new THREE.RingGeometry(2.4, 3.6, 24);
        auraGeom.rotateX(-Math.PI / 2);
        const auraMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        discGroup.add(new THREE.Mesh(auraGeom, auraMat));

        // Inner Core Disc (Golden amber energy hub)
        const coreGeom = new THREE.CylinderGeometry(1.6, 1.6, 0.25, 16);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x112233,
            emissive: 0xffaa00,
            metalness: 0.9,
            roughness: 0.1
        });
        const core = new THREE.Mesh(coreGeom, coreMat);
        discGroup.add(core);

        // Cross Blades (4 radial energy fins)
        const bladeGeom = new THREE.BoxGeometry(0.3, 0.15, 6.2);
        const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blade1 = new THREE.Mesh(bladeGeom, bladeMat);
        const blade2 = new THREE.Mesh(bladeGeom, bladeMat);
        blade2.rotation.y = Math.PI / 2;
        discGroup.add(blade1);
        discGroup.add(blade2);

        discGroup.position.set(0, -999, 0);
        discGroup.visible = false;
        this.scene.add(discGroup);
        this.identityDisc.mesh = discGroup;
    }

    buildCopilotVectorMesh() {
        this.copilotGroup = new THREE.Group();
        this.copilotChevrons = [];

        for (let i = 0; i < 4; i++) {
            const geom = new THREE.BufferGeometry();
            const verts = new Float32Array([
                -3.2, 0.12, 2.5,
                0.0, 0.12, -2.5,
                3.2, 0.12, 2.5,
                0.0, 0.12, -0.8
            ]);
            const indices = [0, 1, 3, 1, 2, 3];
            geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            geom.setIndex(indices);
            geom.computeVertexNormals();

            const mat = new THREE.MeshBasicMaterial({
                color: 0x00ffcc,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.7
            });
            const chevron = new THREE.Mesh(geom, mat);
            this.copilotGroup.add(chevron);
            this.copilotChevrons.push(chevron);
        }

        this.copilotGroup.position.set(0, 0.15, 0);
        this.scene.add(this.copilotGroup);
    }

    buildTargetLockMesh() {
        const group = new THREE.Group();

        // 1. Inner diamond reticle
        const diamondGeom = new THREE.BufferGeometry();
        const dPoints = [
            0, 3.8, 0,    3.8, 0, 0,
            3.8, 0, 0,    0, -3.8, 0,
            0, -3.8, 0,   -3.8, 0, 0,
            -3.8, 0, 0,   0, 3.8, 0
        ];
        diamondGeom.setAttribute('position', new THREE.Float32BufferAttribute(dPoints, 3));
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.95,
            depthTest: false
        });
        const diamond = new THREE.LineSegments(diamondGeom, lineMat);
        diamond.name = "diamond";
        group.add(diamond);

        // 2. Outer bracket ring
        const ringGeom = new THREE.RingGeometry(4.6, 5.2, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            depthTest: false
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.name = "bracketRing";
        group.add(ring);

        group.position.set(0, -999, 0);
        this.scene.add(group);
        this.targetLockMesh = group;
    }

    buildSpeedWarpMesh() {
        const lineCount = 64;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(lineCount * 6);

        for (let i = 0; i < lineCount; i++) {
            const rad = 14 + Math.random() * 45;
            const ang = Math.random() * Math.PI * 2;
            const x = Math.cos(ang) * rad;
            const y = (Math.random() - 0.2) * 22;
            const zStart = (Math.random() - 0.5) * 160;
            const len = 16 + Math.random() * 32;

            positions[i * 6 + 0] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = zStart;

            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = y;
            positions[i * 6 + 5] = zStart - len;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.speedWarpMesh = new THREE.LineSegments(geom, mat);
        this.scene.add(this.speedWarpMesh);
    }

    initCyberDust() {
        const dustCount = 750;
        const dustGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(dustCount * 3);
        const colors = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 600;
            positions[i * 3 + 1] = 0.5 + Math.random() * 10.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 600;

            const r = Math.random();
            if (r > 0.6) {
                // Intense luminous white/cyan
                colors[i * 3] = 0.85; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 1.0;
            } else if (r > 0.3) {
                // Neon aqua
                colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0;
            } else {
                // Electric magenta / pink
                colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.2; colors[i * 3 + 2] = 0.7;
            }
        }

        dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        dustGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const dustMat = new THREE.PointsMaterial({
            size: 3.2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        this.dustParticles = new THREE.Points(dustGeom, dustMat);
        this.scene.add(this.dustParticles);
    }

    buildPlayerMesh() {
        this.playerGroup = new THREE.Group();
        this.exhaustPlumes = [];

        // 1. Sleek Asymmetrical Interceptor Fuselage (Tapers sharply forward to local -Z)
        // Main Fuselage Hull: Long needle prow tapering forward
        const bodyGeom = new THREE.ConeGeometry(2.4, 11.5, 4);
        bodyGeom.rotateX(Math.PI / 2); // Point cone along -Z
        bodyGeom.scale(1.15, 0.55, 1.0); // Flatten slightly for aerodynamic profile
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x050f1c,
            roughness: 0.18,
            metalness: 0.92,
            emissive: 0x011324,
        });
        this.playerBody = new THREE.Mesh(bodyGeom, bodyMat);
        this.playerBody.position.set(0, 0.2, -0.6);
        this.playerGroup.add(this.playerBody);

        const bodyEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeom),
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2.5 })
        );
        bodyEdges.position.copy(this.playerBody.position);
        this.playerGroup.add(bodyEdges);

        // Forward High-Glow Needle Prow Spear (-Z = -7.2 to -9.0) - High-contrast Front Indicator
        const needleGeom = new THREE.CylinderGeometry(0.12, 0.45, 3.6, 8);
        needleGeom.rotateX(Math.PI / 2);
        const needleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const needle = new THREE.Mesh(needleGeom, needleMat);
        needle.position.set(0, 0.2, -7.4);
        this.playerGroup.add(needle);

        // Needle Tip Beacon Node (Subtle cyan apex point, non-blinding)
        const tipGeom = new THREE.SphereGeometry(0.20, 8, 8);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.position.set(0, 0.2, -9.2);
        this.playerGroup.add(tip);

        // 2. High-Contrast Golden-Amber Cockpit Canopy Visor (Located Forward at -Z = -2.5 to -4.8)
        // The warm golden-amber glow provides instantaneous front-vs-back color contrast
        const canopyGeom = new THREE.ConeGeometry(1.2, 4.4, 4);
        canopyGeom.rotateX(Math.PI / 2);
        canopyGeom.scale(0.9, 0.6, 1.0);
        const canopyMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff7700,
            roughness: 0.08,
            metalness: 0.35,
            transparent: true,
            opacity: 0.92
        });
        this.cockpitCanopy = new THREE.Mesh(canopyGeom, canopyMat);
        this.cockpitCanopy.position.set(0, 0.95, -3.2);
        this.playerGroup.add(this.cockpitCanopy);

        const canopyEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(canopyGeom),
            new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 })
        );
        canopyEdges.position.copy(this.cockpitCanopy.position);
        this.playerGroup.add(canopyEdges);

        // Forward Glowing Dorsal Chevrons pointing forward to -Z
        [-1.8, -2.8].forEach(zPos => {
            const chevGeom = new THREE.BufferGeometry();
            const chevVerts = new Float32Array([
                -1.1, 0.82, zPos + 0.55,
                0.0, 0.85, zPos,
                1.1, 0.82, zPos + 0.55
            ]);
            chevGeom.setAttribute('position', new THREE.BufferAttribute(chevVerts, 3));
            const chevMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
            const chevLine = new THREE.Line(chevGeom, chevMat);
            this.playerGroup.add(chevLine);
        });

        // 3. Wide Swept-Back Delta Wings (Starts at -Z = -1.5, sweeps back to +Z = +3.8, X = ±8.6)
        const wingGeom = new THREE.BufferGeometry();
        const wingVertices = new Float32Array([
            // Left Wing (Apex at -1.5, tip at -8.6/3.8, root at 0/4.2)
            0, 0.1, -1.8,
            -8.6, 0.1, 3.8,
            -2.6, 0.1, 4.4,

            0, 0.1, -1.8,
            -2.6, 0.1, 4.4,
            0, 0.1, 4.4,

            // Right Wing
            0, 0.1, -1.8,
            8.6, 0.1, 3.8,
            2.6, 0.1, 4.4,

            0, 0.1, -1.8,
            2.6, 0.1, 4.4,
            0, 0.1, 4.4,
        ]);
        wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
        wingGeom.computeVertexNormals();

        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x040c18,
            roughness: 0.18,
            metalness: 0.88,
            side: THREE.DoubleSide,
            emissive: 0x011322
        });
        const wings = new THREE.Mesh(wingGeom, wingMat);
        this.playerGroup.add(wings);

        const wingEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(wingGeom),
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2.5 })
        );
        this.playerGroup.add(wingEdges);

        // Wingtip Navigation Energy Beacons
        const leftNav = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
        leftNav.position.set(-8.6, 0.15, 3.8);
        this.playerGroup.add(leftNav);

        const rightNav = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff00aa }));
        rightNav.position.set(8.6, 0.15, 3.8);
        this.playerGroup.add(rightNav);

        // Twin Forward Wing Plasma Cannons (Muzzles point forward to -Z = -5.8)
        [-3.4, 3.4].forEach(xOff => {
            const cannonGeom = new THREE.CylinderGeometry(0.30, 0.38, 4.2, 8);
            cannonGeom.rotateX(Math.PI / 2);
            const cannon = new THREE.Mesh(cannonGeom, new THREE.MeshStandardMaterial({ color: 0x0a1c30, metalness: 0.85, roughness: 0.2 }));
            cannon.position.set(xOff, 0.1, -2.8);
            this.playerGroup.add(cannon);

            const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            muzzle.geometry.rotateX(Math.PI / 2);
            muzzle.position.set(xOff, 0.1, -5.0);
            this.playerGroup.add(muzzle);
        });

        // 4. TWIN VERTICAL STABILIZER TAIL FINS (Crucial Rear Silhouette Landmark at +Z = +1.5 to +4.8)
        // These canted vertical rudders make the rear instantly recognizable from all perspectives!
        [-3.2, 3.2].forEach((xOff, idx) => {
            const finGeom = new THREE.BufferGeometry();
            const finVerts = new Float32Array([
                // Root forward, Root aft, Top tip
                0, 0.2, 1.2,
                0, 0.2, 4.8,
                (idx === 0 ? -0.8 : 0.8), 3.4, 4.2
            ]);
            finGeom.setAttribute('position', new THREE.BufferAttribute(finVerts, 3));
            finGeom.computeVertexNormals();

            const finMat = new THREE.MeshStandardMaterial({
                color: 0x051222,
                roughness: 0.15,
                metalness: 0.9,
                side: THREE.DoubleSide,
                emissive: 0x02182c
            });
            const finMesh = new THREE.Mesh(finGeom, finMat);
            finMesh.position.set(xOff, 0, 0);
            this.playerGroup.add(finMesh);

            // Glowing neon spine along vertical tail fin
            const finEdge = new THREE.LineSegments(
                new THREE.EdgesGeometry(finGeom),
                new THREE.LineBasicMaterial({ color: (idx === 0 ? 0x00ffff : 0x00d4ff), linewidth: 3.0 })
            );
            finEdge.position.set(xOff, 0, 0);
            this.playerGroup.add(finEdge);
        });

        // 5. Oversized Dual Turbine Ion Afterburners (Located Stern at +Z = +4.8)
        const engMat = new THREE.MeshStandardMaterial({ color: 0x0d2138, metalness: 0.9, roughness: 0.2 });
        const coreGlowMat = new THREE.MeshBasicMaterial({ color: 0x00a2ff });
        const engGeom = new THREE.CylinderGeometry(1.15, 1.35, 2.6, 12);
        engGeom.rotateX(Math.PI / 2);

        [-1.8, 1.8].forEach(xOff => {
            const nacelle = new THREE.Mesh(engGeom, engMat);
            nacelle.position.set(xOff, 0.25, 4.5);
            this.playerGroup.add(nacelle);

            // Glowing Turbine Core Disc inside exhaust nozzle
            const nozzleCore = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), coreGlowMat);
            nozzleCore.position.set(xOff, 0.25, 5.82);
            this.playerGroup.add(nozzleCore);

            // Outer Neon Rim on Exhaust Bell
            const rimGeom = new THREE.RingGeometry(0.95, 1.25, 16);
            const rimMesh = new THREE.Mesh(rimGeom, new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide }));
            rimMesh.position.set(xOff, 0.25, 5.84);
            this.playerGroup.add(rimMesh);
        });

        // Animated Twin Ion Exhaust Plumes (Extending backwards into +Z wake)
        const plumeGeom = new THREE.ConeGeometry(0.85, 4.8, 12);
        plumeGeom.rotateX(-Math.PI / 2);
        const plumeMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.60,
            blending: THREE.AdditiveBlending
        });

        const leftPlume = new THREE.Mesh(plumeGeom, plumeMat);
        leftPlume.position.set(-1.8, 0.25, 8.0);
        this.playerGroup.add(leftPlume);

        const rightPlume = new THREE.Mesh(plumeGeom, plumeMat.clone());
        rightPlume.position.set(1.8, 0.25, 8.0);
        this.playerGroup.add(rightPlume);

        this.exhaustPlumes.push(leftPlume, rightPlume);

        // Dynamic Thruster Point Light (Calibrated intensity)
        this.thrusterLight = new THREE.PointLight(0x00a2ff, 1.4, 25);
        this.thrusterLight.position.set(0, 0.8, 5.5);
        this.playerGroup.add(this.thrusterLight);

        // 6. Synchronized Grid Under-Glow Aura: Sleek Vector Bracket Perimeter Ring
        // Thin vector ring at Y = -2.15 (ground plane) that never obscures the ship or reticle
        const underGlowGroup = new THREE.Group();
        const glowGeom = new THREE.RingGeometry(5.2, 5.6, 32);
        glowGeom.rotateX(-Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.30
        });
        const ringMesh = new THREE.Mesh(glowGeom, glowMat);
        underGlowGroup.add(ringMesh);

        // Forward Heading Chevron Arrow on Floor Ring (Pointing forward to local -Z)
        const arrowGeom = new THREE.BufferGeometry();
        const arrowVerts = new Float32Array([
            -2.4, 0.01, -3.2,
            0.0, 0.01, -7.2,
            2.4, 0.01, -3.2
        ]);
        arrowGeom.setAttribute('position', new THREE.BufferAttribute(arrowVerts, 3));
        const arrowLine = new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2.5 }));
        underGlowGroup.add(arrowLine);

        underGlowGroup.position.set(0, -2.15, 0); // Position exactly on the ground plane (Y = 0.05 in world space)
        this.playerGroup.add(underGlowGroup);
        this.playerUnderGlow = underGlowGroup;

        // 7. Impact Shield Flash Aura: Hexagonal Wireframe Energy Lattice
        // Wireframe energy shell hugs the ship contours without obscuring the fuselage or visor
        const shieldGeom = new THREE.IcosahedronGeometry(7.0, 1);
        this.shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });
        this.shieldMesh = new THREE.Mesh(shieldGeom, this.shieldMat);
        this.playerGroup.add(this.shieldMesh);

        this.playerGroup.position.set(0, 2.2, 0);
        this.scene.add(this.playerGroup);
    }

    initPlayerLightTrail() {
        const maxSegments = this.player.maxTrailPoints;
        const maxVertices = maxSegments * 6;
        const positions = new Float32Array(maxVertices * 3);
        const colors = new Float32Array(maxVertices * 3);

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.playerTrailMesh = new THREE.Mesh(geom, mat);
        this.scene.add(this.playerTrailMesh);
    }

    init3DTargetReticle() {
        this.reticleGroup = new THREE.Group();

        // 1. Segmented Outer Reticle Ring
        const ringGeom = new THREE.RingGeometry(3.6, 4.4, 32);
        ringGeom.rotateX(-Math.PI / 2);
        this.reticleRingMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.reticleRing = new THREE.Mesh(ringGeom, this.reticleRingMat);
        this.reticleGroup.add(this.reticleRing);

        // 2. High-Tech Crosshair Brackets
        const tickMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        const tickPoints = [
            new THREE.Vector3(-6.5, 0.1, 0), new THREE.Vector3(-4.8, 0.1, 0),
            new THREE.Vector3(4.8, 0.1, 0), new THREE.Vector3(6.5, 0.1, 0),
            new THREE.Vector3(0, 0.1, -6.5), new THREE.Vector3(0, 0.1, -4.8),
            new THREE.Vector3(0, 0.1, 4.8), new THREE.Vector3(0, 0.1, 6.5),
        ];
        const tickGeom = new THREE.BufferGeometry().setFromPoints(tickPoints);
        this.reticleTicks = new THREE.LineSegments(tickGeom, tickMat);
        this.reticleGroup.add(this.reticleTicks);

        // 3. Central Pulsing Targeting Core
        const diamondGeom = new THREE.RingGeometry(0.3, 1.1, 4);
        diamondGeom.rotateX(-Math.PI / 2);
        diamondGeom.rotateY(Math.PI / 4);
        this.reticleDiamondMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        this.reticleDiamond = new THREE.Mesh(diamondGeom, this.reticleDiamondMat);
        this.reticleGroup.add(this.reticleDiamond);

        this.reticleGroup.position.set(0, 0.15, 0);
        this.scene.add(this.reticleGroup);
    }

    /* --------------------------------------------------------------------- */
    /* 2D HTML5 CANVAS ENGINE SETUP                                          */
    /* --------------------------------------------------------------------- */
    init2DCanvas() {
        this.resizeCanvases();
    }

    resizeCanvases() {
        const width = this.container.clientWidth || (window.innerWidth - 370);
        const height = this.container.clientHeight || (window.innerHeight - 52);

        // 2D Canvas resize
        if (this.canvas2d) {
            this.canvas2d.width = width;
            this.canvas2d.height = height;
        }

        // 3D Canvas resize
        if (this.renderer && this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            if (this.composer) {
                this.composer.setSize(width, height);
            }
        }
    }

    /* --------------------------------------------------------------------- */
    /* VIEW MODE SWITCHER (2D CLASSIC <-> 3D TRON)                           */
    /* --------------------------------------------------------------------- */
    toggleRenderMode() {
        if (this.renderMode === '3d') {
            this.setRenderMode('2d');
        } else {
            this.setRenderMode('3d');
        }
    }

    setRenderMode(mode) {
        if (mode === '3d' && !this.hasWebGL) {
            this.spawnFloatingText("3D WebGL NOT SUPPORTED", this.player.pos.x, this.player.pos.z, '#ff0055');
            mode = '2d';
        }
        this.renderMode = mode;
        const btn = document.getElementById('btn-view-mode');
        const badge = document.getElementById('hud-mode-badge');
        const camBtn = document.getElementById('btn-camera');

        if (mode === '2d') {
            this.canvas3d.style.display = 'none';
            this.canvas2d.style.display = 'block';
            if (this.cockpitOverlay) this.cockpitOverlay.style.display = 'none';

            if (btn) btn.innerHTML = '🎮 VIEW: 2D CLASSIC [G]';
            if (badge) badge.innerText = '2D RETRO ARENA';
            if (camBtn) camBtn.style.opacity = '0.5';

            const rearContainer = document.getElementById('rearview-mirror-container');
            if (rearContainer) rearContainer.style.display = 'none';

            this.spawnFloatingText("VIEW: 2D RETRO ARENA", this.player.pos.x, this.player.pos.z, '#00ffcc');
            if (window.audioManager) window.audioManager.playBlink();
        } else {
            this.canvas2d.style.display = 'none';
            this.canvas3d.style.display = 'block';
            if (this.cameraMode === 'cockpit' && this.cockpitOverlay) {
                this.cockpitOverlay.style.display = 'block';
            }

            if (btn) btn.innerHTML = '🎮 VIEW: 3D TRON [G]';
            if (badge) badge.innerText = '3D TRON INFINITE';
            if (camBtn) camBtn.style.opacity = '1.0';

            const rearContainer = document.getElementById('rearview-mirror-container');
            if (rearContainer) rearContainer.style.display = 'block';

            // Sync all 3D mesh positions immediately
            this.sync3DSceneAfterModeSwitch();
            this.spawnFloatingText("VIEW: 3D TRON INFINITE", this.player.pos.x, this.player.pos.z, '#ff00ff');
            if (window.audioManager) window.audioManager.playOverdrive();
        }

        this.resizeCanvases();
    }

    sync3DSceneAfterModeSwitch() {
        // Synchronize player mesh
        if (this.playerGroup) {
            this.playerGroup.position.set(this.player.pos.x, 2.2, this.player.pos.z);
            this.playerGroup.rotation.y = this.player.angle;
        }

        // Synchronize enemy meshes
        this.enemies.forEach(e => {
            if (e.mesh) {
                e.mesh.position.set(e.x, e.type === 'boss' ? 14 : 2.0, e.z);
                e.mesh.rotation.y = e.angle;
            }
        });
    }

    toggleCameraView() {
        if (this.renderMode === '2d') {
            // Camera toggle in 2D switches to 3D
            this.setRenderMode('3d');
            return;
        }

        this.isLookingBack = false;
        const lookbackBanner = document.getElementById('lookback-banner');
        if (lookbackBanner) lookbackBanner.style.display = 'none';

        const modes = ['chase', 'tactical', 'cockpit'];
        const idx = modes.indexOf(this.cameraMode);
        this.cameraMode = modes[(idx + 1) % modes.length];

        const btn = document.getElementById('btn-camera');
        if (btn) {
            btn.innerHTML = `🎥 CAM: ${this.cameraMode.toUpperCase()} [V]`;
        }

        if (this.cockpitOverlay) {
            this.cockpitOverlay.style.display = (this.cameraMode === 'cockpit') ? 'block' : 'none';
        }

        this.spawnFloatingText(`CAM: ${this.cameraMode.toUpperCase()}`, this.player.pos.x, this.player.pos.z, '#00ffff');
        if (window.audioManager) window.audioManager.playBlink();
    }

    /* --------------------------------------------------------------------- */
    /* INPUT & EVENT LISTENERS                                               */
    /* --------------------------------------------------------------------- */
    initEvents() {
        window.addEventListener('resize', () => this.resizeCanvases());

        // Phase 5: Universal interaction unlock to immediately engage Tron Daft Punk soundtrack
        const unlockAudioHandler = () => {
            if (window.audioManager && !window.audioManager.isAudioUnlocked) {
                window.audioManager.unlockAudioAndStartMusic();
            }
        };
        window.addEventListener('pointerdown', unlockAudioHandler, { passive: true });
        window.addEventListener('keydown', unlockAudioHandler, { passive: true });

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.triggerQuantumBlink();
            } else if (e.key.toLowerCase() === 'q') {
                this.throwIdentityDisc();
            } else if (e.key.toLowerCase() === 'r') {
                this.toggleLookBack();
            } else if (e.key.toLowerCase() === 'e') {
                this.deployMine();
            } else if (e.key.toLowerCase() === 'v') {
                this.toggleCameraView();
            } else if (e.key.toLowerCase() === 'g') {
                this.toggleRenderMode();
            } else if (e.key.toLowerCase() === 'p') {
                this.toggleAutoPilot();
            } else if (e.key.toLowerCase() === 'm') {
                if (window.audioManager) {
                    if (!window.audioManager.isAudioUnlocked) {
                        window.audioManager.unlockAudioAndStartMusic();
                    } else {
                        window.audioManager.toggleMusic();
                    }
                }
            } else if (e.key.toLowerCase() === 'n') {
                if (window.audioManager) window.audioManager.toggleSfx();
            } else if (e.key.toLowerCase() === 'c') {
                this.toggleCRT();
            } else if (e.key === 'Enter' && this.isGameOver) {
                this.restartGame();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        const activeCanvases = [this.canvas2d, this.canvas3d];
        activeCanvases.forEach(canvas => {
            if (!canvas) return;

            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                this.mouseScreen.x = e.clientX - rect.left;
                this.mouseScreen.y = e.clientY - rect.top;

                // 3D Raycasting
                const ndcX = (this.mouseScreen.x / canvas.clientWidth) * 2 - 1;
                const ndcY = -(this.mouseScreen.y / canvas.clientHeight) * 2 + 1;
                this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
                this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);

                // Aim Angle calculation (Local -Z is Forward in 3D Three.js)
                if (this.renderMode === '3d') {
                    if (this.cameraMode === 'cockpit') {
                        // In cockpit view, continuous flight yaw is handled smoothly in updatePlayerMovement(dt)
                    } else if (this.aimPoint) {
                        const dx = this.aimPoint.x - this.player.pos.x;
                        const dz = this.aimPoint.z - this.player.pos.z;
                        this.player.targetAngle = Math.atan2(-dx, -dz);
                    }
                } else {
                    // In 2D: aim from center of viewport to mouse (Negative Y is Up)
                    const cx = canvas.clientWidth / 2;
                    const cy = canvas.clientHeight / 2;
                    const dx = this.mouseScreen.x - cx;
                    const dy = this.mouseScreen.y - cy;
                    this.player.targetAngle = Math.atan2(dx, -dy);
                }
            });

            canvas.addEventListener('mousedown', (e) => {
                if (window.audioManager && !window.audioManager.isAudioUnlocked) {
                    window.audioManager.unlockAudioAndStartMusic();
                }

                if (e.button === 0) {
                    this.isMouseDown = true;
                } else if (e.button === 2) {
                    e.preventDefault();
                    this.deployMine();
                } else if (e.button === 1) {
                    e.preventDefault();
                    this.throwIdentityDisc();
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 0) this.isMouseDown = false;
            });

            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.deployMine();
            });

            canvas.addEventListener('wheel', (e) => {
                if (this.renderMode === '3d') {
                    e.preventDefault();
                    this.camZoom = Math.max(18, Math.min(85, this.camZoom + e.deltaY * 0.04));
                }
            }, { passive: false });
        });
    }

    toggleAutoPilot() {
        this.autoPilot = !this.autoPilot;
        const btn = document.getElementById('btn-autopilot');
        if (btn) {
            btn.classList.toggle('active', this.autoPilot);
            btn.innerHTML = this.autoPilot ? '⚡ JEV AUTOPILOT: ENGAGED [P]' : '🤖 JEV AUTOPILOT [P]';
        }
        this.spawnFloatingText(
            this.autoPilot ? "JEV AUTOPILOT ENGAGED" : "MANUAL CONTROL RESTORED",
            this.player.pos.x,
            this.player.pos.z,
            this.autoPilot ? "#ffaa00" : "#00ffcc"
        );
        if (window.audioManager) window.audioManager.playBlink();
    }

    toggleCRT() {
        const crt = document.getElementById('crt-overlay');
        if (crt) crt.classList.toggle('active');
    }

    /* --------------------------------------------------------------------- */
    /* BACKEND & JEV PROTOCOL INTEGRATION                                    */
    /* --------------------------------------------------------------------- */
    async checkBackendHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            if (res.ok) {
                const data = await res.json();
                if (window.jevHud) window.jevHud.updateConfigStatus(data.jev || data);
            }
        } catch (e) {
            console.warn("Backend offline, running local calibrated decision engine:", e);
        }
    }

    async queryDirector() {
        try {
            const payload = {
                wave: this.wave,
                player_hp: this.player.hp,
                player_shield: this.player.shield,
                enemies_alive: this.enemies.length,
                enemies_defeated_this_wave: this.enemiesDefeated,
                time_in_wave_sec: (performance.now() - this.waveStartTime) / 1000,
                player_dps: Math.floor(this.score / Math.max(1, (performance.now() - this.waveStartTime) / 1000))
            };

            const res = await fetch(`${API_BASE}/api/director`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const decision = await res.json();
                this.executeDirectorDecision(decision);
                if (window.jevHud) window.jevHud.recordDecision('DIRECTOR', payload, decision);
            }
        } catch (e) {
            // Local Fallback Director
            this.executeDirectorFallback();
        }
    }

    executeDirectorDecision(d) {
        if (!d) return;
        const pacing = d.pacing || 'maintain';
        if (pacing === 'spawn_reinforcements' || pacing === 'ambush') {
            this.spawnEnemy('stalker');
            this.spawnEnemy(Math.random() > 0.5 ? 'drone' : 'heavy');
            this.spawnFloatingText("DIRECTOR: REINFORCEMENTS INBOUND", this.player.pos.x, this.player.pos.z, '#ffaa00');
        } else if (pacing === 'spawn_pickup') {
            this.spawnPickup(Math.random() > 0.5 ? 'shield' : 'overdrive');
        }

        if (d.hazard_spawn && Math.random() < 0.6) {
            this.spawnHazard();
        }

        if (d.tactical_copilot_advisory) {
            const copilotElem = document.getElementById('cockpit-copilot');
            if (copilotElem) {
                copilotElem.innerText = `AI COPILOT: ${d.tactical_copilot_advisory.toUpperCase()}`;
            }
            this.lastCopilotMessage = d.tactical_copilot_advisory;
        }
    }

    executeDirectorFallback() {
        if (this.enemies.length < 4 + this.wave * 2) {
            this.spawnEnemy(Math.random() > 0.6 ? 'drone' : 'stalker');
        }
    }

    async queryEnemyTactics() {
        if (this.enemies.length === 0) return;
        const e = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        const dist = Math.hypot(this.player.pos.x - e.x, this.player.pos.z - e.z);

        const payload = {
            enemy_id: e.id,
            enemy_type: e.type,
            distance_to_player: Math.round(dist),
            player_hp_pct: Math.round((this.player.hp / this.player.maxHp) * 100),
            player_shield_pct: Math.round((this.player.shield / this.player.maxShield) * 100),
            allies_nearby_count: this.enemies.filter(other => other !== e && Math.hypot(other.x - e.x, other.z - e.z) < 120).length,
            is_under_fire: (this.bullets.filter(b => Math.hypot(b.x - e.x, b.z - e.z) < 80).length > 0)
        };

        try {
            const res = await fetch(`${API_BASE}/api/tactics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const decision = await res.json();
                e.tactic = decision.tactic || 'direct_charge';
                if (decision.is_berserk !== undefined) e.isBerserk = decision.is_berserk;
                if (window.jevHud) window.jevHud.recordDecision(e.type.toUpperCase(), payload, decision);
            }
        } catch (err) {
            // Local fallback
            e.tactic = dist < 70 ? 'direct_charge' : 'flank_left';
        }
    }

    async queryBotAutopilot() {
        let nearestEnemy = null;
        let nearestDist = 9999;
        this.enemies.forEach(e => {
            const d = Math.hypot(this.player.pos.x - e.x, this.player.pos.z - e.z);
            if (d < nearestDist) {
                nearestDist = d;
                nearestEnemy = e;
            }
        });

        const incomingBullets = this.enemyBullets.filter(b => {
            const d = Math.hypot(this.player.pos.x - b.x, this.player.pos.z - b.z);
            return d < 120;
        });

        const payload = {
            player_hp: this.player.hp,
            player_shield: this.player.shield,
            incoming_bullets_count: incomingBullets.length,
            distance_to_nearest_enemy: Math.round(nearestDist),
            dash_charges: this.player.dashCharges,
            is_overheated: this.player.isOverheated,
            heat_level: Math.round(this.player.heat),
            hazard_warning_active: this.activeHazards.some(h => h.warningTimer > 0)
        };

        try {
            const res = await fetch(`${API_BASE}/api/autopilot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const decision = await res.json();
                this.botIntent = {
                    nav: decision.navigation_action || 'circle_strafe_cw',
                    targetPriority: 'focus_nearest',
                    fire: decision.trigger_fire ?? true,
                    dash: decision.emergency_dash ?? false,
                    urgency: decision.threat_level || 0.4
                };
                if (window.jevHud) window.jevHud.recordDecision('AUTOPILOT', payload, decision);
            }
        } catch (err) {
            // Fallback bot intent
            this.botIntent = {
                nav: nearestDist < 90 ? 'retreat_open_space' : 'circle_strafe_cw',
                targetPriority: 'focus_nearest',
                fire: true,
                dash: incomingBullets.length > 2,
                urgency: 0.3
            };
        }
    }

    /* --------------------------------------------------------------------- */
    /* SPAWNING & ENTITIES                                                   */
    /* --------------------------------------------------------------------- */
    startWave(w) {
        this.wave = w;
        this.waveStartTime = performance.now();
        this.enemiesDefeated = 0;

        // Balanced tactical ramp: Wave 1 starts accessible with 2 stalkers and 1 drone
        const stalkerCount = Math.max(2, 2 + (w - 1) * 2);
        const droneCount = Math.max(1, 1 + Math.floor((w - 1) * 1.5));
        const heavyCount = Math.floor((w - 1) * 0.8);

        for (let i = 0; i < stalkerCount; i++) this.spawnEnemy('stalker');
        for (let i = 0; i < droneCount; i++) this.spawnEnemy('drone');
        for (let i = 0; i < heavyCount; i++) this.spawnEnemy('heavy');

        if (w % 3 === 0) {
            this.spawnEnemy('boss');
        }

        // Grant 2.5s overcharge shield on wave start to prevent spawn camp
        this.player.invulnerableTimer = 2.5;

        this.spawnPickup('shield');
        this.spawnFloatingText(`GRID INVASION: WAVE ${w}`, this.player.pos.x, this.player.pos.z, '#00ffff');
        this.spawnFloatingText(`OVERCHARGE SHIELD ACTIVE (2.5s)`, this.player.pos.x, this.player.pos.z - 25, '#00a2ff');
        if (window.audioManager) window.audioManager.playOverdrive();
    }

    spawnEnemy(type) {
        // Spawn far enough away (380-580 units) for tactical reaction time
        const spawnDist = 380 + Math.random() * 200;
        const spawnAngle = Math.random() * Math.PI * 2;
        const x = this.player.pos.x + Math.cos(spawnAngle) * spawnDist;
        const z = this.player.pos.z + Math.sin(spawnAngle) * spawnDist;

        let hp = 35;
        let speed = 90;
        let radius = 14;
        let color = 0xff0055;
        let mesh;

        if (type === 'stalker') {
            // Authentic Tron Light Cycle with glowing rim wheels
            mesh = this.buildTronLightCycleMesh();
            speed = 78;
            hp = 32;
            radius = 12;
            color = 0xff0055;
        } else if (type === 'drone') {
            // Tron Bit: Dual compound polyhedra with pulsating glowing core
            mesh = this.buildTronBitMesh();
            speed = 62;
            hp = 50;
            radius = 14;
            color = 0xffbb00;
        } else if (type === 'heavy') {
            // Heavy Armored Cyber Tank with rotating turret
            mesh = this.buildTronTankMesh();
            speed = 44;
            hp = 160;
            radius = 20;
            color = 0xff4400;
        } else if (type === 'boss') {
            // Iconic flying Tron Recognizer
            mesh = this.buildTronRecognizerMesh();
            speed = 52;
            hp = 700 + this.wave * 140;
            radius = 35;
            color = 0xff00aa;
        }

        mesh.position.set(x, type === 'boss' ? 14 : 2.0, z);
        this.scene.add(mesh);

        const enemyObj = {
            id: 'e_' + Math.random().toString(36).substring(2, 8),
            type,
            x,
            z,
            mesh,
            hp,
            maxHp: hp,
            speed,
            turnSpeed: (type === 'stalker') ? 2.5 : ((type === 'drone') ? 1.8 : ((type === 'heavy') ? 0.9 : 0.55)),
            chargeState: 'cruise',
            chargeTimer: 2.0 + Math.random() * 2.5,
            radius,
            color,
            shootTimer: 0.5 + Math.random() * 2.0,
            tactic: 'direct_charge',
            isBerserk: false,
            angle: Math.atan2(this.player.pos.x - x, this.player.pos.z - z),
            trailPoints: [],
            trailMesh: (type === 'stalker') ? this.createLightCycleTrailMesh() : null,
            targetingLaser: (type === 'heavy') ? this.createTargetingLaserMesh() : null,
            // Phase 4 Recognizer Boss State
            bossPhase: 1,
            gridSweepTimer: 4.2,
            isChargingSweep: false,
            sweepChargeTimer: 0,
            hasSpawnedEscorts: false,
            cannonSide: 1,
        };

        if (enemyObj.trailMesh) this.scene.add(enemyObj.trailMesh);
        if (enemyObj.targetingLaser) this.scene.add(enemyObj.targetingLaser);

        if (type === 'boss') {
            if (window.audioManager && window.audioManager.playBossWarning) {
                window.audioManager.playBossWarning();
            }
            this.spawnFloatingText('CRITICAL WARNING: COMMAND RECOGNIZER DETECTED!', this.player.pos.x, this.player.pos.z - 30, '#ff0055');
        }

        this.enemies.push(enemyObj);
    }

    /* 3D MESH GENERATORS (AUTHENTIC TRON GEOMETRY) */

    // 1. Tron Light Cycle (Stalker)
    buildTronLightCycleMesh() {
        const group = new THREE.Group();
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x080104,
            roughness: 0.12,
            metalness: 0.95,
            emissive: 0x140005
        });
        const neonCrimson = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const neonCore = new THREE.MeshBasicMaterial({ color: 0xff3377 });
        const edgeCrimson = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 2 });

        // 1. Central Aerodynamic Fairing & Chassis
        const chassisGeom = new THREE.BoxGeometry(2.0, 1.8, 6.4);
        const chassis = new THREE.Mesh(chassisGeom, chassisMat);
        chassis.position.y = 1.0;
        chassis.add(new THREE.LineSegments(new THREE.EdgesGeometry(chassisGeom), edgeCrimson));
        group.add(chassis);

        // 2. Rider Canopy / Slanted Visor
        const visorGeom = new THREE.ConeGeometry(1.0, 3.0, 4);
        visorGeom.rotateX(Math.PI / 2);
        const visor = new THREE.Mesh(visorGeom, neonCrimson);
        visor.position.set(0, 1.8, -0.6);
        group.add(visor);

        // 3. Front Wheel Assembly (Prominent Neon Rim & Enclosed Hub)
        const wheelGeom = new THREE.TorusGeometry(1.6, 0.4, 12, 28);
        const frontWheel = new THREE.Mesh(wheelGeom, neonCrimson);
        frontWheel.rotation.y = Math.PI / 2;
        frontWheel.position.set(0, 1.4, -3.2);
        group.add(frontWheel);

        const hubGeom = new THREE.CylinderGeometry(0.8, 0.8, 0.85, 12);
        hubGeom.rotateZ(Math.PI / 2);
        const frontHub = new THREE.Mesh(hubGeom, chassisMat);
        frontHub.position.set(0, 1.4, -3.2);
        group.add(frontHub);

        // Front Cowl Fairing over front wheel
        const cowlGeom = new THREE.BoxGeometry(1.6, 0.85, 2.5);
        const cowl = new THREE.Mesh(cowlGeom, chassisMat);
        cowl.position.set(0, 2.0, -2.8);
        cowl.add(new THREE.LineSegments(new THREE.EdgesGeometry(cowlGeom), edgeCrimson));
        group.add(cowl);

        // 4. Rear Wheel Assembly
        const rearWheel = new THREE.Mesh(wheelGeom, neonCrimson);
        rearWheel.rotation.y = Math.PI / 2;
        rearWheel.position.set(0, 1.4, 3.0);
        group.add(rearWheel);

        const rearHub = new THREE.Mesh(hubGeom, chassisMat);
        rearHub.position.set(0, 1.4, 3.0);
        group.add(rearHub);

        // Rear Light Ribbon Stern Emitter
        const sternGeom = new THREE.BoxGeometry(1.4, 1.3, 1.2);
        const stern = new THREE.Mesh(sternGeom, neonCore);
        stern.position.set(0, 1.2, 3.4);
        group.add(stern);

        // 5. Dual Neon Side Runners
        const sideStripGeom = new THREE.BoxGeometry(0.12, 0.3, 4.4);
        const leftStrip = new THREE.Mesh(sideStripGeom, neonCore);
        leftStrip.position.set(-1.08, 0.9, 0);
        const rightStrip = new THREE.Mesh(sideStripGeom, neonCore);
        rightStrip.position.set(1.08, 0.9, 0);
        group.add(leftStrip);
        group.add(rightStrip);

        return group;
    }

    createLightCycleTrailMesh() {
        const maxSegments = 24;
        const positions = new Float32Array(maxSegments * 6 * 3);
        const colors = new Float32Array(maxSegments * 6 * 3);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Mesh(geom, mat);
    }

    // 2. Tron "Bit" Drone
    buildTronBitMesh() {
        const group = new THREE.Group();

        // Outer Rotating Wireframe Icosahedron
        const outerGeom = new THREE.IcosahedronGeometry(3.2, 0);
        const outerWire = new THREE.LineSegments(
            new THREE.EdgesGeometry(outerGeom),
            new THREE.LineBasicMaterial({ color: 0xffbb00, linewidth: 2 })
        );
        group.add(outerWire);

        // Inner Pulsating Solid Core Octahedron
        const innerGeom = new THREE.OctahedronGeometry(1.8, 0);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
        const innerMesh = new THREE.Mesh(innerGeom, innerMat);
        group.add(innerMesh);

        // Under-glow ring
        const glowGeom = new THREE.RingGeometry(0.3, 3.2, 16);
        glowGeom.rotateX(-Math.PI / 2);
        const glowMesh = new THREE.Mesh(glowGeom, new THREE.MeshBasicMaterial({
            color: 0xffbb00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        }));
        glowMesh.position.y = -4.5;
        group.add(glowMesh);

        group.position.y = 5.0;
        return group;
    }

    // 3. Heavy Cyber Tank
    buildTronTankMesh() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: 0x140602,
            roughness: 0.25,
            metalness: 0.85,
            emissive: 0x180400
        });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xff4400, linewidth: 2 });
        const neonOrange = new THREE.MeshBasicMaterial({ color: 0xff5500 });

        // Heavy Base Chassis
        const bodyGeom = new THREE.BoxGeometry(7.5, 2.5, 9.5);
        const body = new THREE.Mesh(bodyGeom, mat);
        body.position.y = 1.3;
        body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeom), edgeMat));
        group.add(body);

        // Neon Glowing Track Treads
        const treadGeom = new THREE.BoxGeometry(1.6, 2.0, 10.0);
        const leftTread = new THREE.Mesh(treadGeom, neonOrange);
        leftTread.position.set(-4.0, 1.0, 0);
        const rightTread = new THREE.Mesh(treadGeom, neonOrange);
        rightTread.position.set(4.0, 1.0, 0);
        group.add(leftTread);
        group.add(rightTread);

        // Rotating Turret Group
        const turretGroup = new THREE.Group();
        turretGroup.name = "turret";
        const turretGeom = new THREE.CylinderGeometry(2.2, 2.6, 2.0, 8);
        const turret = new THREE.Mesh(turretGeom, mat);
        turret.position.y = 3.0;
        turret.add(new THREE.LineSegments(new THREE.EdgesGeometry(turretGeom), edgeMat));
        turretGroup.add(turret);

        // Dual Heavy Railgun Barrels
        const barrelGeom = new THREE.CylinderGeometry(0.4, 0.4, 6.0, 8);
        barrelGeom.rotateX(Math.PI / 2);
        const barrelLeft = new THREE.Mesh(barrelGeom, neonOrange);
        barrelLeft.position.set(-1.0, 3.2, -4.5);
        const barrelRight = new THREE.Mesh(barrelGeom, neonOrange);
        barrelRight.position.set(1.0, 3.2, -4.5);
        turretGroup.add(barrelLeft);
        turretGroup.add(barrelRight);

        group.add(turretGroup);
        return group;
    }

    createTargetingLaserMesh() {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 3.2, 0),
            new THREE.Vector3(0, 3.2, -180)
        ]);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xff0044,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        return new THREE.Line(lineGeom, lineMat);
    }

    // 4. Iconic Flying Tron Recognizer (Boss)
    buildTronRecognizerMesh() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: 0x14020c,
            roughness: 0.15,
            metalness: 0.9,
            emissive: 0x220010
        });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 2 });
        const neonEye = new THREE.MeshBasicMaterial({ color: 0xff0055 });

        // Overhead Bridge
        const topGeom = new THREE.BoxGeometry(32, 5.5, 14);
        const top = new THREE.Mesh(topGeom, mat);
        top.add(new THREE.LineSegments(new THREE.EdgesGeometry(topGeom), edgeMat));
        group.add(top);

        // Left Leg Pylon
        const legGeom = new THREE.BoxGeometry(6.5, 20, 12);
        const leftLeg = new THREE.Mesh(legGeom, mat);
        leftLeg.position.set(-12.5, -10, 0);
        leftLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeom), edgeMat));
        group.add(leftLeg);

        // Right Leg Pylon
        const rightLeg = new THREE.Mesh(legGeom, mat);
        rightLeg.position.set(12.5, -10, 0);
        rightLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeom), edgeMat));
        group.add(rightLeg);

        // Heavy Pylon Pulse Cannons (Bottom of legs)
        const cannonGeom = new THREE.CylinderGeometry(0.9, 1.2, 5.5, 8);
        cannonGeom.rotateX(Math.PI / 2);
        const cannonMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const leftCannon = new THREE.Mesh(cannonGeom, cannonMat);
        leftCannon.name = "leftCannon";
        leftCannon.position.set(-12.5, -20.2, -4.5);
        group.add(leftCannon);

        const rightCannon = new THREE.Mesh(cannonGeom, cannonMat);
        rightCannon.name = "rightCannon";
        rightCannon.position.set(12.5, -20.2, -4.5);
        group.add(rightCannon);

        // Central Pulsating Core Reactor (Suspended beneath top bridge)
        const coreGeom = new THREE.OctahedronGeometry(3.5, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00aa, wireframe: false });
        const reactorCore = new THREE.Mesh(coreGeom, coreMat);
        reactorCore.name = "reactorCore";
        reactorCore.position.set(0, -6.5, 0);
        group.add(reactorCore);

        const coreRingGeom = new THREE.RingGeometry(4.2, 4.8, 16);
        coreRingGeom.rotateX(Math.PI / 2);
        const coreRing = new THREE.Mesh(coreRingGeom, new THREE.MeshBasicMaterial({
            color: 0xff00aa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        }));
        coreRing.name = "reactorRing";
        coreRing.position.set(0, -6.5, 0);
        group.add(coreRing);

        // Center Scanning Visor Eye
        const eyeGeom = new THREE.BoxGeometry(10, 2.5, 2.0);
        const eye = new THREE.Mesh(eyeGeom, neonEye);
        eye.name = "visorEye";
        eye.position.set(0, -1.0, -7.1);
        group.add(eye);

        // Downward Searchlight Pool (Projected circle on grid)
        const spotGeom = new THREE.RingGeometry(1.0, 16, 32);
        spotGeom.rotateX(-Math.PI / 2);
        const spotMat = new THREE.MeshBasicMaterial({
            color: 0xff0055,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4
        });
        const searchPool = new THREE.Mesh(spotGeom, spotMat);
        searchPool.name = "searchPool";
        searchPool.position.y = -13.9;
        group.add(searchPool);

        return group;
    }

    spawnPickup(type, spawnX = null, spawnZ = null) {
        let x, z;
        if (spawnX !== null && spawnZ !== null) {
            x = spawnX;
            z = spawnZ;
        } else {
            const dist = 60 + Math.random() * 100;
            const ang = Math.random() * Math.PI * 2;
            x = this.player.pos.x + Math.cos(ang) * dist;
            z = this.player.pos.z + Math.sin(ang) * dist;
        }

        let color = 0x00ffcc;
        if (type === 'shield') color = 0x0088ff;
        else if (type === 'overdrive') color = 0xff00ff;
        else if (type === 'tri_plasma') color = 0xffaa00;
        else if (type === 'nuke') color = 0xffff00;

        // 3D Pickup Mesh: Floating spinning crystal with glowing aura ring
        const group = new THREE.Group();
        const coreGeom = (type === 'tri_plasma') ? new THREE.TetrahedronGeometry(2.4, 0) : new THREE.OctahedronGeometry(2.2, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color });
        const core = new THREE.Mesh(coreGeom, coreMat);
        group.add(core);

        const ringGeom = new THREE.RingGeometry(2.6, 3.4, 16);
        ringGeom.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
        }));
        group.add(ring);

        group.position.set(x, 2.2, z);
        this.scene.add(group);

        this.pickups.push({
            type,
            x,
            z,
            radius: 14,
            pulse: 0,
            mesh: group,
            color
        });
    }

    spawnHazard() {
        const isHorizontal = Math.random() > 0.5;
        const pos = isHorizontal
            ? this.player.pos.z + (Math.random() - 0.5) * 120
            : this.player.pos.x + (Math.random() - 0.5) * 120;

        // 3D Hazard Wall
        const wallGeom = new THREE.BoxGeometry(
            isHorizontal ? 1200 : 2.5,
            12,
            isHorizontal ? 2.5 : 1200
        );
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0xff0055,
            transparent: true,
            opacity: 0.25,
            wireframe: true
        });
        const wallMesh = new THREE.Mesh(wallGeom, wallMat);
        wallMesh.position.set(
            isHorizontal ? this.player.pos.x : pos,
            6,
            isHorizontal ? pos : this.player.pos.z
        );
        this.scene.add(wallMesh);

        this.activeHazards.push({
            isHorizontal,
            pos,
            width: 4,
            warningTimer: 2.2,
            activeTimer: 3.5,
            mesh: wallMesh
        });
    }

    spawnFloatingText(text, x, z, color = '#00ffcc') {
        this.floatingTexts.push({
            text,
            x,
            z,
            life: 1.2,
            maxLife: 1.2,
            color
        });
    }

    /* --------------------------------------------------------------------- */
    /* ACTIONS & COMBAT LOGIC                                                */
    /* --------------------------------------------------------------------- */
    triggerQuantumBlink() {
        if (this.player.dashCharges <= 0 || this.player.isDashing) return;

        this.player.dashCharges--;
        this.player.isDashing = true;
        this.player.dashTimer = 0.22;
        this.player.invulnerableTimer = 0.35;

        // Thrust vector
        let moveX = 0;
        let moveZ = 0;
        if (this.keys['w'] || this.keys['arrowup']) moveZ -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

        if (moveX === 0 && moveZ === 0) {
            moveX = -Math.sin(this.player.angle);
            moveZ = -Math.cos(this.player.angle);
        } else {
            const mag = Math.hypot(moveX, moveZ);
            moveX /= mag;
            moveZ /= mag;
        }

        this.player.blinkOrigin = { x: this.player.pos.x, z: this.player.pos.z };
        const blinkDistance = 75;
        this.player.pos.x += moveX * blinkDistance;
        this.player.pos.z += moveZ * blinkDistance;

        this.player.isBlinking = true;
        this.player.blinkInvulnTimer = 0.55;
        this.player.wallHoppedThisBlink = false;

        // Voxel dash trail
        this.spawnVoxelExplosion(this.player.pos.x, this.player.pos.z, 0x00ffff, 20);
        this.spawnFloatingText("QUANTUM BLINK (HOP)", this.player.pos.x, this.player.pos.z, '#00ffff');
        if (window.audioManager) window.audioManager.playBlink();
    }

    firePlayerBullet() {
        if (this.player.isOverheated || this.player.fireCooldown > 0) return;

        const isOverdrive = this.player.overdriveTimer > 0;
        this.player.fireCooldown = isOverdrive ? 0.08 : 0.14;
        this.player.heat = Math.min(100, this.player.heat + (isOverdrive ? 2 : 6.5));

        if (this.player.heat >= 100) {
            this.player.isOverheated = true;
            this.spawnFloatingText("OVERHEATED!", this.player.pos.x, this.player.pos.z, '#ff0055');
        }

        // Projectile direction: forward in 3D ground plane (Local -Z is Forward)
        const dirX = -Math.sin(this.player.angle);
        const dirZ = -Math.cos(this.player.angle);
        const bulletSpeed = 290;

        // Twin forward wing cannons offset (mounted at local x = ±3.2, z = -2.8)
        const offsets = [-3.2, 3.2];
        offsets.forEach(off => {
            const rx = Math.cos(this.player.angle) * off;
            const rz = -Math.sin(this.player.angle) * off;
            const fx = -Math.sin(this.player.angle) * -3.6; // 3.6 units forward from center
            const fz = -Math.cos(this.player.angle) * -3.6;
            const bx = this.player.pos.x + rx + fx;
            const bz = this.player.pos.z + rz + fz;

            // 3D Bullet: Tron Identity Disc / Glowing Plasma bolt
            const bGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8);
            bGeom.rotateX(Math.PI / 2);
            const bMat = new THREE.MeshBasicMaterial({ color: isOverdrive ? 0xff00ff : 0x00ffff });
            const bMesh = new THREE.Mesh(bGeom, bMat);
            bMesh.position.set(bx, 2.2, bz);
            bMesh.rotation.y = this.player.angle;
            this.scene.add(bMesh);

            this.bullets.push({
                x: bx,
                z: bz,
                vx: dirX * bulletSpeed,
                vz: dirZ * bulletSpeed,
                damage: isOverdrive ? 45 : 28,
                life: 1.6,
                maxLife: 1.6,
                radius: 4,
                color: isOverdrive ? '#ff00ff' : '#00ffff',
                mesh: bMesh
            });
        });

        // Tri-Spread Cannon Fire (Active with Amber Powerup)
        if (this.player.triPlasmaTimer > 0) {
            [-0.22, 0.22].forEach(spread => {
                const sAngle = this.player.angle + spread;
                const sDirX = -Math.sin(sAngle);
                const sDirZ = -Math.cos(sAngle);
                const sbx = this.player.pos.x - Math.sin(this.player.angle) * -4.2;
                const sbz = this.player.pos.z - Math.cos(this.player.angle) * -4.2;

                const bGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8);
                bGeom.rotateX(Math.PI / 2);
                const bMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
                const bMesh = new THREE.Mesh(bGeom, bMat);
                bMesh.position.set(sbx, 2.2, sbz);
                bMesh.rotation.y = sAngle;
                this.scene.add(bMesh);

                this.bullets.push({
                    x: sbx,
                    z: sbz,
                    vx: sDirX * bulletSpeed,
                    vz: sDirZ * bulletSpeed,
                    damage: 28,
                    life: 1.5,
                    maxLife: 1.5,
                    radius: 4,
                    color: '#ffaa00',
                    mesh: bMesh
                });
            });
        }

        // Dynamic Muzzle Flash Light
        if (this.thrusterLight) {
            this.thrusterLight.intensity = 6.0;
        }

        if (window.audioManager) window.audioManager.playLaser();
    }

    throwIdentityDisc() {
        if (this.discCooldown > 0 || this.identityDisc.active) return;

        let dirX, dirZ;
        if (this.aimPoint && Math.hypot(this.aimPoint.x - this.player.pos.x, this.aimPoint.z - this.player.pos.z) > 5) {
            const dx = this.aimPoint.x - this.player.pos.x;
            const dz = this.aimPoint.z - this.player.pos.z;
            const len = Math.hypot(dx, dz) || 1;
            dirX = dx / len;
            dirZ = dz / len;
        } else {
            dirX = -Math.sin(this.player.angle);
            dirZ = -Math.cos(this.player.angle);
        }

        this.identityDisc.active = true;
        this.identityDisc.returning = false;
        this.identityDisc.bounces = 0;
        this.identityDisc.lifespan = this.identityDisc.maxLifespan;
        this.identityDisc.x = this.player.pos.x + dirX * 6.0;
        this.identityDisc.z = this.player.pos.z + dirZ * 6.0;
        this.identityDisc.vx = dirX * this.identityDisc.speed;
        this.identityDisc.vz = dirZ * this.identityDisc.speed;

        if (this.identityDisc.mesh) {
            this.identityDisc.mesh.visible = true;
            this.identityDisc.mesh.position.set(this.identityDisc.x, 2.4, this.identityDisc.z);
        }

        this.discCooldown = this.maxDiscCooldown;
        this.spawnFloatingText("IDENTITY DISC!", this.identityDisc.x, this.identityDisc.z, '#ffaa00');
        this.spawnVoxelExplosion(this.identityDisc.x, this.identityDisc.z, 0x00ffff, 14);

        if (window.audioManager && window.audioManager.playDiscThrow) {
            window.audioManager.playDiscThrow();
        }
    }

    fireBossBullet(originX, originZ, dirX, dirZ, bulletSpeed = 165, damage = 26, colorHex = 0xff00aa) {
        const bulletGroup = new THREE.Group();

        // Inner Core
        const coreGeom = new THREE.SphereGeometry(1.8, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        bulletGroup.add(new THREE.Mesh(coreGeom, coreMat));

        // Outer Aura
        const auraGeom = new THREE.SphereGeometry(3.2, 12, 12);
        const auraMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        bulletGroup.add(new THREE.Mesh(auraGeom, auraMat));

        bulletGroup.position.set(originX, 2.2, originZ);
        this.scene.add(bulletGroup);

        this.enemyBullets.push({
            x: originX,
            z: originZ,
            vx: dirX * bulletSpeed,
            vz: dirZ * bulletSpeed,
            damage,
            life: 2.8,
            maxLife: 2.8,
            radius: 6.5,
            color: colorHex === 0xff5500 ? '#ff5500' : '#ff00aa',
            mesh: bulletGroup
        });
    }

    fireBossPylonVolley(e) {
        e.cannonSide = -e.cannonSide;
        const pylonOffset = 12.5 * e.cannonSide;
        // Calculate perpendicular offset in world coordinates
        const perpX = Math.cos(e.angle) * pylonOffset;
        const perpZ = -Math.sin(e.angle) * pylonOffset;
        const ox = e.x + perpX;
        const oz = e.z + perpZ;

        const dx = this.player.pos.x - ox;
        const dz = this.player.pos.z - oz;
        const dist = Math.hypot(dx, dz) || 1;

        this.fireBossBullet(ox, oz, dx / dist, dz / dist, 175, 28, 0xff00aa);
        if (window.audioManager && window.audioManager.playHeavyLaser) {
            window.audioManager.playHeavyLaser();
        }
    }

    fireBossGridSweep(e) {
        const boltCount = 12;
        for (let i = 0; i < boltCount; i++) {
            const ang = (i / boltCount) * Math.PI * 2;
            const dirX = Math.cos(ang);
            const dirZ = Math.sin(ang);
            this.fireBossBullet(e.x, e.z, dirX, dirZ, 115, 22, 0xff5500);
        }
        this.spawnShockwave(e.x, e.z);
        if (window.audioManager && window.audioManager.playShockwave) {
            window.audioManager.playShockwave();
        }
    }

    fireBossOverloadVolley(e) {
        const baseAngle = Math.atan2(this.player.pos.x - e.x, this.player.pos.z - e.z);
        [-0.24, 0, 0.24].forEach(spread => {
            const a = baseAngle + spread;
            const dirX = Math.sin(a);
            const dirZ = Math.cos(a);
            this.fireBossBullet(e.x, e.z, dirX, dirZ, 195, 30, 0xff0022);
        });
        if (window.audioManager && window.audioManager.playHeavyLaser) {
            window.audioManager.playHeavyLaser();
        }
    }

    fireEnemyBullet(e) {
        if (e.type === 'boss') {
            if (e.bossPhase === 3) {
                this.fireBossOverloadVolley(e);
            } else {
                this.fireBossPylonVolley(e);
            }
            return;
        }

        const dx = this.player.pos.x - e.x;
        const dz = this.player.pos.z - e.z;
        const dist = Math.hypot(dx, dz) || 1;
        const dirX = dx / dist;
        const dirZ = dz / dist;
        const bulletSpeed = (e.type === 'heavy') ? 135 : 155;

        // 3D Enemy Projectile Mesh: Blazing Tron Plasma Bolt with additive neon halo
        const bulletGroup = new THREE.Group();
        const coreColor = 0xffffff;
        const auraColor = (e.type === 'heavy') ? 0xff4400 : 0xff0055;

        // Intense inner core
        const coreGeom = new THREE.SphereGeometry(1.4, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: coreColor });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        bulletGroup.add(coreMesh);

        // Blazing outer glow sphere
        const auraGeom = new THREE.SphereGeometry(2.4, 12, 12);
        const auraMat = new THREE.MeshBasicMaterial({
            color: auraColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const auraMesh = new THREE.Mesh(auraGeom, auraMat);
        bulletGroup.add(auraMesh);

        bulletGroup.position.set(e.x, 2.0, e.z);
        this.scene.add(bulletGroup);

        this.enemyBullets.push({
            x: e.x,
            z: e.z,
            vx: dirX * bulletSpeed,
            vz: dirZ * bulletSpeed,
            damage: (e.type === 'heavy') ? 22 : 12,
            life: 2.4,
            maxLife: 2.4,
            radius: 5,
            color: (e.type === 'heavy') ? '#ff4400' : '#ff0055',
            mesh: bulletGroup
        });
    }

    spawnVoxelExplosion(x, z, colorHex, count = 24) {
        // 1. 3D Voxel debris shards
        for (let i = 0; i < count; i++) {
            const size = 0.5 + Math.random() * 1.2;
            const geom = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: Math.random() > 0.4 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(x, 2.0 + Math.random() * 2.0, z);
            this.scene.add(mesh);

            const ang = Math.random() * Math.PI * 2;
            const speed = 25 + Math.random() * 60;
            this.voxelParticles3d.push({
                mesh,
                vx: Math.cos(ang) * speed,
                vy: 12 + Math.random() * 25,
                vz: Math.sin(ang) * speed,
                rotX: (Math.random() - 0.5) * 12,
                rotY: (Math.random() - 0.5) * 12,
                life: 0.8 + Math.random() * 0.5,
                maxLife: 1.3
            });
        }

        // 2. 2D Vector particles for 2D mode
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 120;
            this.particles2d.push({
                x,
                y: z,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: 2 + Math.random() * 3,
                color: (typeof colorHex === 'number') ? '#' + colorHex.toString(16).padStart(6, '0') : colorHex,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0
            });
        }
    }

    damagePlayer(amount) {
        if (this.player.invulnerableTimer > 0 || this.isGameOver) return;

        // Apply 450ms invulnerability frames against incoming volleys and contact spikes
        this.player.invulnerableTimer = 0.45;
        this.player.lastDamageTime = performance.now();
        this.screenShake = 16;
        this.player.shieldHitFlash = 1.0;

        if (this.player.shield > 0) {
            const absorbed = Math.min(this.player.shield, amount);
            this.player.shield -= absorbed;
            amount -= absorbed;
            if (this.player.shield <= 0) {
                this.spawnFloatingText("SHIELD DEPLETED!", this.player.pos.x, this.player.pos.z, '#00a2ff');
            }
        }

        if (amount > 0) {
            this.player.hp = Math.max(0, this.player.hp - amount);
            this.spawnFloatingText(`-${Math.round(amount)} HP`, this.player.pos.x, this.player.pos.z, '#ff0055');
            if (window.audioManager) window.audioManager.playExplosion();
        }

        if (this.player.hp <= 0) {
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.spawnVoxelExplosion(this.player.pos.x, this.player.pos.z, 0x00ffff, 48);

        const modal = document.getElementById('game-over-modal');
        const fWave = document.getElementById('final-wave');
        const fScore = document.getElementById('final-score');
        if (fWave) fWave.innerText = this.wave;
        if (fScore) fScore.innerText = this.score;
        if (modal) modal.classList.add('active');

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_high_score', this.score.toString());
        }
    }

    restartGame() {
        const modal = document.getElementById('game-over-modal');
        if (modal) modal.classList.remove('active');

        // Clean existing entities in 3D scene
        this.enemies.forEach(e => {
            if (e.mesh) this.scene.remove(e.mesh);
            if (e.trailMesh) this.scene.remove(e.trailMesh);
            if (e.targetingLaser) this.scene.remove(e.targetingLaser);
        });
        this.bullets.forEach(b => { if (b.mesh) this.scene.remove(b.mesh); });
        this.enemyBullets.forEach(b => { if (b.mesh) this.scene.remove(b.mesh); });
        this.pickups.forEach(p => { if (p.mesh) this.scene.remove(p.mesh); });
        this.activeHazards.forEach(h => { if (h.mesh) this.scene.remove(h.mesh); });
        this.voxelParticles3d.forEach(p => { if (p.mesh) this.scene.remove(p.mesh); });

        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.pickups = [];
        this.activeHazards = [];
        this.voxelParticles3d = [];
        this.particles2d = [];
        this.floatingTexts = [];
        this.mines.forEach(m => { if (m.mesh) this.scene.remove(m.mesh); });
        this.mines = [];
        this.mineCooldown = 0;
        this.isLookingBack = false;

        const lookbackBanner = document.getElementById('lookback-banner');
        if (lookbackBanner) lookbackBanner.style.display = 'none';
        const threatBanner = document.getElementById('rear-threat-warning');
        if (threatBanner) threatBanner.style.display = 'none';

        this.player.pos.set(0, 0, 0);
        this.player.vel.set(0, 0, 0);
        this.player.hp = 100;
        this.player.shield = 100;
        this.player.dashCharges = 2;
        this.player.heat = 0;
        this.player.isOverheated = false;
        this.player.trailPoints = [];
        this.player.invulnerableTimer = 2.5; // Overcharge grace period on respawn
        this.score = 0;
        this.isGameOver = false;

        this.startWave(1);
    }

    /* --------------------------------------------------------------------- */
    /* SIMULATION UPDATE LOOP                                                */
    /* --------------------------------------------------------------------- */
    gameLoop(timestamp) {
        let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        // Temporal Dilation Bullet-Time Finishing Slow-Mo
        if (this.timeDilationTimer > 0) {
            this.timeDilationTimer -= dt;
            dt *= this.timeDilation;
            if (this.timeDilationTimer <= 0) {
                this.timeDilation = 1.0;
            }
        }

        if (!this.isGameOver) {
            this.updateSimulation(dt);
        }

        // Render according to active view mode
        if (this.renderMode === '3d') {
            this.render3D(dt);
            this.updateRearThreatDetection(dt);
            this.renderRearviewMirror();
        } else {
            this.render2D(dt);
            this.updateRearThreatDetection(dt);
        }

        this.renderRadar();
        this.updateHUD();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    updateSimulation(dt) {
        // Style Combo Decay
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.comboMultiplier = 1.0;
                this.comboRank = 'CYBER';
            }
        }

        // Timers
        this.directorTimer += dt;
        if (this.directorTimer >= this.directorCooldown) {
            this.directorTimer = 0;
            this.queryDirector();
        }

        this.enemyDecisionTimer += dt;
        if (this.enemyDecisionTimer >= 0.8) {
            this.enemyDecisionTimer = 0;
            this.queryEnemyTactics();
        }

        if (this.autoPilot) {
            this.botDecisionTimer += dt;
            if (this.botDecisionTimer >= 0.25) {
                this.botDecisionTimer = 0;
                this.queryBotAutopilot();
            }
        }

        // Player Controls (Manual or Autopilot)
        this.updatePlayerMovement(dt);

        // Procedural Grid World & Energy Gates
        if (this.renderMode === '3d' && this.updateProceduralGridWorld) {
            this.updateProceduralGridWorld(dt);
        }

        // Player Weapon & Heat
        if (this.player.fireCooldown > 0) this.player.fireCooldown -= dt;
        if (this.player.heat > 0) {
            this.player.heat = Math.max(0, this.player.heat - dt * 32);
            if (this.player.heat < 30) this.player.isOverheated = false;
        }
        if (this.player.overdriveTimer > 0) this.player.overdriveTimer -= dt;
        if (this.player.invulnerableTimer > 0) this.player.invulnerableTimer -= dt;
        if (this.player.speedBoostTimer > 0) this.player.speedBoostTimer = Math.max(0, this.player.speedBoostTimer - dt);
        if (this.discCooldown > 0) this.discCooldown = Math.max(0, this.discCooldown - dt);
        if (this.player.triPlasmaTimer > 0) this.player.triPlasmaTimer = Math.max(0, this.player.triPlasmaTimer - dt);
        if (this.player.dashTimer > 0) {
            this.player.dashTimer = Math.max(0, this.player.dashTimer - dt);
            if (this.player.dashTimer <= 0) {
                this.player.isDashing = false;
            }
        }
        if (this.player.blinkInvulnTimer > 0) {
            this.player.blinkInvulnTimer = Math.max(0, this.player.blinkInvulnTimer - dt);
        } else {
            this.player.isBlinking = false;
        }

        // Shield Recharge
        if (performance.now() - this.player.lastDamageTime > 3500 && this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + dt * 24);
        }
        if (this.player.shieldHitFlash > 0) {
            this.player.shieldHitFlash = Math.max(0, this.player.shieldHitFlash - dt * 3.5);
        }

        // Dash Recharge
        if (this.player.dashCharges < this.player.maxDashCharges) {
            this.player.dashRechargeTimer += dt;
            if (this.player.dashRechargeTimer >= 3.0) {
                this.player.dashCharges++;
                this.player.dashRechargeTimer = 0;
            }
        }

        // Shooting Trigger
        if ((this.isMouseDown || (this.autoPilot && this.botIntent.fire)) && this.player.fireCooldown <= 0) {
            this.firePlayerBullet();
        }

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.z += b.vz * dt;
            b.life -= dt;
            if (b.mesh) {
                b.mesh.position.set(b.x, 2.2, b.z);
            }

            // Bullet - Enemy Collisions
            let hit = false;
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const dist = Math.hypot(b.x - e.x, b.z - e.z);
                if (dist < e.radius + b.radius) {
                    e.hp -= b.damage;
                    this.spawnFloatingText(`-${b.damage}`, e.x, e.z, '#00ffcc');
                    this.spawnVoxelExplosion(e.x, e.z, e.color, 6);
                    hit = true;

                    if (e.hp <= 0) {
                        this.destroyEnemy(j);
                    }
                    break;
                }
            }

            if (hit || b.life <= 0) {
                if (b.mesh) this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.x += b.vx * dt;
            b.z += b.vz * dt;
            b.life -= dt;
            if (b.mesh) b.mesh.position.set(b.x, 2.0, b.z);

            const dist = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z);
            if (dist < b.radius + 5.0) {
                this.damagePlayer(b.damage);
                if (b.mesh) this.scene.remove(b.mesh);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (b.life <= 0) {
                if (b.mesh) this.scene.remove(b.mesh);
                this.enemyBullets.splice(i, 1);
            }
        }

        // Update Enemies
        this.updateEnemies(dt);

        // Update Pickups
        this.updatePickups(dt);

        // Update Hazards
        this.updateHazards(dt);

        // Update EMP Mines
        this.updateMines(dt);

        // Update Identity Disc
        this.updateIdentityDisc(dt);

        // Check Lethal Light-Ribbon Walls
        this.checkLightRibbonCollisions(dt);

        // Update Arena Grid Shockwaves
        this.updateShockwaves(dt);

        // Update JEV Holographic Tactical Copilot
        if (this.renderMode === '3d') {
            this.updateCopilot(dt);
        }

        // Update 3D Voxel Particles
        for (let i = this.voxelParticles3d.length - 1; i >= 0; i--) {
            const p = this.voxelParticles3d[i];
            p.life -= dt;
            p.vy -= 45 * dt; // gravity
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y = Math.max(0.2, p.mesh.position.y + p.vy * dt);
            p.mesh.position.z += p.vz * dt;
            p.mesh.rotation.x += p.rotX * dt;
            p.mesh.rotation.y += p.rotY * dt;

            const progress = p.life / p.maxLife;
            p.mesh.scale.set(progress, progress, progress);

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.voxelParticles3d.splice(i, 1);
            }
        }

        // Update 2D Particles
        for (let i = this.particles2d.length - 1; i >= 0; i--) {
            const p = this.particles2d[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) this.particles2d.splice(i, 1);
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.life -= dt;
            t.z -= 15 * dt; // float upward in world space
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Screen shake decay
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 28);
        }

        // Check wave completion
        if (this.enemies.length === 0) {
            this.startWave(this.wave + 1);
        }
    }

    updatePlayerMovement(dt) {
        let moveX = 0;
        let moveZ = 0;

        if (this.autoPilot) {
            // JEV Autopilot Steering
            let nearestEnemy = null;
            let nearestDist = 9999;
            this.enemies.forEach(e => {
                const d = Math.hypot(this.player.pos.x - e.x, this.player.pos.z - e.z);
                if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
            });

            if (nearestEnemy) {
                const toX = nearestEnemy.x - this.player.pos.x;
                const toZ = nearestEnemy.z - this.player.pos.z;
                const dist = Math.hypot(toX, toZ) || 1;
                const ndx = toX / dist;
                const ndz = toZ / dist;

                // Aim directly at nearest enemy (Local -Z is Forward)
                this.player.targetAngle = Math.atan2(-toX, -toZ);

                if (this.botIntent.nav === 'circle_strafe_cw') {
                    moveX = ndz; moveZ = -ndx;
                } else if (this.botIntent.nav === 'circle_strafe_ccw') {
                    moveX = -ndz; moveZ = ndx;
                } else if (this.botIntent.nav === 'retreat_open_space') {
                    moveX = -ndx; moveZ = -ndz;
                } else if (this.botIntent.nav === 'direct_charge') {
                    moveX = ndx; moveZ = ndz;
                }
            }
        } else {
            if (this.renderMode === '3d' && this.cameraMode === 'cockpit') {
                // Continuous yaw rate based on mouse offset from center
                const cx = (this.container.clientWidth || (window.innerWidth - 370)) / 2;
                const mouseDeltaX = (this.mouseScreen.x - cx) / cx;
                if (Math.abs(mouseDeltaX) > 0.04) {
                    this.player.targetAngle -= mouseDeltaX * 3.2 * dt;
                }

                // Keyboard yaw steering
                if (this.keys['arrowleft'] || this.keys['q']) this.player.targetAngle += 2.6 * dt;
                if (this.keys['arrowright']) this.player.targetAngle -= 2.6 * dt;

                // Heading-relative flight: W accelerates forward, S brakes/reverses, A/D strafes
                const fx = -Math.sin(this.player.angle);
                const fz = -Math.cos(this.player.angle);
                const sx = Math.cos(this.player.angle);
                const sz = -Math.sin(this.player.angle);

                if (this.keys['w'] || this.keys['arrowup']) {
                    moveX += fx;
                    moveZ += fz;
                }
                if (this.keys['s'] || this.keys['arrowdown']) {
                    moveX -= fx * 0.6;
                    moveZ -= fz * 0.6;
                }
                if (this.keys['a']) {
                    moveX -= sx * 0.85;
                    moveZ -= sz * 0.85;
                }
                if (this.keys['d']) {
                    moveX += sx * 0.85;
                    moveZ += sz * 0.85;
                }
            } else {
                // 2D Classic Retro Top-Down Arena & 3D Chase mode
                if (this.keys['w'] || this.keys['arrowup']) moveZ -= 1;
                if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1;
                if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
                if (this.keys['d'] || this.keys['arrowright']) moveX += 1;
            }

            if (moveX !== 0 || moveZ !== 0) {
                const mag = Math.hypot(moveX, moveZ);
                moveX /= mag;
                moveZ /= mag;
            }
        }

        // Acceleration & Damping
        let accel = 650;
        if (this.player.speedBoostTimer > 0) {
            accel *= 1.35; // +35% Warp Speed Surge
        }
        const friction = 0.88;
        this.player.vel.x += moveX * accel * dt;
        this.player.vel.z += moveZ * accel * dt;
        this.player.vel.multiplyScalar(friction);

        // Position Integration
        this.player.pos.x += this.player.vel.x * dt;
        this.player.pos.z += this.player.vel.z * dt;

        // Phase 6: Arena Perimeter Forcefield Containment (Keeps dogfight inside illuminated ring)
        const pDist = Math.hypot(this.player.pos.x, this.player.pos.z);
        if (pDist > 265) {
            const nx = this.player.pos.x / pDist;
            const nz = this.player.pos.z / pDist;
            this.player.pos.x = nx * 265;
            this.player.pos.z = nz * 265;
            const dot = this.player.vel.x * nx + this.player.vel.z * nz;
            if (dot > 0) {
                this.player.vel.x -= nx * dot * 1.4;
                this.player.vel.z -= nz * dot * 1.4;
            }
            if (this.forcefieldWall) {
                this.forcefieldWall.material.opacity = 0.45;
            }
        }

        // Smooth angle slerp
        let diff = this.player.targetAngle - this.player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.player.angle += diff * Math.min(1.0, dt * 14);

        // Dynamic Banking (Roll into turns)
        const targetBank = -diff * 1.8;
        this.player.bankAngle += (targetBank - this.player.bankAngle) * Math.min(1.0, dt * 10);
        this.player.bankAngle = Math.max(-0.6, Math.min(0.6, this.player.bankAngle));

        // Player Light Ribbon Point History - Attached strictly to rear thruster nozzles (+Z wake)
        const tx = this.player.pos.x + Math.sin(this.player.angle) * 4.0;
        const tz = this.player.pos.z + Math.cos(this.player.angle) * 4.0;
        this.player.trailPoints.unshift(new THREE.Vector3(tx, 2.2, tz));
        if (this.player.trailPoints.length > this.player.maxTrailPoints) {
            this.player.trailPoints.pop();
        }
    }

    updateEnemies(dt) {
        this.enemies.forEach(e => {
            const dx = this.player.pos.x - e.x;
            const dz = this.player.pos.z - e.z;
            const dist = Math.hypot(dx, dz) || 1;
            const ndx = dx / dist;
            const ndz = dz / dist;

            // Tactical Movement Direction
            let targetMoveX = ndx;
            let targetMoveZ = ndz;

            if (e.tactic === 'flank_left') {
                targetMoveX = ndz * 0.75 + ndx * 0.25;
                targetMoveZ = -ndx * 0.75 + ndz * 0.25;
            } else if (e.tactic === 'flank_right') {
                targetMoveX = -ndz * 0.75 + ndx * 0.25;
                targetMoveZ = ndx * 0.75 + ndz * 0.25;
            } else if (e.tactic === 'circle_strafe') {
                targetMoveX = ndz;
                targetMoveZ = -ndx;
            }

            const moveMag = Math.hypot(targetMoveX, targetMoveZ) || 1;
            targetMoveX /= moveMag;
            targetMoveZ /= moveMag;

            // Target Yaw Angle for enemy (local -Z is forward in 3D Three.js)
            const desiredAngle = Math.atan2(-targetMoveX, -targetMoveZ);

            // Human-Balanced Speed & Agility System
            let currentSpeed = e.speed;
            let turnRate = e.turnSpeed || 2.2;

            if (e.type === 'stalker') {
                e.chargeTimer = (e.chargeTimer || 2.0) - dt;

                if (!e.chargeState || e.chargeState === 'cruise') {
                    currentSpeed = e.speed; // Balanced cruise speed ~78
                    turnRate = 2.5; // Finite turn radius

                    // Angle difference facing player
                    let facingDiff = Math.atan2(-ndx, -ndz) - e.angle;
                    while (facingDiff < -Math.PI) facingDiff += Math.PI * 2;
                    while (facingDiff > Math.PI) facingDiff -= Math.PI * 2;

                    // Trigger charge only when roughly aligned and within 250m
                    if (e.chargeTimer <= 0 && dist < 250 && Math.abs(facingDiff) < 0.7) {
                        e.chargeState = 'telegraph';
                        e.chargeTimer = 0.6; // 600ms reaction telegraph window!
                        this.spawnFloatingText("⚠️ CHARGE", e.x, e.z, '#ffaa00');
                    }
                } else if (e.chargeState === 'telegraph') {
                    // Pre-attack telegraph: slow down, rev up, jitter
                    currentSpeed = e.speed * 0.4;
                    turnRate = 0.9;
                    if (e.mesh) {
                        e.mesh.rotation.z = (Math.random() - 0.5) * 0.18;
                    }

                    if (e.chargeTimer <= 0) {
                        e.chargeState = 'charging';
                        e.chargeTimer = 1.1; // Sprint for 1.1s
                        if (e.mesh) e.mesh.rotation.z = 0;
                        if (window.audioManager) window.audioManager.playAlert();
                    }
                } else if (e.chargeState === 'charging') {
                    // Straight-line dash with heavy inertia
                    currentSpeed = 135;
                    turnRate = 0.7;

                    if (e.chargeTimer <= 0) {
                        e.chargeState = 'recovery';
                        e.chargeTimer = 0.85; // Recovery overshoot window
                    }
                } else if (e.chargeState === 'recovery') {
                    // Overshot! Decelerate so player has a clear counter-attack window
                    currentSpeed = 38;
                    turnRate = 1.2;

                    if (e.chargeTimer <= 0) {
                        e.chargeState = 'cruise';
                        e.chargeTimer = 2.5 + Math.random() * 2.0; // Cooldown before next charge
                    }
                }
            } else if (e.type === 'drone') {
                currentSpeed = e.speed;
                turnRate = 1.8;
            } else if (e.type === 'heavy') {
                currentSpeed = e.speed;
                turnRate = 0.9;
            } else if (e.type === 'boss') {
                const hpRatio = e.hp / e.maxHp;
                e.bossPhase = (hpRatio > 0.66) ? 1 : ((hpRatio > 0.33) ? 2 : 3);

                if (e.bossPhase === 3) {
                    currentSpeed = 74;
                    turnRate = 0.85;

                    // Phase 3: Deploy Escort Drones once
                    if (!e.hasSpawnedEscorts) {
                        e.hasSpawnedEscorts = true;
                        this.spawnEnemy('drone');
                        this.spawnEnemy('drone');
                        if (window.audioManager && window.audioManager.playBossWarning) {
                            window.audioManager.playBossWarning();
                        }
                        this.spawnFloatingText('CORE OVERLOAD: ESCORT DRONES DEPLOYED!', e.x, e.z, '#ff0055');
                    }
                } else if (e.bossPhase === 2) {
                    currentSpeed = 58;
                    turnRate = 0.65;
                } else {
                    currentSpeed = e.speed;
                    turnRate = 0.55;
                }
            }

            if (e.isBerserk) {
                currentSpeed *= 1.25;
            }

            // Angular Inertia: Smoothly steer toward desiredAngle at finite turnRate
            let diff = desiredAngle - e.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            const maxTurn = turnRate * dt;
            const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, diff));
            e.angle += actualTurn;

            // Move strictly along current craft heading (Local -Z is Forward)
            const fwdX = -Math.sin(e.angle);
            const fwdZ = -Math.cos(e.angle);
            e.x += fwdX * currentSpeed * dt;
            e.z += fwdZ * currentSpeed * dt;

            // Update Stalker Light Trail Points - Connected strictly to rear wheel stern (+Z)
            if (e.type === 'stalker') {
                const rx = e.x + Math.sin(e.angle) * 3.4;
                const rz = e.z + Math.cos(e.angle) * 3.4;
                e.trailPoints.unshift(new THREE.Vector3(rx, 1.8, rz));
                if (e.trailPoints.length > 45) e.trailPoints.pop();
            }

            // Shooting & Boss Attack Patterns
            if (e.type === 'boss') {
                e.shootTimer -= dt;
                if (e.shootTimer <= 0) {
                    e.shootTimer = (e.bossPhase === 3) ? 1.3 : 1.6;
                    this.fireEnemyBullet(e);
                }

                // Phase 2 & 3: 360° Grid Sweep Radial Barrage
                if (e.bossPhase >= 2) {
                    e.gridSweepTimer -= dt;
                    if (e.gridSweepTimer <= 0.8 && !e.isChargingSweep) {
                        e.isChargingSweep = true;
                        if (window.audioManager && window.audioManager.playBossCharge) {
                            window.audioManager.playBossCharge();
                        }
                        this.spawnFloatingText('⚠ GRID SWEEP CHARGING ⚠', e.x, e.z, '#ffaa00');
                    }

                    if (e.gridSweepTimer <= 0) {
                        e.isChargingSweep = false;
                        e.gridSweepTimer = (e.bossPhase === 3) ? 3.8 : 4.6;
                        this.fireBossGridSweep(e);
                        this.spawnFloatingText('GRID SWEEP BARRAGE!', e.x, e.z, '#ff0055');
                    }
                }
            } else {
                e.shootTimer -= dt;
                if (e.shootTimer <= 0) {
                    e.shootTimer = (e.type === 'heavy') ? 2.5 : 1.8 + Math.random();
                    this.fireEnemyBullet(e);
                }
            }

            // Heavy Tank Targeting Laser Sweeping & Fire Telegraph
            if (e.type === 'heavy' && e.targetingLaser && e.mesh) {
                const turret = e.mesh.getObjectByName("turret");
                if (turret) {
                    turret.rotation.y = Math.atan2(-dx, -dz) - e.angle;
                }
                e.targetingLaser.position.set(e.x, 3.2, e.z);
                e.targetingLaser.rotation.y = Math.atan2(-dx, -dz);
                // Warning flare 0.6s before firing
                if (e.targetingLaser.material) {
                    e.targetingLaser.material.color.setHex(e.shootTimer < 0.6 ? 0xff0000 : 0xff6600);
                    e.targetingLaser.material.opacity = e.shootTimer < 0.6 ? 0.95 : 0.45;
                }
            }

            // Recognizer Boss Visual Animations
            if (e.type === 'boss' && e.mesh) {
                const pool = e.mesh.getObjectByName("searchPool");
                if (pool) {
                    pool.position.x = Math.sin(performance.now() * 0.002) * 12;
                    pool.position.z = Math.cos(performance.now() * 0.002) * 12;
                    if (pool.material) {
                        pool.material.color.setHex(e.isChargingSweep ? 0xff5500 : (e.bossPhase === 3 ? 0xff0022 : 0xff00aa));
                    }
                }

                const reactor = e.mesh.getObjectByName("reactorCore");
                if (reactor) {
                    reactor.rotation.y += dt * (e.bossPhase === 3 ? 5.0 : 2.5);
                    if (reactor.material) {
                        reactor.material.color.setHex(e.bossPhase === 3 ? 0xff0022 : (e.bossPhase === 2 ? 0xff5500 : 0xff00aa));
                    }
                }

                const ring = e.mesh.getObjectByName("reactorRing");
                if (ring) {
                    ring.rotation.z += dt * (e.bossPhase === 3 ? 6.0 : 3.0);
                }

                const eye = e.mesh.getObjectByName("visorEye");
                if (eye && eye.material) {
                    eye.material.color.setHex(e.isChargingSweep ? 0xffaa00 : (e.bossPhase === 3 ? 0xff0000 : 0xff0055));
                }
            }

            // Ramming Damage & Kinetic Overdrive Shield Physics
            if (dist < e.radius + 8) {
                if (this.player.overdriveTimer > 0) {
                    // KINETIC OVERDRIVE RAMMING: Obliterate enemy without taking damage!
                    this.destroyEnemy(e);
                    this.spawnShockwave(e.x, e.z);
                    if (window.audioManager && window.audioManager.playRamImpact) {
                        window.audioManager.playRamImpact();
                    }
                    this.registerComboAction(200, 'ram');
                    this.spawnFloatingText('KINETIC RAM DEREZ! +200 PTS', e.x, e.z, '#ff00ff');
                    return;
                }

                if (this.player.invulnerableTimer <= 0) {
                    this.damagePlayer(e.isBerserk ? 20 : 12);
                }

                // Elastic knockback separation impulse to prevent sticky overlapping damage
                const overlap = (e.radius + 12) - dist;
                e.x -= ndx * (overlap + 15);
                e.z -= ndz * (overlap + 15);
                this.player.vel.x += ndx * 50;
                this.player.vel.z += ndz * 50;
            }
        });
    }

    registerComboAction(points, source = 'cannon') {
        const bonus = (source === 'ribbon') ? 3 : ((source === 'disc') ? 2 : 1);
        this.combo += bonus;
        this.comboTimer = this.maxComboTimer;

        // Calculate Multiplier Tier
        let newMult = 1.0;
        let newRank = 'CYBER';
        let tier = 1;

        if (this.combo >= 15) {
            newMult = 4.0;
            newRank = 'MASTER CONTROL';
            tier = 5;
        } else if (this.combo >= 10) {
            newMult = 3.0;
            newRank = 'GODSPEED';
            tier = 4;
        } else if (this.combo >= 6) {
            newMult = 2.0;
            newRank = 'HYPERDRIVE';
            tier = 3;
        } else if (this.combo >= 3) {
            newMult = 1.5;
            newRank = 'OVERCLOCK';
            tier = 2;
        }

        if (newMult > this.comboMultiplier) {
            this.comboMultiplier = newMult;
            this.comboRank = newRank;
            if (window.audioManager && window.audioManager.playComboUp) {
                window.audioManager.playComboUp(tier);
            }
            this.spawnFloatingText(`x${newMult.toFixed(1)} ${newRank}!`, this.player.pos.x, this.player.pos.z - 20, '#ff00aa');
        } else {
            this.comboMultiplier = newMult;
            this.comboRank = newRank;
        }
    }

    destroyEnemy(target) {
        const idx = (typeof target === 'number') ? target : this.enemies.indexOf(target);
        if (idx < 0 || idx >= this.enemies.length) return;
        const e = this.enemies[idx];

        const isBoss = (e.type === 'boss');
        const baseScore = isBoss ? 2500 : (e.type === 'heavy' ? 200 : 75);
        const earnedScore = Math.round(baseScore * this.comboMultiplier);
        this.score += earnedScore;
        this.enemiesDefeated++;

        if (isBoss) {
            // EPIC BOSS FINISHING BLOW: Temporal dilation slow-motion + super explosion
            this.timeDilation = 0.22;
            this.timeDilationTimer = 0.45;
            this.spawnVoxelExplosion(e.x, e.z, 0xff00aa, 120);
            this.spawnShockwave(e.x, e.z);
            this.spawnShockwave(e.x + 8, e.z + 8);
            this.spawnFloatingText(`+${earnedScore} PTS: COMMAND RECOGNIZER DEREZZED!`, e.x, e.z, '#ff00aa');

            // Guaranteed full suite of power-ups dropped
            this.spawnPickup('shield', e.x - 18, e.z);
            this.spawnPickup('tri_plasma', e.x + 18, e.z);
            this.spawnPickup('overdrive', e.x, e.z + 18);

            if (window.audioManager && window.audioManager.playDerez) {
                window.audioManager.playDerez();
            }
        } else {
            this.registerComboAction(earnedScore, e.type);
            this.spawnVoxelExplosion(e.x, e.z, e.color, e.type === 'heavy' ? 42 : 24);
            this.spawnFloatingText(`+${earnedScore} PTS`, e.x, e.z, '#ffff00');

            // Drop Bit Data-Cores
            const dropChance = (e.type === 'heavy') ? 1.0 : 0.45;
            if (Math.random() < dropChance) {
                const roll = Math.random();
                const pType = (roll < 0.38) ? 'shield' : (roll < 0.76 ? 'tri_plasma' : 'overdrive');
                this.spawnPickup(pType, e.x, e.z);
            }
        }

        if (e.mesh) this.scene.remove(e.mesh);
        if (e.trailMesh) this.scene.remove(e.trailMesh);
        if (e.targetingLaser) this.scene.remove(e.targetingLaser);

        this.enemies.splice(idx, 1);
        if (window.audioManager) window.audioManager.playExplosion();
    }

    updatePickups(dt) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.pulse += dt * 4;

            const dx = this.player.pos.x - p.x;
            const dz = this.player.pos.z - p.z;
            const dist = Math.hypot(dx, dz);

            // Magnetic attraction when close to player (< 48 units)
            if (dist < 48 && dist > 1) {
                const pullSpeed = (1 - dist / 48) * 95;
                p.x += (dx / dist) * pullSpeed * dt;
                p.z += (dz / dist) * pullSpeed * dt;
            }

            if (p.mesh) {
                p.mesh.rotation.y += dt * 2.5;
                p.mesh.position.set(p.x, 2.2 + Math.sin(p.pulse) * 0.6, p.z);
            }

            if (dist < this.player.radius + p.radius) {
                if (p.type === 'shield') {
                    this.player.shield = Math.min(this.player.maxShield, this.player.shield + 45);
                    this.spawnFloatingText("SHIELD RESTORED +45", this.player.pos.x, this.player.pos.z, '#0088ff');
                } else if (p.type === 'overdrive') {
                    this.player.overdriveTimer = 8.0;
                    this.spawnFloatingText("OVERDRIVE MATRIX", this.player.pos.x, this.player.pos.z, '#ff00ff');
                } else if (p.type === 'tri_plasma') {
                    this.player.triPlasmaTimer = 14.0;
                    this.spawnFloatingText("TRI-SPREAD CANNONS!", this.player.pos.x, this.player.pos.z, '#ffaa00');
                }

                this.spawnVoxelExplosion(p.x, p.z, p.color, 16);
                if (p.mesh) this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
                if (window.audioManager && window.audioManager.playPowerup) window.audioManager.playPowerup();
            }
        }
    }

    updateHazards(dt) {
        for (let i = this.activeHazards.length - 1; i >= 0; i--) {
            const h = this.activeHazards[i];
            if (h.warningTimer > 0) {
                h.warningTimer -= dt;
                if (h.mesh) {
                    h.mesh.material.opacity = 0.2 + Math.sin(performance.now() * 0.02) * 0.15;
                }
            } else {
                h.activeTimer -= dt;
                if (h.mesh) {
                    h.mesh.material.opacity = 0.85;
                    h.mesh.material.wireframe = false;
                }

                // Check collision with player
                const playerCoord = h.isHorizontal ? this.player.pos.z : this.player.pos.x;
                if (Math.abs(playerCoord - h.pos) < h.width + 4) {
                    this.damagePlayer(45 * dt);
                }

                if (h.activeTimer <= 0) {
                    if (h.mesh) this.scene.remove(h.mesh);
                    this.activeHazards.splice(i, 1);
                }
            }
        }
    }

    /* --------------------------------------------------------------------- */
    /* 3D RENDERING PIPELINE                                                 */
    /* --------------------------------------------------------------------- */
    render3D(dt) {
        if (!this.hasWebGL || !this.renderer) {
            this.render2D(dt);
            return;
        }

        // 1. Sync Player 3D Mesh
        if (this.playerGroup) {
            this.playerGroup.position.set(this.player.pos.x, 2.2, this.player.pos.z);
            this.playerGroup.rotation.y = this.player.angle;
            this.playerGroup.rotation.z = this.player.bankAngle; // Dynamic Roll

            // Shield Flash & Invulnerability Pulse (Subtle wireframe energy flicker)
            if (this.shieldMesh) {
                const isInvuln = (this.player.invulnerableTimer > 0);
                const invulnPulse = isInvuln ? (0.15 + 0.10 * Math.sin(performance.now() * 0.015)) : 0;
                const flash = Math.max(invulnPulse, this.player.shieldHitFlash * 0.35);
                this.shieldMesh.material.opacity = flash;
                this.shieldMesh.visible = (flash > 0.02 && this.cameraMode !== 'cockpit');
            }

            // Thruster point light decay
            if (this.thrusterLight && this.thrusterLight.intensity > 1.4) {
                this.thrusterLight.intensity = Math.max(1.4, this.thrusterLight.intensity - dt * 8);
            }
        }

        // Sync Player High-Intensity Forward Headlight (Local -Z is Forward)
        if (this.playerHeadlight && this.playerHeadlightTarget) {
            const p = this.player.pos;
            const fx = -Math.sin(this.player.angle);
            const fz = -Math.cos(this.player.angle);
            this.playerHeadlight.position.set(p.x, 3.5, p.z);
            this.playerHeadlightTarget.position.set(p.x + fx * 160, 0.5, p.z + fz * 160);
        }

        // Animate Ion Exhaust Plumes based on velocity & boost
        if (this.exhaustPlumes && this.exhaustPlumes.length > 0) {
            const speedRatio = Math.min(1.8, (this.player.vel.length() / this.player.speed));
            const boostMult = this.player.speedBoostTimer > 0 ? 1.75 : 1.0;
            const flicker = 0.85 + Math.random() * 0.3;
            const scaleZ = Math.max(0.4, speedRatio * boostMult * flicker);
            this.exhaustPlumes.forEach(plume => {
                plume.scale.set(1.0, 1.0, scaleZ);
                if (plume.material) {
                    plume.material.opacity = Math.min(0.95, 0.45 + speedRatio * 0.4);
                }
            });
        }

        // 2. Sync Player Light Ribbon Trail
        this.updatePlayer3DLightTrail();

        // 3. Sync Enemies 3D Meshes & Light Trails
        this.enemies.forEach(e => {
            if (e.mesh) {
                e.mesh.position.set(e.x, e.type === 'boss' ? 14 : 2.0, e.z);
                e.mesh.rotation.y = e.angle;
            }
            if (e.type === 'stalker' && e.trailMesh) {
                this.updateCycleLightTrail(e);
            }
        });

        // 4. Sync Holographic 3D Targeting Reticle
        if (this.reticleGroup) {
            if (this.cameraMode === 'cockpit' || this.isGameOver) {
                this.reticleGroup.visible = false;
            } else {
                this.reticleGroup.visible = true;
                this.reticleGroup.position.x = this.aimPoint.x;
                this.reticleGroup.position.z = this.aimPoint.z;
                this.reticleRing.rotation.y += dt * 2.2;

                // Check for nearest enemy to aimPoint (Target Lock!)
                let isLocked = false;
                for (let e of this.enemies) {
                    const d = Math.hypot(e.x - this.aimPoint.x, e.z - this.aimPoint.z);
                    if (d < (e.radius + 16)) {
                        isLocked = true;
                        break;
                    }
                }

                if (isLocked) {
                    this.reticleRingMat.color.setHex(0xff0055);
                    this.reticleDiamondMat.color.setHex(0xff0055);
                    this.reticleGroup.scale.set(1.2, 1.2, 1.2);
                } else {
                    this.reticleRingMat.color.setHex(0x00ffff);
                    this.reticleDiamondMat.color.setHex(0x00ffff);
                    this.reticleGroup.scale.set(1.0, 1.0, 1.0);
                }
            }
        }

        // Phase 4: Sync 3D Holographic Target Lock Reticle
        if (this.targetLockMesh) {
            if (this.isGameOver) {
                this.targetLockMesh.position.y = -999;
            } else {
                // Find closest enemy in forward vision cone
                let bestTarget = null;
                let closestDist = 260;
                let isDirectLock = false;

                const fwdX = -Math.sin(this.player.angle);
                const fwdZ = -Math.cos(this.player.angle);

                for (let e of this.enemies) {
                    const dx = e.x - this.player.pos.x;
                    const dz = e.z - this.player.pos.z;
                    const d = Math.hypot(dx, dz);
                    if (d < closestDist) {
                        const dot = (dx * fwdX + dz * fwdZ) / (d || 1);
                        if (dot > 0.35) {
                            closestDist = d;
                            bestTarget = e;
                            isDirectLock = (dot > 0.93);
                        }
                    }
                }

                if (bestTarget) {
                    this.currentTargetEnemy = bestTarget;
                    this.targetLockMesh.position.set(bestTarget.x, (bestTarget.type === 'boss') ? 14 : 2.5, bestTarget.z);
                    this.targetLockMesh.rotation.y = this.player.angle;

                    const ring = this.targetLockMesh.getObjectByName("bracketRing");
                    if (ring) ring.rotation.z += dt * 3.5;

                    const diamond = this.targetLockMesh.getObjectByName("diamond");
                    const targetColor = isDirectLock ? 0xff0055 : 0x00ffff;

                    if (ring && ring.material) ring.material.color.setHex(targetColor);
                    if (diamond && diamond.material) diamond.material.color.setHex(targetColor);

                    if (isDirectLock && !this.lastTargetLocked) {
                        if (window.audioManager && window.audioManager.playLockOn) {
                            window.audioManager.playLockOn();
                        }
                    }
                    this.lastTargetLocked = isDirectLock;
                } else {
                    this.currentTargetEnemy = null;
                    this.targetLockMesh.position.y = -999;
                    this.lastTargetLocked = false;
                }
            }
        }

        // Phase 4: Sync Hyperspace Speed Warp Streaks
        if (this.speedWarpMesh) {
            this.speedWarpMesh.position.set(this.player.pos.x, 2.5, this.player.pos.z);
            this.speedWarpMesh.rotation.y = this.player.angle;

            const isHighSpeed = this.player.overdriveTimer > 0 || this.player.isDashing || this.player.isBlinking || this.player.speedBoostTimer > 0;
            const targetOpacity = isHighSpeed ? 0.75 : (this.player.vel.length() > 60 ? 0.22 : 0.0);
            if (this.speedWarpMesh.material) {
                this.speedWarpMesh.material.opacity += (targetOpacity - this.speedWarpMesh.material.opacity) * Math.min(1.0, dt * 8.0);
                this.speedWarpMesh.visible = (this.speedWarpMesh.material.opacity > 0.01);
            }
        }

        // 5. Update Cyber Dust (Drifts with velocity for speed sensation)
        if (this.dustParticles) {
            const posAttr = this.dustParticles.geometry.attributes.position;
            const px = this.player.pos.x;
            const pz = this.player.pos.z;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i);
                let z = posAttr.getZ(i);

                if (x - px > 250) x -= 500;
                if (x - px < -250) x += 500;
                if (z - pz > 250) z -= 500;
                if (z - pz < -250) z += 500;

                posAttr.setX(i, x);
                posAttr.setZ(i, z);
            }
            posAttr.needsUpdate = true;
        }

        // Dynamic Warp Speed FOV kick (dilates FOV from 62° to 74° on gate surge with smooth recovery)
        const targetFOV = (this.cameraMode === 'cockpit' && this.player.speedBoostTimer > 0) ? 74 : 62;
        if (Math.abs(this.camera.fov - targetFOV) > 0.05) {
            this.camera.fov += (targetFOV - this.camera.fov) * Math.min(1.0, dt * 7.0);
            this.camera.updateProjectionMatrix();
        }

        // 6. Camera Tracking
        this.update3DCamera();

        // Phase 5: Animate Perimeter Forcefield & Sector Pulse Rings
        if (this.forcefieldWall) {
            this.forcefieldWall.rotation.y += dt * 0.05;
            this.forcefieldWall.material.opacity = 0.20 + 0.06 * Math.sin(performance.now() * 0.003);
        }
        if (this.sectorPulseRings && this.sectorPulseRings.length > 0) {
            const time = performance.now() * 0.002;
            this.sectorPulseRings.forEach((ring, idx) => {
                ring.material.opacity = 0.22 + 0.15 * Math.sin(time + idx * 1.2);
            });
        }

        // 7. Three.js Render (UnrealBloomPass Post-Processing or Standard Renderer)
        if (this.composer && this.hasBloom) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // 8. Cockpit Spatial Threat Tracking HUD Canvas
        this.renderCockpitThreatTrackingHUD();
    }

    /* --------------------------------------------------------------------- */
    /* COCKPIT SPATIAL THREAT TRACKING HUD                                   */
    /* --------------------------------------------------------------------- */
    renderCockpitThreatTrackingHUD() {
        if (!this.hudCanvas || !this.hudCtx) return;
        const ctx = this.hudCtx;
        const w = this.container.clientWidth || (window.innerWidth - 370);
        const h = this.container.clientHeight || (window.innerHeight - 52);

        if (this.hudCanvas.width !== w || this.hudCanvas.height !== h) {
            this.hudCanvas.width = w;
            this.hudCanvas.height = h;
        }

        ctx.clearRect(0, 0, w, h);

        if (this.renderMode !== '3d' || this.cameraMode !== 'cockpit' || this.isGameOver) {
            return;
        }

        const cx = w / 2;
        const cy = h / 2;

        // 1. Dynamic Collimated Artificial Horizon & Pitch Ladder
        ctx.save();
        ctx.translate(cx, cy);
        // Bank roll tilts horizon opposite to craft roll (ground tilts relative to pilot)
        ctx.rotate(-this.player.bankAngle * 0.45);

        // Pitch shift: vertical displacement based on flight pitch
        const pitchShift = (this.camera.rotation.x + 0.018) * 420;
        ctx.translate(0, pitchShift);

        // Neon Cyan Horizon line segments
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-220, 0); ctx.lineTo(-65, 0);
        ctx.moveTo(65, 0); ctx.lineTo(220, 0);
        ctx.stroke();

        // Collimated Pitch Ladder (+10°, +5°, -5°, -10°)
        const pitchLadder = [
            { deg: 10, y: -48, solid: true },
            { deg: 5, y: -24, solid: true },
            { deg: -5, y: 24, solid: false },
            { deg: -10, y: 48, solid: false }
        ];
        pitchLadder.forEach(rung => {
            const rw = rung.deg % 10 === 0 ? 50 : 32;
            ctx.beginPath();
            if (rung.solid) {
                ctx.moveTo(-rw, rung.y); ctx.lineTo(-18, rung.y); ctx.lineTo(-18, rung.y + 4);
                ctx.moveTo(18, rung.y + 4); ctx.lineTo(18, rung.y); ctx.lineTo(rw, rung.y);
            } else {
                ctx.setLineDash([4, 4]);
                ctx.moveTo(-rw, rung.y); ctx.lineTo(-18, rung.y); ctx.lineTo(-18, rung.y - 4);
                ctx.moveTo(18, rung.y - 4); ctx.lineTo(18, rung.y); ctx.lineTo(rw, rung.y);
                ctx.setLineDash([]);
            }
            ctx.stroke();

            ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
            ctx.font = '9px "Share Tech Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${rung.deg}°`, -rw - 4, rung.y + 3);
            ctx.textAlign = 'left';
            ctx.fillText(`${rung.deg}°`, rw + 4, rung.y + 3);
        });

        // Center Flight Path Marker (FPM)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.moveTo(-12, 0); ctx.lineTo(-6, 0);
        ctx.moveTo(6, 0); ctx.lineTo(12, 0);
        ctx.moveTo(0, -9); ctx.lineTo(0, -6);
        ctx.stroke();

        ctx.restore();

        // Dynamic Warp Speed Radial Tunnel Streaks
        if (this.player.speedBoostTimer > 0) {
            ctx.save();
            const surgeAlpha = Math.min(1.0, this.player.speedBoostTimer * 0.75);
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.35 * surgeAlpha})`;
            ctx.lineWidth = 1.6;
            const now = performance.now() * 0.006;
            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2 + Math.sin(now + i) * 0.08;
                const r1 = 110 + ((now * 320 + i * 42) % (Math.max(w, h) * 0.6));
                const r2 = r1 + 38 + (i % 3) * 18;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
                ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
                ctx.stroke();
            }
            ctx.restore();

            // Speed boost active banner
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 12px "Orbitron", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`⚡ COHERENT WARP SURGE ACTIVE (${this.player.speedBoostTimer.toFixed(1)}s)`, cx, cy - 68);
        }

        // 2. Spatial Threat Tracking: Enemies
        const cameraPos = this.camera.position;
        const forwardVector = new THREE.Vector3();
        this.camera.getWorldDirection(forwardVector);

        this.enemies.forEach(e => {
            const targetPos = new THREE.Vector3(e.x, e.type === 'boss' ? 14 : 2.0, e.z);
            const dist = Math.round(targetPos.distanceTo(cameraPos));

            const toTarget = targetPos.clone().sub(cameraPos);
            const dotForward = toTarget.dot(forwardVector);

            const proj = targetPos.clone();
            proj.project(this.camera);

            const isInFront = dotForward > 0 && proj.z < 1.0;
            const inFrustum = isInFront && proj.x >= -0.92 && proj.x <= 0.92 && proj.y >= -0.92 && proj.y <= 0.92;

            if (inFrustum) {
                // In-frustum 3D-to-Screen Targeting Brackets
                const screenX = (proj.x * 0.5 + 0.5) * w;
                const screenY = (-(proj.y * 0.5) + 0.5) * h;

                const boxSize = Math.max(24, Math.min(70, 900 / Math.max(1, dist)));
                const half = boxSize / 2;

                const color = (e.type === 'boss' ? '#ff0055' : (e.type === 'heavy' ? '#ffaa00' : '#00ffff'));
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.8;

                // 4 Corner Brackets
                const c = Math.min(8, half * 0.5);
                ctx.beginPath();
                // Top-Left
                ctx.moveTo(screenX - half, screenY - half + c);
                ctx.lineTo(screenX - half, screenY - half);
                ctx.lineTo(screenX - half + c, screenY - half);
                // Top-Right
                ctx.moveTo(screenX + half - c, screenY - half);
                ctx.lineTo(screenX + half, screenY - half);
                ctx.lineTo(screenX + half, screenY - half + c);
                // Bottom-Right
                ctx.moveTo(screenX + half, screenY + half - c);
                ctx.lineTo(screenX + half, screenY + half);
                ctx.lineTo(screenX + half - c, screenY + half);
                // Bottom-Left
                ctx.moveTo(screenX - half + c, screenY + half);
                ctx.lineTo(screenX - half, screenY + half);
                ctx.lineTo(screenX - half, screenY + half - c);
                ctx.stroke();

                // Target readout: [TYPE 85m]
                ctx.font = '10px "Share Tech Mono", monospace';
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.fillText(`[${e.type.toUpperCase()} ${dist}m]`, screenX, screenY - half - 4);

                // Small HP bar
                const hpPct = Math.max(0, e.hp / e.maxHp);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(screenX - half, screenY + half + 4, boxSize, 3);
                ctx.fillStyle = (hpPct > 0.5 ? '#00ffaa' : (hpPct > 0.25 ? '#ffaa00' : '#ff0055'));
                ctx.fillRect(screenX - half, screenY + half + 4, boxSize * hpPct, 3);
            } else {
                // Off-screen / Behind: Clamped perimeter warning chevron
                let dirX = proj.x;
                let dirY = proj.y;
                if (!isInFront) {
                    dirX = -dirX;
                    dirY = -dirY;
                }
                const angle = Math.atan2(dirY, dirX);

                const margin = 50;
                const edgeX = cx + Math.cos(angle) * (cx - margin);
                const edgeY = cy - Math.sin(angle) * (cy - margin);

                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(-angle + Math.PI / 2);

                const color = (e.type === 'boss' ? '#ff0055' : '#ff2255');
                ctx.fillStyle = color;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;

                // Glowing chevron triangle pointing outward
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(7, 8);
                ctx.lineTo(0, 4);
                ctx.lineTo(-7, 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Distance indicator
                ctx.rotate(angle - Math.PI / 2); // unrotate text
                ctx.font = '9px "Share Tech Mono", monospace';
                ctx.fillStyle = '#ff6688';
                ctx.textAlign = 'center';
                ctx.fillText(`${dist}m`, 0, 16);

                ctx.restore();
            }
        });

        ctx.restore();
    }

    updatePlayer3DLightTrail() {
        if (!this.playerTrailMesh || this.player.trailPoints.length < 2) return;

        const geom = this.playerTrailMesh.geometry;
        const posAttr = geom.attributes.position;
        const colAttr = geom.attributes.color;
        const points = this.player.trailPoints;
        let vIdx = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const alpha0 = 1.0 - (i / points.length);
            const alpha1 = 1.0 - ((i + 1) / points.length);

            // Vertical quad: p0 bottom, p0 top, p1 bottom, p1 top
            const height = 3.2;

            // Triangle 1
            posAttr.setXYZ(vIdx, p0.x, 0.1, p0.z); colAttr.setXYZ(vIdx, 0, alpha0, alpha0); vIdx++;
            posAttr.setXYZ(vIdx, p0.x, height, p0.z); colAttr.setXYZ(vIdx, 0, alpha0, alpha0); vIdx++;
            posAttr.setXYZ(vIdx, p1.x, 0.1, p1.z); colAttr.setXYZ(vIdx, 0, alpha1, alpha1); vIdx++;

            // Triangle 2
            posAttr.setXYZ(vIdx, p1.x, 0.1, p1.z); colAttr.setXYZ(vIdx, 0, alpha1, alpha1); vIdx++;
            posAttr.setXYZ(vIdx, p0.x, height, p0.z); colAttr.setXYZ(vIdx, 0, alpha0, alpha0); vIdx++;
            posAttr.setXYZ(vIdx, p1.x, height, p1.z); colAttr.setXYZ(vIdx, 0, alpha1, alpha1); vIdx++;
        }

        geom.setDrawRange(0, vIdx);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
    }

    updateCycleLightTrail(e) {
        if (!e.trailMesh || e.trailPoints.length < 2) return;

        const geom = e.trailMesh.geometry;
        const posAttr = geom.attributes.position;
        const colAttr = geom.attributes.color;
        const points = e.trailPoints;
        let vIdx = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const alpha0 = 1.0 - (i / points.length);
            const alpha1 = 1.0 - ((i + 1) / points.length);

            const height = 2.4;

            // Triangle 1
            posAttr.setXYZ(vIdx, p0.x, 0.1, p0.z); colAttr.setXYZ(vIdx, alpha0, 0, alpha0 * 0.3); vIdx++;
            posAttr.setXYZ(vIdx, p0.x, height, p0.z); colAttr.setXYZ(vIdx, alpha0, 0, alpha0 * 0.3); vIdx++;
            posAttr.setXYZ(vIdx, p1.x, 0.1, p1.z); colAttr.setXYZ(vIdx, 0, alpha1, alpha1); vIdx++;

            // Triangle 2
            posAttr.setXYZ(vIdx, p1.x, 0.1, p1.z); colAttr.setXYZ(vIdx, alpha1, 0, alpha1 * 0.3); vIdx++;
            posAttr.setXYZ(vIdx, p0.x, height, p0.z); colAttr.setXYZ(vIdx, alpha0, 0, alpha0 * 0.3); vIdx++;
            posAttr.setXYZ(vIdx, p1.x, height, p1.z); colAttr.setXYZ(vIdx, alpha1, 0, alpha1 * 0.3); vIdx++;
        }

        geom.setDrawRange(0, vIdx);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
    }

    update3DCamera() {
        const p = this.player.pos;
        const ang = this.player.angle;

        // Screen shake offset
        const shakeX = (Math.random() - 0.5) * this.screenShake * 0.2;
        const shakeY = (Math.random() - 0.5) * this.screenShake * 0.2;

        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);

        if (this.cameraMode === 'chase') {
            // Restore exterior ship & under-glow visibility
            if (this.playerGroup) this.playerGroup.visible = true;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = true;

            if (this.isLookingBack) {
                // LOOK-BACK / REARVIEW PERSPECTIVE:
                // Camera positioned ahead of ship along flight path, looking back into the wake at pursuers
                const lookDist = this.camZoom * 0.95;
                const lookHeight = lookDist * 0.38 + 4.5;
                const camTargetX = p.x + fwdX * lookDist + shakeX;
                const camTargetY = lookHeight + shakeY;
                const camTargetZ = p.z + fwdZ * lookDist;

                this.camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), 0.22);
                this.camera.lookAt(p.x - fwdX * 55, 5.0, p.z - fwdZ * 55);

                if (Math.abs(this.camera.fov - 66) > 0.5) {
                    this.camera.fov = 66;
                    this.camera.updateProjectionMatrix();
                }
            } else {
                // FORWARD CHASE WITH DYNAMIC PURSUER AUTO-FRAMING:
                // If pursuers are trailing closely behind (< 180 units), dynamically pull camera back & expand FOV
                let dynamicDist = this.camZoom;
                let targetFov = 62;
                if (this.rearThreatDetected && this.nearestPursuerDist < 180) {
                    const threatFactor = 1.0 - (this.nearestPursuerDist / 180);
                    dynamicDist += threatFactor * 16;
                    targetFov = 62 + threatFactor * 12; // Expand up to 74° FOV
                }

                if (Math.abs(this.camera.fov - targetFov) > 0.3) {
                    this.camera.fov += (targetFov - this.camera.fov) * 0.08;
                    this.camera.updateProjectionMatrix();
                }

                // Star Fox / Wipeout dogfight chase perspective:
                // Natural ~15° pitch looking over tail towards horizon, bringing skyline and headlights into full view
                const height = dynamicDist * 0.38 + 4.5;
                const camTargetX = p.x - fwdX * dynamicDist + shakeX;
                const camTargetY = height + shakeY;
                const camTargetZ = p.z - fwdZ * dynamicDist;

                this.camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), this.camSmoothing);
                this.camera.lookAt(p.x + fwdX * 55, 5.5, p.z + fwdZ * 55);
            }
        } else if (this.cameraMode === 'tactical') {
            // TACTICAL TWIN-STICK ARENA OVERHEAD:
            // Elevated 3/4 isometric perspective for complete 360° threat awareness without disorienting spins
            if (this.playerGroup) this.playerGroup.visible = true;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = true;

            const camTargetX = p.x + shakeX;
            const camTargetY = 88 + shakeY;
            const camTargetZ = p.z + 58;

            if (Math.abs(this.camera.fov - 58) > 0.5) {
                this.camera.fov = 58;
                this.camera.updateProjectionMatrix();
            }

            this.camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), 0.12);
            this.camera.lookAt(p.x, 0, p.z - 6);
        } else if (this.cameraMode === 'cockpit') {
            if (this.playerGroup) this.playerGroup.visible = false;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = false;
            if (this.shieldMesh) this.shieldMesh.visible = false;

            this.camera.rotation.order = 'YXZ';
            this.camera.position.set(p.x + shakeX, 2.7 + shakeY, p.z);

            let flightYaw = -ang;
            let flightPitch = -0.016;
            let flightRoll = this.player.bankAngle * 0.45;

            if (this.isLookingBack) {
                flightYaw = -ang + Math.PI; // Flip 180° in cockpit
                flightRoll = 0;
            } else {
                const thrustPitch = this.keys['w'] ? -0.012 : (this.keys['s'] ? 0.01 : 0);
                flightPitch += thrustPitch;
            }

            this.camera.rotation.set(flightPitch, flightYaw, flightRoll, 'YXZ');

            // Update Cockpit HUD telemetry
            const spdElem = document.getElementById('cockpit-speed');
            const hdgElem = document.getElementById('cockpit-heading');
            if (spdElem) {
                const boostTag = this.player.speedBoostTimer > 0 ? " [⚡WARP]" : "";
                spdElem.innerText = `SPD: ${Math.round(this.player.vel.length() * 3.6)} KPH${boostTag}`;
            }
            if (hdgElem) {
                let deg = Math.round(((-ang * 180 / Math.PI) % 360 + 360) % 360);
                hdgElem.innerText = `HDG: ${String(deg).padStart(3, '0')}° [TRON-SYS]`;
            }
        }
    }

    toggleLookBack(forceState) {
        if (typeof forceState === 'boolean') {
            this.isLookingBack = forceState;
        } else {
            this.isLookingBack = !this.isLookingBack;
        }

        const rearBtn = document.getElementById('btn-lookback');
        if (rearBtn) {
            rearBtn.innerHTML = this.isLookingBack ? '↩ REAR: ON [R]' : '↩ REAR: OFF [R]';
            rearBtn.classList.toggle('active', this.isLookingBack);
        }

        if (this.isLookingBack) {
            this.spawnFloatingText("<<< REAR VIEW ENGAGED >>>", this.player.pos.x, this.player.pos.z, '#00ffff');
            if (window.audioManager) window.audioManager.playBlink();
        }
    }

    deployMine() {
        if (this.isGameOver || this.mineCooldown > 0) return;
        this.mineCooldown = this.maxMineCooldown;

        const p = this.player.pos;
        const ang = this.player.angle;
        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);

        // Place mine 12 units directly behind craft
        const mx = p.x - fwdX * 12;
        const mz = p.z - fwdZ * 12;

        // 3D Tron EMP Disc Mesh
        const group = new THREE.Group();
        const coreGeom = new THREE.CylinderGeometry(2.4, 2.4, 0.4, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const core = new THREE.Mesh(coreGeom, coreMat);
        core.position.y = 0.2;
        group.add(core);

        const ringGeom = new THREE.RingGeometry(2.6, 3.4, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.22;
        group.add(ring);

        // Expanding pulse ring
        const pulseGeom = new THREE.RingGeometry(0.5, 1.2, 24);
        pulseGeom.rotateX(-Math.PI / 2);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        const pulse = new THREE.Mesh(pulseGeom, pulseMat);
        pulse.position.y = 0.24;
        group.add(pulse);

        group.position.set(mx, 0, mz);
        this.scene.add(group);

        this.mines.push({
            x: mx,
            z: mz,
            radius: 20,
            life: 8.0,
            pulseTimer: 0,
            mesh: group,
            pulseMesh: pulse
        });

        this.spawnFloatingText("⚡ EMP MINE DEPLOYED", mx, mz, '#00ffcc');
        if (window.audioManager) window.audioManager.playDash();
    }

    updateMines(dt) {
        if (this.mineCooldown > 0) {
            this.mineCooldown = Math.max(0, this.mineCooldown - dt);
        }

        const mineBar = document.getElementById('hud-mine-bar');
        const mineVal = document.getElementById('hud-mine-val');
        const btnMine = document.getElementById('btn-mine');
        if (mineBar && mineVal) {
            if (this.mineCooldown <= 0) {
                mineBar.style.width = '100%';
                mineBar.style.background = '#00ffcc';
                mineVal.innerText = 'RDY';
                mineVal.style.color = '#00ffcc';
                if (btnMine) btnMine.innerHTML = '⚡ EMP MINE [E]';
            } else {
                const pct = Math.round((1.0 - (this.mineCooldown / this.maxMineCooldown)) * 100);
                mineBar.style.width = `${pct}%`;
                mineBar.style.background = '#ffaa00';
                mineVal.innerText = `${this.mineCooldown.toFixed(1)}s`;
                mineVal.style.color = '#ffaa00';
                if (btnMine) btnMine.innerHTML = `⚡ EMP: ${this.mineCooldown.toFixed(1)}s`;
            }
        }

        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.life -= dt;
            m.pulseTimer += dt * 3.5;

            if (m.pulseMesh) {
                const pScale = 1.0 + (m.pulseTimer % 2.5) * 1.8;
                m.pulseMesh.scale.set(pScale, 1.0, pScale);
                m.pulseMesh.material.opacity = Math.max(0, 0.8 - (m.pulseTimer % 2.5) * 0.3);
            }

            // Check enemy collision
            let triggered = false;
            for (let e of this.enemies) {
                const dist = Math.hypot(e.x - m.x, e.z - m.z);
                if (dist < (e.radius + m.radius)) {
                    triggered = true;
                    break;
                }
            }

            if (triggered || m.life <= 0) {
                if (triggered) {
                    const blastRadius = 45;
                    this.screenShake = Math.max(this.screenShake, 18);
                    if (window.audioManager) window.audioManager.playExplosion();

                    // Voxel EMP shockwave particles
                    this.spawnVoxelExplosion(m.x, m.z, 0x00ffff, 28);
                    this.spawnVoxelExplosion(m.x, m.z, 0xff00ff, 18);

                    // Damage all nearby enemies
                    this.enemies.forEach(e => {
                        const d = Math.hypot(e.x - m.x, e.z - m.z);
                        if (d < blastRadius) {
                            const dmg = Math.round(140 * (1.0 - d / blastRadius));
                            e.hp -= dmg;
                            this.spawnFloatingText(`💥 EMP -${dmg}`, e.x, e.z, '#00ffff');
                        }
                    });
                }

                if (m.mesh) this.scene.remove(m.mesh);
                this.mines.splice(i, 1);
            }
        }
    }

    updateIdentityDisc(dt) {
        if (!this.identityDisc.active) {
            if (this.identityDisc.mesh) this.identityDisc.mesh.visible = false;
            return;
        }

        const d = this.identityDisc;
        d.lifespan -= dt;
        d.spinAngle += dt * 28.0;

        if (d.mesh) {
            d.mesh.visible = true;
            d.mesh.rotation.y = d.spinAngle;
        }

        if (d.returning) {
            // Accelerate smoothly back toward player's craft
            const dx = this.player.pos.x - d.x;
            const dz = this.player.pos.z - d.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 12.0) {
                // Caught disc!
                d.active = false;
                d.returning = false;
                if (d.mesh) d.mesh.visible = false;
                this.spawnFloatingText("DISC RECOVERED", this.player.pos.x, this.player.pos.z, '#00ffff');
                if (window.audioManager && window.audioManager.playPowerup) window.audioManager.playPowerup();
                return;
            }

            const ndx = dx / (dist || 1);
            const ndz = dz / (dist || 1);
            d.vx += (ndx * d.returnSpeed - d.vx) * Math.min(1.0, dt * 8.0);
            d.vz += (ndz * d.returnSpeed - d.vz) * Math.min(1.0, dt * 8.0);
            d.x += d.vx * dt;
            d.z += d.vz * dt;
        } else {
            d.x += d.vx * dt;
            d.z += d.vz * dt;

            // Check Arena Pylon Ricochets
            if (this.arenaPylonPositions && this.arenaPylonPositions.length > 0) {
                for (const pylon of this.arenaPylonPositions) {
                    const pdx = d.x - pylon.x;
                    const pdz = d.z - pylon.z;
                    const pDist = Math.hypot(pdx, pdz);
                    if (pDist < pylon.radius + d.radius) {
                        const nx = pdx / (pDist || 1);
                        const nz = pdz / (pDist || 1);
                        const dot = d.vx * nx + d.vz * nz;
                        if (dot < 0) {
                            d.vx -= 2 * dot * nx;
                            d.vz -= 2 * dot * nz;
                            d.bounces++;
                            this.spawnVoxelExplosion(d.x, d.z, 0xffaa00, 16);
                            this.spawnFloatingText("RICOCHET!", d.x, d.z, '#ffaa00');
                            if (window.audioManager && window.audioManager.playDiscRicochet) {
                                window.audioManager.playDiscRicochet();
                            }
                            if (d.bounces >= d.maxBounces) {
                                d.returning = true;
                            }
                            break;
                        }
                    }
                }
            }

            // Boundary bounce if flying too far
            const arenaDist = Math.hypot(d.x, d.z);
            if (arenaDist > 270) {
                d.returning = true;
            }

            if (d.lifespan <= 0) {
                d.returning = true;
            }
        }

        if (d.mesh) {
            d.mesh.position.set(d.x, 2.4, d.z);
        }

        // Disc - Enemy Collisions (Piercing Cleave)
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const dist = Math.hypot(d.x - e.x, d.z - e.z);
            if (dist < e.radius + d.radius) {
                e.hp -= 95;
                this.spawnFloatingText("-95 DISC", e.x, e.z, '#ffaa00');
                this.spawnVoxelExplosion(e.x, e.z, 0x00ffff, 14);

                if (window.audioManager && window.audioManager.playShieldHit) {
                    window.audioManager.playShieldHit();
                }

                if (e.hp <= 0) {
                    this.destroyEnemy(i);
                }
            }
        }
    }

    checkLightRibbonCollisions(dt) {
        const distSqToSegment = (px, pz, ax, az, bx, bz) => {
            const l2 = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
            if (l2 === 0) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
            let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = ax + t * (bx - ax);
            const projZ = az + t * (bz - az);
            return (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
        };

        // 1. ENEMY HITTING PLAYER'S CYAN LIGHT WALL
        if (this.player.trailPoints && this.player.trailPoints.length > 5) {
            // Skip first 4 segments right behind player's stern
            for (let s = 4; s < this.player.trailPoints.length - 1; s++) {
                const p0 = this.player.trailPoints[s];
                const p1 = this.player.trailPoints[s + 1];

                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const e = this.enemies[j];
                    const thresh = (e.radius + 2.8) * (e.radius + 2.8);
                    const dSq = distSqToSegment(e.x, e.z, p0.x, p0.z, p1.x, p1.z);

                    if (dSq < thresh) {
                        // ENEMY DEREZ!
                        e.hp -= 260;
                        this.spawnVoxelExplosion(e.x, e.z, 0x00ffff, 36);
                        this.spawnShockwave(e.x, e.z, 35, 0x00ffff);

                        if (e.hp <= 0) {
                            this.destroyEnemy(j);
                            this.registerComboAction(300, 'ribbon');
                            this.spawnFloatingText("TRON DEREZ! +300", e.x, e.z, '#00ffff');
                            if (window.audioManager && window.audioManager.playDerez) {
                                window.audioManager.playDerez();
                            }
                        } else {
                            this.spawnFloatingText("-260 DEREZ", e.x, e.z, '#00ffff');
                        }
                    }
                }
            }
        }

        const segmentsIntersect = (x1, z1, x2, z2, x3, z3, x4, z4) => {
            const ccw = (ax, az, bx, bz, cx, cz) => (cz - az) * (bx - ax) > (bz - az) * (cx - ax);
            return (ccw(x1, z1, x3, z3, x4, z4) !== ccw(x2, z2, x3, z3, x4, z4)) &&
                   (ccw(x1, z1, x2, z2, x3, z3) !== ccw(x1, z1, x2, z2, x4, z4));
        };

        // 2. PLAYER HITTING ENEMY STALKER'S RED LIGHT WALL
        const isBlinking = (this.player.isBlinking || this.player.blinkInvulnTimer > 0);

        for (const e of this.enemies) {
            if (e.type === 'stalker' && e.trailPoints && e.trailPoints.length > 4) {
                // Check each segment (skipping first 3 points behind cycle)
                for (let s = 3; s < e.trailPoints.length - 1; s++) {
                    const ep0 = e.trailPoints[s];
                    const ep1 = e.trailPoints[s + 1];

                    if (isBlinking && this.player.blinkOrigin) {
                        const hopped = segmentsIntersect(
                            this.player.blinkOrigin.x, this.player.blinkOrigin.z,
                            this.player.pos.x, this.player.pos.z,
                            ep0.x, ep0.z, ep1.x, ep1.z
                        );
                        if (hopped && !this.player.wallHoppedThisBlink) {
                            this.player.wallHoppedThisBlink = true;
                            this.comboTimer = this.maxComboTimer;
                            this.registerComboAction(150, 'wallhop');
                            this.spawnFloatingText("WALL HOP! +150", this.player.pos.x, this.player.pos.z, '#00ffff');
                            this.spawnVoxelExplosion(this.player.pos.x, this.player.pos.z, 0x00ffff, 18);
                            if (window.audioManager && window.audioManager.playWallHop) {
                                window.audioManager.playWallHop();
                            }
                        }
                    } else if (!isBlinking) {
                        const thresh = (this.player.radius + 2.4) * (this.player.radius + 2.4);
                        const dSq = distSqToSegment(this.player.pos.x, this.player.pos.z, ep0.x, ep0.z, ep1.x, ep1.z);
                        if (dSq < thresh) {
                            // Player takes hazard burn!
                            this.damagePlayer(45 * dt);
                            this.player.shieldHitFlash = 1.0;
                            this.player.vel.x *= -0.4;
                            this.player.vel.z *= -0.4;
                            if (performance.now() - (this.lastWallHazardAlertTime || 0) > 800) {
                                this.spawnFloatingText("LIGHT WALL HAZARD!", this.player.pos.x, this.player.pos.z, '#ff0055');
                                if (window.audioManager && window.audioManager.playAlert) {
                                    window.audioManager.playAlert();
                                }
                                this.lastWallHazardAlertTime = performance.now();
                            }
                        }
                    }
                }
            }
        }
    }

    spawnShockwave(x, z, maxRadius = 45, color = 0x00ffff) {
        if (this.renderMode === '3d') {
            const ringGeom = new THREE.RingGeometry(0.8, 2.4, 32);
            ringGeom.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(ringGeom, ringMat);
            mesh.position.set(x, 0.25, z);
            this.scene.add(mesh);

            this.shockwaves.push({
                x,
                z,
                radius: 1.0,
                maxRadius,
                speed: 85,
                mesh,
                color
            });
        }

        if (window.audioManager && window.audioManager.playShockwave) {
            window.audioManager.playShockwave();
        }
    }

    updateShockwaves(dt) {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const s = this.shockwaves[i];
            s.radius += s.speed * dt;
            const progress = s.radius / s.maxRadius;

            if (s.mesh) {
                const scale = s.radius;
                s.mesh.scale.set(scale, 1, scale);
                s.mesh.material.opacity = Math.max(0, (1 - progress) * 0.85);
            }

            // Repel enemies caught in shockwave
            for (const e of this.enemies) {
                const dist = Math.hypot(e.x - s.x, e.z - s.z);
                if (Math.abs(dist - s.radius) < 12.0) {
                    const pushAngle = Math.atan2(e.z - s.z, e.x - s.x);
                    e.x += Math.cos(pushAngle) * 45 * dt;
                    e.z += Math.sin(pushAngle) * 45 * dt;
                }
            }

            if (progress >= 1.0) {
                if (s.mesh) this.scene.remove(s.mesh);
                this.shockwaves.splice(i, 1);
            }
        }
    }

    updateCopilot(dt) {
        if (!this.copilotGroup || !this.copilotChevrons) return;

        this.copilotPulse += dt * 4.0;

        let targetCopilotAngle = this.player.angle;
        let tacticName = (this.botIntent && this.botIntent.nav) ? this.botIntent.nav : 'circle_strafe_cw';

        if (tacticName === 'circle_strafe_cw') {
            targetCopilotAngle = this.player.angle + 0.65;
        } else if (tacticName === 'circle_strafe_ccw') {
            targetCopilotAngle = this.player.angle - 0.65;
        } else if (tacticName === 'retreat_open_space') {
            targetCopilotAngle = this.player.angle + Math.PI;
        } else if (tacticName === 'direct_charge') {
            targetCopilotAngle = this.player.angle;
        }

        const fwdX = -Math.sin(targetCopilotAngle);
        const fwdZ = -Math.cos(targetCopilotAngle);

        this.copilotChevrons.forEach((chev, idx) => {
            const dist = 22 + idx * 16 + (Math.sin(this.copilotPulse + idx * 0.8) * 3);
            chev.position.set(
                this.player.pos.x + fwdX * dist,
                0.22,
                this.player.pos.z + fwdZ * dist
            );
            chev.rotation.y = targetCopilotAngle;
            chev.material.opacity = (this.autoPilot ? 0.85 : 0.45) * (0.6 + 0.4 * Math.sin(this.copilotPulse + idx));
        });
    }

    updateRearThreatDetection(dt) {
        const p = this.player.pos;
        const ang = this.player.angle;
        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);

        let nearestPursuer = null;
        let minPursuerDist = 9999;

        this.enemies.forEach(e => {
            const toEx = e.x - p.x;
            const toEz = e.z - p.z;
            const dist = Math.hypot(toEx, toEz);
            // Dot product with forward vector
            const dotFwd = (toEx * fwdX + toEz * fwdZ) / (dist || 1);
            // Behind player if dotFwd < -0.2 (broad ~155° rear cone) within 240 units
            if (dotFwd < -0.2 && dist < 240) {
                if (dist < minPursuerDist) {
                    minPursuerDist = dist;
                    nearestPursuer = e;
                }
            }
        });

        this.rearThreatDetected = Boolean(nearestPursuer);
        this.nearestPursuerDist = minPursuerDist;

        // Update On-Screen Threat Warning Banner
        const threatBanner = document.getElementById('rear-threat-warning');
        const threatText = document.getElementById('rear-threat-text');
        const rearContainer = document.getElementById('rearview-mirror-container');
        const rearStatus = document.getElementById('rearview-status-tag');

        if (this.rearThreatDetected && nearestPursuer) {
            const distM = Math.round(minPursuerDist);
            const typeName = nearestPursuer.type.toUpperCase();
            if (threatBanner && !this.isGameOver) {
                threatBanner.style.display = 'flex';
                if (threatText) {
                    threatText.innerText = `WARNING: ${typeName} AT 6 O'CLOCK (${distM}m)`;
                }
            }
            if (rearContainer) {
                rearContainer.classList.add('threat-alert');
            }
            if (rearStatus) {
                rearStatus.innerText = `⚠️ PURSUER CLOSING: ${distM}m`;
                rearStatus.style.color = '#ff0055';
            }

            // Audio Warning Alert (rate-limited)
            this.rearAlertSoundTimer -= dt;
            if (this.rearAlertSoundTimer <= 0 && minPursuerDist < 120) {
                this.rearAlertSoundTimer = (minPursuerDist < 60) ? 0.9 : 1.8;
                if (window.audioManager) window.audioManager.playAlert();
            }
        } else {
            if (threatBanner) threatBanner.style.display = 'none';
            if (rearContainer) rearContainer.classList.remove('threat-alert');
            if (rearStatus) {
                rearStatus.innerText = "6 O'CLOCK: CLEAR";
                rearStatus.style.color = '#7f99b2';
            }
            this.rearAlertSoundTimer = 0;
        }

        // Update Look-back banner
        const lookbackBanner = document.getElementById('lookback-banner');
        if (lookbackBanner) {
            lookbackBanner.style.display = (this.isLookingBack && !this.isGameOver) ? 'block' : 'none';
        }
    }

    renderRearviewMirror() {
        const canvas = document.getElementById('rearview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = 10;
        const maxRange = 220;

        ctx.clearRect(0, 0, w, h);

        // Cyber grid scanlines & backdrop
        ctx.fillStyle = 'rgba(2, 8, 20, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Distance range arcs
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
        ctx.lineWidth = 1;
        [60, 120, 180].forEach(r => {
            const rad = (r / maxRange) * (h - 16);
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        });

        // Center 6 o'clock guidelines
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.15)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, h - 4);
        ctx.stroke();

        // Player craft silhouette at top pointing down
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.moveTo(cx, cy + 6);
        ctx.lineTo(cx - 6, cy - 2);
        ctx.lineTo(cx + 6, cy - 2);
        ctx.closePath();
        ctx.fill();

        // Plot enemies in rear hemisphere
        const p = this.player.pos;
        const ang = this.player.angle;
        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);
        const rightX = Math.cos(ang);
        const rightZ = -Math.sin(ang);

        this.enemies.forEach(e => {
            const dx = e.x - p.x;
            const dz = e.z - p.z;
            const dist = Math.hypot(dx, dz);

            const fwdComp = dx * fwdX + dz * fwdZ;
            const rightComp = dx * rightX + dz * rightZ;

            // Only show enemies behind the player (fwdComp < 0)
            if (fwdComp < 5 && dist < maxRange) {
                const behindDist = -fwdComp;
                const px = cx + (rightComp / maxRange) * (w / 2 - 12);
                const py = cy + (behindDist / maxRange) * (h - 20);

                if (px >= 6 && px <= w - 6 && py >= 4 && py <= h - 4) {
                    ctx.fillStyle = (e.type === 'boss') ? '#ff00aa' : '#ff0055';
                    ctx.shadowColor = '#ff0055';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(px, py, (e.type === 'boss') ? 4.5 : 3.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    ctx.fillStyle = '#ff77aa';
                    ctx.font = '8px monospace';
                    ctx.fillText(`${Math.round(dist)}m`, px + 5, py + 3);
                }
            }
        });
    }

    /* --------------------------------------------------------------------- */
    /* 2D RETRO ARENA RENDERING PIPELINE                                     */
    /* --------------------------------------------------------------------- */
    render2D(dt) {
        if (!this.ctx2d) return;
        const ctx = this.ctx2d;
        const w = this.canvas2d.width;
        const h = this.canvas2d.height;

        ctx.save();

        // Clear Canvas
        ctx.fillStyle = '#050a14';
        ctx.fillRect(0, 0, w, h);

        // Center Follow Camera
        const camX = w / 2 - this.player.pos.x;
        const camY = h / 2 - this.player.pos.z;

        if (this.screenShake > 0) {
            const ox = (Math.random() - 0.5) * this.screenShake;
            const oy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(camX + ox, camY + oy);
        } else {
            ctx.translate(camX, camY);
        }

        // Draw Infinite Neon Grid
        this.draw2DGrid(ctx, camX, camY, w, h);

        // Draw Hazards
        this.activeHazards.forEach(hz => {
            if (hz.warningTimer > 0) {
                ctx.strokeStyle = `rgba(255, 0, 85, ${0.35 + Math.sin(performance.now() * 0.02) * 0.3})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                if (hz.isHorizontal) {
                    ctx.moveTo(-1500, hz.pos); ctx.lineTo(1500, hz.pos);
                } else {
                    ctx.moveTo(hz.pos, -1500); ctx.lineTo(hz.pos, 1500);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth = hz.width * 2;
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 16;
                ctx.beginPath();
                if (hz.isHorizontal) {
                    ctx.moveTo(-1500, hz.pos); ctx.lineTo(1500, hz.pos);
                } else {
                    ctx.moveTo(hz.pos, -1500); ctx.lineTo(hz.pos, 1500);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        });

        // Draw Pickups
        this.pickups.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.z);
            const scale = 1 + Math.sin(p.pulse) * 0.15;
            ctx.scale(scale, scale);

            let col = '#00ffcc';
            let label = '+';
            if (p.type === 'shield') { col = '#0088ff'; label = 'S'; }
            else if (p.type === 'overdrive') { col = '#ff00ff'; label = '⚡'; }

            ctx.strokeStyle = col;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = col;
            ctx.shadowBlur = 12;

            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = col;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 1);
            ctx.restore();
        });

        // Draw EMP Mines in 2D
        this.mines.forEach(m => {
            ctx.save();
            ctx.translate(m.x, m.z);
            const pulse = (performance.now() * 0.005) % (Math.PI * 2);
            ctx.strokeStyle = '#00ffff';
            ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, 0, 8 + Math.sin(pulse) * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Trigger radius circle
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        });

        // Draw Player Light Ribbon Trail in 2D
        if (this.player.trailPoints.length > 1) {
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i = 0; i < this.player.trailPoints.length; i++) {
                const pt = this.player.trailPoints[i];
                if (i === 0) ctx.moveTo(pt.x, pt.z);
                else ctx.lineTo(pt.x, pt.z);
            }
            ctx.stroke();
        }

        // Draw Stalker Red Light Ribbon Trails in 2D
        this.enemies.forEach(e => {
            if (e.type === 'stalker' && e.trailPoints && e.trailPoints.length > 1) {
                ctx.strokeStyle = 'rgba(255, 0, 85, 0.6)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                for (let i = 0; i < e.trailPoints.length; i++) {
                    const pt = e.trailPoints[i];
                    if (i === 0) ctx.moveTo(pt.x, pt.z);
                    else ctx.lineTo(pt.x, pt.z);
                }
                ctx.stroke();
            }
        });

        // Draw Identity Disc in 2D
        if (this.identityDisc && this.identityDisc.active) {
            ctx.save();
            ctx.translate(this.identityDisc.x, this.identityDisc.z);
            ctx.rotate(this.identityDisc.spinAngle);
            ctx.strokeStyle = '#00ffff';
            ctx.fillStyle = 'rgba(255, 170, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.identityDisc.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Draw 2D Shockwaves
        this.shockwaves.forEach(s => {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = Math.max(0, 1.0 - s.radius / s.maxRadius);
            ctx.beginPath();
            ctx.arc(s.x, s.z, s.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });

        // Draw Player Bullets
        this.bullets.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(b.x, b.z, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Draw Enemy Bullets
        this.enemyBullets.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(b.x, b.z, 5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Draw Enemies in 2D
        this.enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.z);
            ctx.rotate(e.angle);

            const col = e.isBerserk ? '#ff0055' : (typeof e.color === 'number' ? '#' + e.color.toString(16).padStart(6, '0') : e.color);
            ctx.strokeStyle = col;
            ctx.fillStyle = '#090f1e';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = col;
            ctx.shadowBlur = e.isBerserk ? 14 : 6;

            if (e.type === 'stalker') {
                // Sleek Light-Cycle Dart
                ctx.beginPath();
                ctx.moveTo(0, -e.radius * 1.3);
                ctx.lineTo(e.radius * 0.7, e.radius);
                ctx.lineTo(0, e.radius * 0.5);
                ctx.lineTo(-e.radius * 0.7, e.radius);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (e.type === 'drone') {
                // Diamond Drone
                ctx.beginPath();
                ctx.moveTo(0, -e.radius);
                ctx.lineTo(e.radius, 0);
                ctx.lineTo(0, e.radius);
                ctx.lineTo(-e.radius, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (e.type === 'heavy') {
                // Hexagonal Cyber Tank
                ctx.beginPath();
                for (let a = 0; a < 6; a++) {
                    const rad = (a / 6) * Math.PI * 2;
                    const hx = Math.cos(rad) * e.radius;
                    const hy = Math.sin(rad) * e.radius;
                    if (a === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (e.type === 'boss') {
                // Recognizer U-Archway
                ctx.beginPath();
                ctx.rect(-e.radius, -e.radius, e.radius * 2, 10);
                ctx.rect(-e.radius, -e.radius, 12, e.radius * 2);
                ctx.rect(e.radius - 12, -e.radius, 12, e.radius * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Health Bar over Enemy
            if (e.hp < e.maxHp) {
                const barW = e.radius * 2;
                const barH = 4;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(-barW / 2, -e.radius - 12, barW, barH);
                ctx.fillStyle = e.isBerserk ? '#ff0055' : '#00ffaa';
                ctx.fillRect(-barW / 2, -e.radius - 12, barW * (e.hp / e.maxHp), barH);
            }

            ctx.restore();
        });

        // Draw 2D Particles
        this.particles2d.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        // Draw 2D Player Craft
        this.draw2DPlayer(ctx);

        // Draw Floating Texts
        this.floatingTexts.forEach(t => {
            const alpha = Math.max(0, t.life / t.maxLife);
            ctx.fillStyle = t.color;
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 6;
            ctx.fillText(t.text, t.x, t.z);
        });
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    draw2DGrid(ctx, camX, camY, w, h) {
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.07)';
        ctx.lineWidth = 1;
        const step = 45;

        const startX = Math.floor((-camX) / step) * step;
        const endX = startX + w + step * 2;
        const startY = Math.floor((-camY) / step) * step;
        const endY = startY + h + step * 2;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += step) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    draw2DPlayer(ctx) {
        // Invulnerability strobe flicker
        if (this.player.invulnerableTimer > 0 && Math.floor(performance.now() / 65) % 2 === 0) {
            return;
        }

        ctx.save();
        ctx.translate(this.player.pos.x, this.player.pos.z);
        ctx.rotate(this.player.angle);

        // Shield Halo
        if (this.player.shield > 0) {
            const shieldAlpha = Math.min(0.7, (this.player.shield / this.player.maxShield) * 0.6);
            ctx.strokeStyle = `rgba(0, 162, 255, ${shieldAlpha})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#00a2ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, 0, this.player.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Thruster Plume
        const isMoving = this.player.vel.length() > 10;
        if (isMoving) {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(-5, this.player.radius * 0.7);
            ctx.lineTo(0, this.player.radius * 0.7 + 10 + Math.random() * 8);
            ctx.lineTo(5, this.player.radius * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Interceptor Ship Triangle
        ctx.fillStyle = '#071224';
        ctx.strokeStyle = this.player.overdriveTimer > 0 ? '#ff00ff' : '#00ffcc';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(0, -this.player.radius * 1.3);
        ctx.lineTo(this.player.radius * 0.9, this.player.radius * 0.8);
        ctx.lineTo(0, this.player.radius * 0.4);
        ctx.lineTo(-this.player.radius * 0.9, this.player.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    /* --------------------------------------------------------------------- */
    /* RADAR & HUD TELEMETRY                                                 */
    /* --------------------------------------------------------------------- */
    renderRadar() {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radarRange = 600; // units

        ctx.clearRect(0, 0, w, h);

        // Forward and Heading Vector in Canvas Space (X right, Z down)
        const ang = this.player.angle;
        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);
        const headingAngle = Math.atan2(fwdZ, fwdX);

        // Forward Field-of-View Cone (cyan)
        ctx.fillStyle = 'rgba(0, 255, 204, 0.12)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, (w / 2) * 0.75, headingAngle - 0.45, headingAngle + 0.45);
        ctx.closePath();
        ctx.fill();

        // Rear Blindspot / Threat Sector (red pulse if pursuer detected, faint warning otherwise)
        if (this.rearThreatDetected) {
            const threatAlpha = 0.22 + Math.sin(performance.now() * 0.01) * 0.14;
            ctx.fillStyle = `rgba(255, 0, 85, ${threatAlpha})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, (w / 2) * 0.65, headingAngle + Math.PI - 0.55, headingAngle + Math.PI + 0.55);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.04)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, (w / 2) * 0.5, headingAngle + Math.PI - 0.5, headingAngle + Math.PI + 0.5);
            ctx.closePath();
            ctx.fill();
        }

        // Directional Player Chevron at Center
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(headingAngle);
        ctx.fillStyle = '#00ffcc';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(8, 0);       // Forward nose
        ctx.lineTo(-6, -4.5);   // Left wing
        ctx.lineTo(-3, 0);      // Engine notch
        ctx.lineTo(-6, 4.5);    // Right wing
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Enemy Blips
        this.enemies.forEach(e => {
            const dx = e.x - this.player.pos.x;
            const dz = e.z - this.player.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < radarRange) {
                const bx = cx + (dx / radarRange) * (w / 2 - 8);
                const by = cy + (dz / radarRange) * (h / 2 - 8);

                ctx.fillStyle = (e.type === 'boss') ? '#ff00ff' : '#ff0055';
                ctx.beginPath();
                ctx.arc(bx, by, e.type === 'boss' ? 4 : 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Pickup Blips
        this.pickups.forEach(p => {
            const dx = p.x - this.player.pos.x;
            const dz = p.z - this.player.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < radarRange) {
                const bx = cx + (dx / radarRange) * (w / 2 - 8);
                const by = cy + (dz / radarRange) * (h / 2 - 8);

                ctx.fillStyle = '#00a2ff';
                ctx.beginPath();
                ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // EMP Mine Blips
        this.mines.forEach(m => {
            const dx = m.x - this.player.pos.x;
            const dz = m.z - this.player.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < radarRange) {
                const bx = cx + (dx / radarRange) * (w / 2 - 8);
                const by = cy + (dz / radarRange) * (h / 2 - 8);

                ctx.fillStyle = '#00ffff';
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
    }

    updateHUD() {
        // Player HP & Shield
        const hpBar = document.getElementById('hud-hp-bar');
        const hpVal = document.getElementById('hud-hp-val');
        if (hpBar) hpBar.style.width = `${Math.max(0, (this.player.hp / this.player.maxHp) * 100)}%`;
        if (hpVal) hpVal.innerText = Math.round(this.player.hp);

        const shieldBar = document.getElementById('hud-shield-bar');
        const shieldVal = document.getElementById('hud-shield-val');
        if (shieldBar) shieldBar.style.width = `${Math.max(0, (this.player.shield / this.player.maxShield) * 100)}%`;
        if (shieldVal) shieldVal.innerText = Math.round(this.player.shield);

        const heatBar = document.getElementById('hud-heat-bar');
        if (heatBar) heatBar.style.width = `${Math.max(0, this.player.heat)}%`;

        // Dash Dots
        const dashContainer = document.getElementById('hud-dash-dots');
        if (dashContainer) {
            const dots = dashContainer.querySelectorAll('.dash-dot');
            dots.forEach((d, idx) => {
                d.classList.toggle('charged', idx < this.player.dashCharges);
            });
        }

        // Stats
        const waveVal = document.getElementById('hud-wave');
        if (waveVal) waveVal.innerText = this.wave;

        const scoreVal = document.getElementById('hud-score');
        if (scoreVal) scoreVal.innerText = this.score;

        // Coordinate Display
        const coordDisp = document.getElementById('coord-display');
        if (coordDisp) {
            const modeTag = (this.renderMode === '3d') ? '3D TRON' : '2D RETRO';
            coordDisp.innerText = `GRID: X: ${Math.round(this.player.pos.x)} | Z: ${Math.round(this.player.pos.z)} | [${modeTag}]`;
        }

        // EMP Mine Cooldown
        const mineBar = document.getElementById('hud-mine-bar');
        const mineVal = document.getElementById('hud-mine-val');
        if (mineBar) {
            const pct = Math.max(0, Math.min(100, (1.0 - (this.mineCooldown / this.maxMineCooldown)) * 100));
            mineBar.style.width = `${pct}%`;
        }
        if (mineVal) {
            mineVal.innerText = (this.mineCooldown <= 0) ? 'RDY' : `${this.mineCooldown.toFixed(1)}s`;
        }

        // Identity Disc Cooldown
        const discBar = document.getElementById('hud-disc-bar');
        const discVal = document.getElementById('hud-disc-val');
        if (discBar) {
            const pct = this.identityDisc.active ? 100 : Math.max(0, Math.min(100, (1.0 - (this.discCooldown / this.maxDiscCooldown)) * 100));
            discBar.style.width = `${pct}%`;
            discBar.style.background = this.identityDisc.active ? '#00ffff' : '#ffaa00';
        }
        if (discVal) {
            discVal.innerText = this.identityDisc.active ? 'ACTIVE' : (this.discCooldown <= 0 ? 'RDY' : `${this.discCooldown.toFixed(1)}s`);
            discVal.style.color = this.identityDisc.active ? '#00ffff' : '#ffaa00';
        }

        // Active Power-up Row
        const powerupRow = document.getElementById('hud-powerup-row');
        const powerupVal = document.getElementById('hud-powerup-val');
        if (powerupRow && powerupVal) {
            if (this.player.triPlasmaTimer > 0) {
                powerupRow.style.display = 'flex';
                powerupVal.innerText = `TRI-PLASMA: ${Math.ceil(this.player.triPlasmaTimer)}s`;
                powerupVal.style.color = '#ffaa00';
            } else if (this.player.overdriveTimer > 0) {
                powerupRow.style.display = 'flex';
                powerupVal.innerText = `OVERDRIVE: ${Math.ceil(this.player.overdriveTimer)}s`;
                powerupVal.style.color = '#ff00ff';
            } else {
                powerupRow.style.display = 'none';
            }
        }

        // Phase 4: Command Recognizer Boss Threat Health Bar
        const boss = this.enemies.find(e => e.type === 'boss');
        const bossHud = document.getElementById('boss-hud-container');
        if (boss && bossHud) {
            bossHud.style.display = 'block';
            const bossFill = document.getElementById('boss-meter-fill');
            const bossPhase = document.getElementById('boss-hud-phase');
            const bossStatus = document.getElementById('boss-hud-status');
            const hpPct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
            if (bossFill) bossFill.style.width = `${hpPct}%`;
            if (bossPhase) {
                const phaseNum = boss.bossPhase || 1;
                bossPhase.innerText = (phaseNum === 1) ? 'PHASE 1: DUAL PYLONS' : ((phaseNum === 2) ? 'PHASE 2: GRID SWEEP' : 'PHASE 3: OVERLOAD');
                bossPhase.style.color = (phaseNum === 3) ? '#ff0055' : ((phaseNum === 2) ? '#ffaa00' : '#00ffff');
            }
            if (bossStatus) {
                bossStatus.innerText = `CORE INTEGRITY: ${Math.round(hpPct)}% | ESCORT SYSTEMS: ${boss.bossPhase === 3 ? 'ENGAGED' : 'STANDBY'}`;
            }
            if (window.audioManager && window.audioManager.setMusicIntensity) {
                window.audioManager.setMusicIntensity('boss');
            }
        } else if (bossHud) {
            bossHud.style.display = 'none';
            if (window.audioManager && window.audioManager.setMusicIntensity) {
                window.audioManager.setMusicIntensity(this.enemies.length > 0 ? 'combat' : 'ambient');
            }
        }

        // Phase 4: Style Combo Streak Badge
        const comboContainer = document.getElementById('hud-combo-container');
        const comboVal = document.getElementById('hud-combo-val');
        const comboTitle = document.getElementById('hud-combo-title');
        const comboFill = document.getElementById('hud-combo-fill');
        if (comboContainer) {
            if (this.combo > 1) {
                comboContainer.style.display = 'flex';
                if (comboVal) comboVal.innerText = `x${this.comboMultiplier.toFixed(1)} ${this.comboRank}`;
                if (comboTitle) comboTitle.innerText = `COMBO [${this.combo}]`;
                if (comboFill) {
                    const pct = Math.max(0, (this.comboTimer / this.maxComboTimer) * 100);
                    comboFill.style.width = `${pct}%`;
                }
            } else {
                comboContainer.style.display = 'none';
            }
        }

        // Phase 4: Low-Health Tension Audio Filter Sweep (<25 HP)
        if (window.audioManager && window.audioManager.setLowHealthFilter) {
            window.audioManager.setLowHealthFilter(this.player.hp < 25);
        }

        // Phase 5: Dynamic Equalizer Telemetry & Audio Banner
        if (window.audioManager && window.audioManager.getAudioActivity) {
            const eqBars = document.querySelectorAll('#hud-eq-visualizer .eq-bar');
            if (eqBars && eqBars.length > 0) {
                const activity = window.audioManager.getAudioActivity();
                eqBars.forEach((bar, idx) => {
                    const level = activity[idx] || 0.15;
                    const h = Math.max(3, Math.min(16, Math.round(level * 16)));
                    bar.style.height = `${h}px`;
                });
            }
        }

        const banner = document.getElementById('audio-unlock-banner');
        if (banner && window.audioManager && window.audioManager.isAudioUnlocked) {
            banner.style.display = 'none';
        }
    }
}

// Auto-boot when page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CyberGameEngine();
});
