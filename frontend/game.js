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
        this.camSmoothing = 0.08;

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
            lastDamageTime: 0,
            trailPoints: [],
            maxTrailPoints: 48,
        };

        // Collections
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.pickups = [];
        this.particles2d = [];
        this.voxelParticles3d = [];
        this.floatingTexts = [];

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

        // Scene & Fog
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x02050e);
        this.scene.fog = new THREE.FogExp2(0x02050e, 0.0022);

        // Perspective Camera
        this.camera = new THREE.PerspectiveCamera(62, width / height, 0.5, 3500);
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
            this.hasWebGL = true;
        } catch (err) {
            console.warn("⚠️ WebGL context creation failed. Defaulting to 2D Classic Mode:", err);
            this.hasWebGL = false;
            this.renderMode = '2d';
        }

        // Lights
        const ambient = new THREE.AmbientLight(0x1a2638, 1.4);
        this.scene.add(ambient);

        this.sunLight = new THREE.DirectionalLight(0x00ffff, 1.3);
        this.sunLight.position.set(50, 120, 50);
        this.scene.add(this.sunLight);

        // Infinite Tron Floor Grids
        this.gridCellSize = 25;
        // Primary Cyan Glowing Grid
        this.gridHelper = new THREE.GridHelper(900, 36, 0x00ffff, 0x005566);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);

        // Deep Sapphire Fine Sub-Grid
        this.subGridHelper = new THREE.GridHelper(1800, 72, 0x0088ff, 0x001a33);
        this.subGridHelper.position.y = -0.05;
        this.scene.add(this.subGridHelper);

        // Dark reflective floor plane
        const floorGeom = new THREE.PlaneGeometry(2400, 2400);
        const floorMat = new THREE.MeshBasicMaterial({
            color: 0x02050c,
            depthWrite: false
        });
        this.floorMesh = new THREE.Mesh(floorGeom, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.y = -0.1;
        this.scene.add(this.floorMesh);

        // Tron Horizon Cyber Monoliths & Skyline
        this.buildTronSkyline();

        // Speed Motes / Cyber Dust (Gives High-Speed Momentum)
        this.initCyberDust();

        // Player 3D Interceptor Craft
        this.buildPlayerMesh();

        // Player Light Ribbon Wall
        this.initPlayerLightTrail();

        // Holographic 3D Ground Targeting Reticle
        this.init3DTargetReticle();
    }

    buildTronSkyline() {
        this.skylineGroup = new THREE.Group();
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x040b17,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x020a14
        });
        const edgeCyan = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 1.5 });
        const edgePink = new THREE.LineBasicMaterial({ color: 0xff00aa, linewidth: 1.5 });

        // 48 Monolithic Towers on distant perimeter
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

            tower.position.set(Math.cos(angle) * dist, h / 2 - 5, Math.sin(angle) * dist);
            tower.rotation.y = angle;
            this.skylineGroup.add(tower);
        }

        // Horizon Neon Ring
        const ringGeom = new THREE.RingGeometry(850, 865, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const horizonRing = new THREE.Mesh(ringGeom, ringMat);
        horizonRing.rotation.x = -Math.PI / 2;
        horizonRing.position.y = 0.5;
        this.skylineGroup.add(horizonRing);

        this.scene.add(this.skylineGroup);
    }

    initCyberDust() {
        const dustCount = 350;
        const dustGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(dustCount * 3);
        const colors = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 500;
            positions[i * 3 + 1] = 0.5 + Math.random() * 6.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 500;

            // Cyan or Amber motes
            if (Math.random() > 0.3) {
                colors[i * 3] = 0.0; colors[i * 3 + 1] = 1.0; colors[i * 3 + 2] = 0.9;
            } else {
                colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.1;
            }
        }

        dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        dustGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const dustMat = new THREE.PointsMaterial({
            size: 2.5,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        this.dustParticles = new THREE.Points(dustGeom, dustMat);
        this.scene.add(this.dustParticles);
    }

    buildPlayerMesh() {
        this.playerGroup = new THREE.Group();

        // 1. Aerodynamic Central Fuselage
        const bodyGeom = new THREE.ConeGeometry(3.2, 9.2, 4);
        bodyGeom.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x081320,
            roughness: 0.15,
            metalness: 0.9,
            emissive: 0x021728,
        });
        this.playerBody = new THREE.Mesh(bodyGeom, bodyMat);
        this.playerGroup.add(this.playerBody);

        const bodyEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeom),
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
        );
        this.playerGroup.add(bodyEdges);

        // 2. Forward-Swept Tron Wings with Glowing Neon Trim
        const wingGeom = new THREE.BufferGeometry();
        const wingVertices = new Float32Array([
            // Left wing
            0, 0, 1.2,
            -7.2, 0, 3.6,
            0, 0, -3.5,
            // Right wing
            0, 0, 1.2,
            7.2, 0, 3.6,
            0, 0, -3.5,
        ]);
        wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
        wingGeom.computeVertexNormals();

        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x060f1c,
            roughness: 0.2,
            metalness: 0.85,
            side: THREE.DoubleSide,
            emissive: 0x001d2b
        });
        const wings = new THREE.Mesh(wingGeom, wingMat);
        this.playerGroup.add(wings);

        const wingEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(wingGeom),
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
        );
        this.playerGroup.add(wingEdges);

        // 3. Glowing Cockpit Canopy
        const canopyGeom = new THREE.BoxGeometry(1.5, 1.2, 3.6);
        const canopyMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const canopy = new THREE.Mesh(canopyGeom, canopyMat);
        canopy.position.set(0, 1.1, 0.3);
        this.playerGroup.add(canopy);

        // 4. Twin Neon Ion Thrusters
        const engMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const engGeom = new THREE.CylinderGeometry(0.75, 0.75, 2.2, 8);
        engGeom.rotateX(Math.PI / 2);
        const leftEng = new THREE.Mesh(engGeom, engMat);
        leftEng.position.set(-2.0, 0.2, 4.0);
        const rightEng = new THREE.Mesh(engGeom, engMat);
        rightEng.position.set(2.0, 0.2, 4.0);
        this.playerGroup.add(leftEng);
        this.playerGroup.add(rightEng);

        // Dynamic Thruster Point Light
        this.thrusterLight = new THREE.PointLight(0x00ffff, 3.2, 32);
        this.thrusterLight.position.set(0, 0.8, 4.8);
        this.playerGroup.add(this.thrusterLight);

        // 5. Grid Under-Glow Aura (Projection Ring on Floor)
        const glowGeom = new THREE.RingGeometry(0.5, 6.0, 24);
        glowGeom.rotateX(-Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        this.playerUnderGlow = new THREE.Mesh(glowGeom, glowMat);
        this.playerUnderGlow.position.y = 0.06;
        this.scene.add(this.playerUnderGlow);

        // 6. Impact Shield Flash Aura (NO wireframe cage! Only flashes when struck)
        const shieldGeom = new THREE.SphereGeometry(6.2, 24, 16);
        this.shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00a2ff,
            transparent: true,
            opacity: 0.0,
            wireframe: false
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

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.triggerQuantumBlink();
            } else if (e.key.toLowerCase() === 'v') {
                this.toggleCameraView();
            } else if (e.key.toLowerCase() === 'g') {
                this.toggleRenderMode();
            } else if (e.key.toLowerCase() === 'p') {
                this.toggleAutoPilot();
            } else if (e.key.toLowerCase() === 'm') {
                if (window.audioManager) window.audioManager.toggleMusic();
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

                // Aim Angle calculation
                if (this.renderMode === '3d') {
                    if (this.cameraMode === 'cockpit') {
                        // In cockpit view, aim forward based on mouse delta from center
                        const dx = (this.mouseScreen.x - canvas.clientWidth / 2) / (canvas.clientWidth / 2);
                        this.player.targetAngle = this.player.angle + dx * 0.08;
                    } else if (this.aimPoint) {
                        const dx = this.aimPoint.x - this.player.pos.x;
                        const dz = this.aimPoint.z - this.player.pos.z;
                        this.player.targetAngle = Math.atan2(dx, dz);
                    }
                } else {
                    // In 2D: aim from center of viewport to mouse
                    const cx = canvas.clientWidth / 2;
                    const cy = canvas.clientHeight / 2;
                    const dx = this.mouseScreen.x - cx;
                    const dy = this.mouseScreen.y - cy;
                    this.player.targetAngle = Math.atan2(dx, dy);
                }
            });

            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) this.isMouseDown = true;
                if (window.audioManager && !window.audioManager.isAudioUnlocked) {
                    window.audioManager.init();
                }
            });

            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 0) this.isMouseDown = false;
            });

            canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
            speed = 120;
            hp = 30;
            radius = 12;
            color = 0xff0055;
        } else if (type === 'drone') {
            // Tron Bit: Dual compound polyhedra with pulsating glowing core
            mesh = this.buildTronBitMesh();
            speed = 80;
            hp = 50;
            radius = 14;
            color = 0xffbb00;
        } else if (type === 'heavy') {
            // Heavy Armored Cyber Tank with rotating turret
            mesh = this.buildTronTankMesh();
            speed = 55;
            hp = 160;
            radius = 20;
            color = 0xff4400;
        } else if (type === 'boss') {
            // Iconic flying Tron Recognizer
            mesh = this.buildTronRecognizerMesh();
            speed = 65;
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
            radius,
            color,
            shootTimer: 0.5 + Math.random() * 2.0,
            tactic: 'direct_charge',
            isBerserk: false,
            angle: 0,
            trailPoints: [],
            trailMesh: (type === 'stalker') ? this.createLightCycleTrailMesh() : null,
            targetingLaser: (type === 'heavy') ? this.createTargetingLaserMesh() : null,
        };

        if (enemyObj.trailMesh) this.scene.add(enemyObj.trailMesh);
        if (enemyObj.targetingLaser) this.scene.add(enemyObj.targetingLaser);

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

        // Center Scanning Visor Eye
        const eyeGeom = new THREE.BoxGeometry(10, 2.5, 2.0);
        const eye = new THREE.Mesh(eyeGeom, neonEye);
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

    spawnPickup(type) {
        const dist = 60 + Math.random() * 100;
        const ang = Math.random() * Math.PI * 2;
        const x = this.player.pos.x + Math.cos(ang) * dist;
        const z = this.player.pos.z + Math.sin(ang) * dist;

        let color = 0x00ffcc;
        if (type === 'shield') color = 0x0088ff;
        else if (type === 'overdrive') color = 0xff00ff;
        else if (type === 'nuke') color = 0xffff00;

        // 3D Pickup Mesh: Floating spinning octahedron with glowing ring
        const group = new THREE.Group();
        const coreGeom = new THREE.OctahedronGeometry(2.2, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color });
        const core = new THREE.Mesh(coreGeom, coreMat);
        group.add(core);

        const ringGeom = new THREE.RingGeometry(2.5, 3.2, 16);
        ringGeom.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65
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
            moveX = Math.sin(this.player.angle);
            moveZ = -Math.cos(this.player.angle);
        } else {
            const mag = Math.hypot(moveX, moveZ);
            moveX /= mag;
            moveZ /= mag;
        }

        const blinkDistance = 65;
        this.player.pos.x += moveX * blinkDistance;
        this.player.pos.z += moveZ * blinkDistance;

        // Voxel dash trail
        this.spawnVoxelExplosion(this.player.pos.x, this.player.pos.z, 0x00ffff, 18);
        this.spawnFloatingText("QUANTUM BLINK", this.player.pos.x, this.player.pos.z, '#00ffff');
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

        // Projectile direction: forward in 3D ground plane
        const dirX = Math.sin(this.player.angle);
        const dirZ = -Math.cos(this.player.angle);
        const bulletSpeed = 260;

        // Twin wing cannons offset
        const offsets = [-1.8, 1.8];
        offsets.forEach(off => {
            const perpX = Math.cos(this.player.angle) * off;
            const perpZ = Math.sin(this.player.angle) * off;
            const bx = this.player.pos.x + perpX;
            const bz = this.player.pos.z + perpZ;

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

        // Dynamic Muzzle Flash Light
        if (this.thrusterLight) {
            this.thrusterLight.intensity = 6.0;
        }

        if (window.audioManager) window.audioManager.playLaser();
    }

    fireEnemyBullet(e) {
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
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (!this.isGameOver) {
            this.updateSimulation(dt);
        }

        // Render according to active view mode
        if (this.renderMode === '3d') {
            this.render3D(dt);
        } else {
            this.render2D(dt);
        }

        this.renderRadar();
        this.updateHUD();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    updateSimulation(dt) {
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

        // Player Weapon & Heat
        if (this.player.fireCooldown > 0) this.player.fireCooldown -= dt;
        if (this.player.heat > 0) {
            this.player.heat = Math.max(0, this.player.heat - dt * 32);
            if (this.player.heat < 30) this.player.isOverheated = false;
        }
        if (this.player.overdriveTimer > 0) this.player.overdriveTimer -= dt;
        if (this.player.invulnerableTimer > 0) this.player.invulnerableTimer -= dt;

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

                // Aim directly at nearest enemy
                this.player.targetAngle = Math.atan2(toX, toZ);

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
            // Manual WASD
            if (this.keys['w'] || this.keys['arrowup']) moveZ -= 1;
            if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1;
            if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
            if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

            if (moveX !== 0 || moveZ !== 0) {
                const mag = Math.hypot(moveX, moveZ);
                moveX /= mag;
                moveZ /= mag;
            }
        }

        // Acceleration & Damping
        const accel = 650;
        const friction = 0.88;
        this.player.vel.x += moveX * accel * dt;
        this.player.vel.z += moveZ * accel * dt;
        this.player.vel.multiplyScalar(friction);

        // Position Integration
        this.player.pos.x += this.player.vel.x * dt;
        this.player.pos.z += this.player.vel.z * dt;

        // Smooth angle slerp
        let diff = this.player.targetAngle - this.player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.player.angle += diff * Math.min(1.0, dt * 14);

        // Dynamic Banking (Roll into turns)
        const targetBank = -diff * 1.8;
        this.player.bankAngle += (targetBank - this.player.bankAngle) * Math.min(1.0, dt * 10);
        this.player.bankAngle = Math.max(-0.6, Math.min(0.6, this.player.bankAngle));

        // Player Light Ribbon Point History
        this.player.trailPoints.unshift(new THREE.Vector3(this.player.pos.x, 2.2, this.player.pos.z));
        if (this.player.trailPoints.length > this.player.maxTrailPoints) {
            this.player.trailPoints.pop();
        }

        // Under-glow ring tracking
        if (this.playerUnderGlow) {
            this.playerUnderGlow.position.set(this.player.pos.x, 0.05, this.player.pos.z);
        }
    }

    updateEnemies(dt) {
        this.enemies.forEach(e => {
            const dx = this.player.pos.x - e.x;
            const dz = this.player.pos.z - e.z;
            const dist = Math.hypot(dx, dz) || 1;
            const ndx = dx / dist;
            const ndz = dz / dist;

            // Tactical Movement
            let moveX = 0;
            let moveZ = 0;

            if (e.tactic === 'direct_charge') {
                moveX = ndx; moveZ = ndz;
            } else if (e.tactic === 'flank_left') {
                moveX = ndz * 0.7 + ndx * 0.3;
                moveZ = -ndx * 0.7 + ndz * 0.3;
            } else if (e.tactic === 'flank_right') {
                moveX = -ndz * 0.7 + ndx * 0.3;
                moveZ = ndx * 0.7 + ndz * 0.3;
            } else {
                moveX = ndx; moveZ = ndz;
            }

            const currentSpeed = e.isBerserk ? e.speed * 1.4 : e.speed;
            e.x += moveX * currentSpeed * dt;
            e.z += moveZ * currentSpeed * dt;
            e.angle = Math.atan2(moveX, moveZ);

            // Update Stalker Light Trail Points
            if (e.type === 'stalker') {
                e.trailPoints.unshift(new THREE.Vector3(e.x, 1.8, e.z));
                if (e.trailPoints.length > 20) e.trailPoints.pop();
            }

            // Shooting
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                e.shootTimer = (e.type === 'heavy') ? 2.5 : 1.8 + Math.random();
                this.fireEnemyBullet(e);
            }

            // Heavy Tank Targeting Laser Sweeping
            if (e.type === 'heavy' && e.targetingLaser && e.mesh) {
                const turret = e.mesh.getObjectByName("turret");
                if (turret) {
                    turret.rotation.y = Math.atan2(dx, dz) - e.angle;
                }
                e.targetingLaser.position.set(e.x, 3.2, e.z);
                e.targetingLaser.rotation.y = Math.atan2(dx, dz);
            }

            // Recognizer Searchlight Wobble
            if (e.type === 'boss' && e.mesh) {
                const pool = e.mesh.getObjectByName("searchPool");
                if (pool) {
                    pool.position.x = Math.sin(performance.now() * 0.002) * 12;
                    pool.position.z = Math.cos(performance.now() * 0.002) * 12;
                }
            }

            // Ramming Damage & Repulsion Physics
            if (dist < e.radius + 8) {
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

    destroyEnemy(idx) {
        const e = this.enemies[idx];
        this.score += (e.type === 'boss' ? 500 : e.type === 'heavy' ? 150 : 50);
        this.enemiesDefeated++;

        this.spawnVoxelExplosion(e.x, e.z, e.color, e.type === 'boss' ? 60 : 24);
        this.spawnFloatingText(`+${e.type === 'boss' ? 500 : 100} PTS`, e.x, e.z, '#ffff00');

        if (Math.random() < 0.28) {
            this.spawnPickup(Math.random() > 0.5 ? 'shield' : 'overdrive');
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

            if (p.mesh) {
                p.mesh.rotation.y += dt * 2.5;
                p.mesh.position.y = 2.2 + Math.sin(p.pulse) * 0.6;
            }

            const dist = Math.hypot(this.player.pos.x - p.x, this.player.pos.z - p.z);
            if (dist < this.player.radius + p.radius) {
                if (p.type === 'shield') {
                    this.player.shield = this.player.maxShield;
                    this.spawnFloatingText("SHIELD RESTORED", this.player.pos.x, this.player.pos.z, '#0088ff');
                } else if (p.type === 'overdrive') {
                    this.player.overdriveTimer = 8.0;
                    this.spawnFloatingText("OVERDRIVE MATRIX", this.player.pos.x, this.player.pos.z, '#ff00ff');
                }

                if (p.mesh) this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
                if (window.audioManager) window.audioManager.playOverdrive();
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

            // Shield Flash & Invulnerability Pulse
            if (this.shieldMesh) {
                const isInvuln = (this.player.invulnerableTimer > 0);
                const invulnPulse = isInvuln ? (0.35 + 0.25 * Math.sin(performance.now() * 0.02)) : 0;
                const flash = Math.max(invulnPulse, this.player.shieldHitFlash * 0.5);
                this.shieldMesh.material.opacity = flash;
                this.shieldMesh.visible = (flash > 0.02);
            }

            // Thruster point light decay
            if (this.thrusterLight && this.thrusterLight.intensity > 3.2) {
                this.thrusterLight.intensity = Math.max(3.2, this.thrusterLight.intensity - dt * 14);
            }
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

        // 6. Camera Tracking
        this.update3DCamera();

        // 7. Three.js Render
        this.renderer.render(this.scene, this.camera);
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

        if (this.cameraMode === 'chase') {
            // Restore exterior ship & under-glow visibility
            if (this.playerGroup) this.playerGroup.visible = true;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = true;

            // Elevated third-person chase camera looking ahead along flight path
            const dist = this.camZoom;
            const height = dist * 0.52 + 7.0;
            const camTargetX = p.x - Math.sin(ang) * dist + shakeX;
            const camTargetY = height + shakeY;
            const camTargetZ = p.z + Math.cos(ang) * dist;

            this.camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), this.camSmoothing);
            this.camera.lookAt(p.x + Math.sin(ang) * 18, 2.5, p.z - Math.cos(ang) * 18);
        } else if (this.cameraMode === 'tactical') {
            // Restore exterior ship & under-glow visibility
            if (this.playerGroup) this.playerGroup.visible = true;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = true;

            // Top-down angled tactical overview
            const camTargetX = p.x + shakeX;
            const camTargetY = 82 + shakeY;
            const camTargetZ = p.z + 52;

            this.camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), this.camSmoothing);
            this.camera.lookAt(p.x, 0, p.z - 8);
        } else if (this.cameraMode === 'cockpit') {
            // CRITICAL FIX: Hide player exterior mesh completely so wings/canopy/thrusters never obstruct view
            if (this.playerGroup) this.playerGroup.visible = false;
            if (this.playerUnderGlow) this.playerUnderGlow.visible = false;

            // First-person cockpit view looking forward along ship heading
            const forwardX = Math.sin(ang);
            const forwardZ = -Math.cos(ang);

            this.camera.position.set(p.x + shakeX, 2.7 + shakeY, p.z);
            this.camera.lookAt(p.x + forwardX * 100, 2.5, p.z + forwardZ * 100);

            // Update Cockpit HUD telemetry
            const spdElem = document.getElementById('cockpit-speed');
            const hdgElem = document.getElementById('cockpit-heading');
            if (spdElem) spdElem.innerText = `SPD: ${Math.round(this.player.vel.length() * 3.6)} KPH`;
            if (hdgElem) {
                let deg = Math.round(((-ang * 180 / Math.PI) % 360 + 360) % 360);
                hdgElem.innerText = `HDG: ${String(deg).padStart(3, '0')}° [TRON-SYS]`;
            }
        }
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

        // Player Dot at center
        ctx.fillStyle = '#00ffcc';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

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
    }
}

// Auto-boot when page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CyberGameEngine();
});
