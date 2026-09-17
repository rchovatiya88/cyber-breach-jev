/**
 * CYBER-BREACH: 3D TRON PROTOCOL
 * Full 3D Tron Arena Combat built with Three.js WebGL & powered by TypeSafe AI's Jev Model
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : 'http://localhost:8000';

class TronCyberGame {
    constructor() {
        console.log("⚡ Booting TronCyberGame 3D Engine...");
        this.container = document.getElementById('arena-container');
        this.canvas = document.getElementById('game-canvas');
        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

        // Game State
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_high_score') || '0', 10);
        this.wave = 1;
        this.enemiesDefeated = 0;
        this.isGameOver = false;
        this.autoPilot = false;
        this.cameraMode = 'chase'; // 'chase', 'tactical', 'cockpit'
        this.camPitch = 0.35; // controllable pitch
        this.camZoom = 38;    // controllable zoom
        this.screenShake = 0;
        this.lastTime = performance.now();

        // Director
        this.directorCooldown = 7.0;
        this.directorTimer = 0;
        this.activeHazards = [];

        // Player Attributes
        this.player = {
            pos: new THREE.Vector3(0, 0, 0),
            vel: new THREE.Vector3(0, 0, 0),
            speed: 150,
            angle: 0,
            targetAngle: 0,
            bankAngle: 0,
            pitchAngle: 0,
            hp: 100,
            maxHp: 100,
            shield: 100,
            maxShield: 100,
            shieldRechargeTimer: 0,
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
            trailPoints: [],
            maxTrailPoints: 50,
        };

        // Entities collections
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.pickups = [];
        this.voxelParticles = [];

        // Controls
        this.keys = {};
        this.mousePos = new THREE.Vector2(0, 0);
        this.isMouseDown = false;
        this.isRightMouseDown = false;
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

        // Initialize 3D Engine
        this.initThree();
        this.initEvents();
        this.checkBackendHealth();
        this.startWave(1);
    }

    initThree() {
        const width = this.container.clientWidth || (window.innerWidth - 370);
        const height = this.container.clientHeight || (window.innerHeight - 52);

        // 1. Scene & Receding Tron Fog
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x02050e);
        this.scene.fog = new THREE.FogExp2(0x02050e, 0.0025);

        // 2. Camera: Dramatic 3D Perspective
        this.camera = new THREE.PerspectiveCamera(62, width / height, 0.5, 3000);
        this.updateCameraPos();

        // 3. Renderer with Anti-Aliasing & High Performance
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. Lights
        const ambient = new THREE.AmbientLight(0x182438, 1.4);
        this.scene.add(ambient);

        this.sunLight = new THREE.DirectionalLight(0x00ffff, 1.2);
        this.sunLight.position.set(60, 140, 60);
        this.scene.add(this.sunLight);

        // 5. Infinite Tron Cyber-Grids
        this.gridCellSize = 20;
        // Primary Cyan Neon Grid
        this.gridHelper = new THREE.GridHelper(800, 40, 0x00ffff, 0x004455);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);

        // Secondary Outer Deep Blue Sub-Grid
        this.subGridHelper = new THREE.GridHelper(1600, 40, 0x0088ff, 0x001a33);
        this.subGridHelper.position.y = -0.05;
        this.scene.add(this.subGridHelper);

        // 6. Glowing Distant Tron Mountains / Cyber Skyline
        this.createTronHorizonSkyline();

        // 7. Player 3D Interceptor Craft
        this.buildPlayerMesh();

        // 8. Player Persistent 3D Light Ribbon Trail
        this.initPlayerLightTrail();

        // 9. Resize Listener
        window.addEventListener('resize', () => this.onResize());
        console.log("✔ Three.js 3D Tron Scene Initialized!");
    }

    createTronHorizonSkyline() {
        // Distant Tron mountain pyramids & monolithic towers forming the classic 80s Tron horizon
        this.skylineGroup = new THREE.Group();
        const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35 });
        const solidMat = new THREE.MeshBasicMaterial({ color: 0x040a17 });

        // Mountain pyramids along horizon
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const dist = 550 + (i % 3) * 60;
            const h = 70 + (i % 5) * 35;
            const w = 90 + (i % 4) * 30;

            const pyrGeom = new THREE.ConeGeometry(w, h, 4);
            const pyr = new THREE.Mesh(pyrGeom, solidMat);
            pyr.add(new THREE.LineSegments(new THREE.EdgesGeometry(pyrGeom), wireMat));

            pyr.position.set(Math.cos(angle) * dist, h / 2 - 5, Math.sin(angle) * dist);
            pyr.rotation.y = angle;
            this.skylineGroup.add(pyr);
        }
        this.scene.add(this.skylineGroup);
    }

    buildPlayerMesh() {
        this.playerGroup = new THREE.Group();

        // 1. Sleek geometric Tron interceptor hull
        const bodyGeom = new THREE.ConeGeometry(3.6, 9.5, 4);
        bodyGeom.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x08111e,
            roughness: 0.15,
            metalness: 0.85,
            emissive: 0x021724,
        });
        this.playerBody = new THREE.Mesh(bodyGeom, bodyMat);
        this.playerGroup.add(this.playerBody);

        // Glowing cyan wireframe edges
        const edgeGeom = new THREE.EdgesGeometry(bodyGeom);
        this.playerEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        const edges = new THREE.LineSegments(edgeGeom, this.playerEdgeMat);
        this.playerGroup.add(edges);

        // 2. Tron Swept Wings
        const wingGeom = new THREE.BufferGeometry();
        const wingVertices = new Float32Array([
            // Left wing
            0, 0, 1.5,
            -7.5, 0, 3.8,
            0, 0, -3.8,
            // Right wing
            0, 0, 1.5,
            7.5, 0, 3.8,
            0, 0, -3.8,
        ]);
        wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
        wingGeom.computeVertexNormals();

        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x050c17,
            roughness: 0.2,
            metalness: 0.8,
            side: THREE.DoubleSide,
            emissive: 0x001c26
        });
        const wings = new THREE.Mesh(wingGeom, wingMat);
        this.playerGroup.add(wings);

        const wingEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(wingGeom),
            new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
        );
        this.playerGroup.add(wingEdges);

        // 3. Glowing Cockpit Canopy
        const canopyGeom = new THREE.BoxGeometry(1.6, 1.3, 3.8);
        const canopyMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const canopy = new THREE.Mesh(canopyGeom, canopyMat);
        canopy.position.set(0, 1.2, 0.4);
        this.playerGroup.add(canopy);

        // 4. Twin Neon Thruster Engines
        const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const engGeom = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
        engGeom.rotateX(Math.PI / 2);
        const leftEng = new THREE.Mesh(engGeom, engineMat);
        leftEng.position.set(-2.0, 0.3, 4.2);
        const rightEng = new THREE.Mesh(engGeom, engineMat);
        rightEng.position.set(2.0, 0.3, 4.2);
        this.playerGroup.add(leftEng);
        this.playerGroup.add(rightEng);

        // Dynamic Thruster PointLight
        this.thrusterLight = new THREE.PointLight(0x00ffff, 3.0, 30);
        this.thrusterLight.position.set(0, 0.8, 5.0);
        this.playerGroup.add(this.thrusterLight);

        // 5. Ground Projection Disc (Shadow / Neon Under-glow on the grid)
        const shadowGeom = new THREE.RingGeometry(0.5, 5.5, 16);
        shadowGeom.rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        this.playerUnderGlow = new THREE.Mesh(shadowGeom, shadowMat);
        this.playerUnderGlow.position.y = 0.05;
        this.scene.add(this.playerUnderGlow);

        // 6. Shield Bubble
        const shieldGeom = new THREE.SphereGeometry(5.8, 16, 12);
        this.shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00a2ff,
            transparent: true,
            opacity: 0.18,
            wireframe: true,
        });
        this.shieldMesh = new THREE.Mesh(shieldGeom, this.shieldMat);
        this.playerGroup.add(this.shieldMesh);

        this.playerGroup.position.set(0, 2.2, 0);
        this.scene.add(this.playerGroup);
    }

    initPlayerLightTrail() {
        // Correct 3D Light Ribbon Wall (Quads with setDrawRange)
        const maxSegments = this.player.maxTrailPoints;
        const maxVertices = maxSegments * 6; // 2 triangles per segment = 6 vertices

        this.trailPositions = new Float32Array(maxVertices * 3);
        this.trailGeom = new THREE.BufferGeometry();
        this.trailGeom.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        this.trailGeom.setDrawRange(0, 0);

        this.trailMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82,
        });
        this.trailMesh = new THREE.Mesh(this.trailGeom, this.trailMat);
        this.scene.add(this.trailMesh);
    }

    updatePlayerLightTrail() {
        // Record new position if player moved
        const lastPt = this.player.trailPoints[0];
        if (!lastPt || lastPt.distanceTo(this.player.pos) > 1.8) {
            this.player.trailPoints.unshift(this.player.pos.clone());
            if (this.player.trailPoints.length > this.player.maxTrailPoints) {
                this.player.trailPoints.pop();
            }
        }

        const pts = this.player.trailPoints;
        if (pts.length < 2) {
            this.trailGeom.setDrawRange(0, 0);
            return;
        }

        const positions = this.trailGeom.attributes.position.array;
        let vIdx = 0;
        const wallHeight = 3.2;

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const fade1 = (1.0 - i / pts.length) * wallHeight;
            const fade2 = (1.0 - (i + 1) / pts.length) * wallHeight;

            // Triangle 1: p1_bot, p1_top, p2_bot
            positions[vIdx++] = p1.x; positions[vIdx++] = 0.05; positions[vIdx++] = p1.z;
            positions[vIdx++] = p1.x; positions[vIdx++] = fade1; positions[vIdx++] = p1.z;
            positions[vIdx++] = p2.x; positions[vIdx++] = 0.05; positions[vIdx++] = p2.z;

            // Triangle 2: p2_bot, p1_top, p2_top
            positions[vIdx++] = p2.x; positions[vIdx++] = 0.05; positions[vIdx++] = p2.z;
            positions[vIdx++] = p1.x; positions[vIdx++] = fade1; positions[vIdx++] = p1.z;
            positions[vIdx++] = p2.x; positions[vIdx++] = fade2; positions[vIdx++] = p2.z;
        }

        this.trailGeom.attributes.position.needsUpdate = true;
        this.trailGeom.setDrawRange(0, (pts.length - 1) * 6);
    }

    onResize() {
        const width = this.container.clientWidth || (window.innerWidth - 370);
        const height = this.container.clientHeight || (window.innerHeight - 52);
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    initEvents() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            this.keys[e.code] = true;

            if (key === 'p') this.toggleAutoPilot();
            if (key === 'v') this.toggleCameraView();
            if (key === 'm') {
                const on = window.sounds.toggleMusic();
                this.showFloatingText(`MUSIC: ${on ? 'ON' : 'OFF'}`, '#00ffcc');
            }
            if (key === 'n') {
                const on = window.sounds.toggleSound();
                this.showFloatingText(`SFX: ${on ? 'ON' : 'OFF'}`, '#00ffcc');
            }
            if (key === 'c') {
                const crt = document.getElementById('crt-overlay');
                if (crt) crt.classList.toggle('active');
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.executePlayerDash();
            }
            if (this.isGameOver && (e.code === 'Space' || e.code === 'Enter')) {
                this.restartGame();
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
            this.keys[e.code] = false;
        });

        // Mouse aiming
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            // Orbit camera on right mouse drag
            if (this.isRightMouseDown) {
                this.camPitch = Math.max(0.15, Math.min(0.85, this.camPitch - e.movementY * 0.004));
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isMouseDown = true;
                window.sounds.init();
                window.sounds.startMusic();
            } else if (e.button === 2) {
                this.isRightMouseDown = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isMouseDown = false;
            if (e.button === 2) this.isRightMouseDown = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camZoom = Math.max(20, Math.min(90, this.camZoom + Math.sign(e.deltaY) * 4));
        }, { passive: false });
    }

    async checkBackendHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/config`);
            if (res.ok) {
                const config = await res.json();
                window.jevHud.updateConfigStatus(config);
            }
        } catch (e) {
            console.log("Backend offline, running embedded calibrated Jev emulator.");
            window.jevHud.updateConfigStatus({ is_live: false, model: "jev-latest (3D embedded)" });
        }
    }

    toggleCameraView() {
        if (this.cameraMode === 'chase') {
            this.cameraMode = 'tactical';
        } else if (this.cameraMode === 'tactical') {
            this.cameraMode = 'cockpit';
        } else {
            this.cameraMode = 'chase';
        }

        const btn = document.getElementById('btn-camera');
        if (btn) {
            if (this.cameraMode === 'chase') btn.textContent = "🎥 CAM: 3D CHASE [V]";
            else if (this.cameraMode === 'tactical') btn.textContent = "🎥 CAM: TACTICAL [V]";
            else btn.textContent = "🎥 CAM: COCKPIT [V]";
        }
        this.showFloatingText(`CAMERA: ${this.cameraMode.toUpperCase()}`, '#00ffff');
    }

    toggleAutoPilot() {
        this.autoPilot = !this.autoPilot;
        const btn = document.getElementById('btn-autopilot');
        if (btn) {
            btn.classList.toggle('active', this.autoPilot);
            btn.textContent = this.autoPilot ? "⚡ JEV AUTOPILOT: ENGAGED [P]" : "🤖 JEV AUTOPILOT: OFF [P]";
        }
        this.showFloatingText(
            this.autoPilot ? "JEV 3D AUTOPILOT ENGAGED" : "MANUAL CONTROL RESTORED",
            this.autoPilot ? "#00ffcc" : "#ffbb00"
        );
        window.sounds.playAlert();
    }

    restartGame() {
        this.score = 0;
        this.wave = 1;
        this.enemiesDefeated = 0;
        this.isGameOver = false;

        this.clearMeshes(this.bullets);
        this.clearMeshes(this.enemyBullets);
        this.clearMeshes(this.enemies);
        this.clearMeshes(this.pickups);
        this.clearMeshes(this.voxelParticles);
        this.activeHazards.forEach(h => this.scene.remove(h.mesh));
        this.activeHazards = [];

        this.player.pos.set(0, 0, 0);
        this.player.vel.set(0, 0, 0);
        this.player.hp = this.player.maxHp;
        this.player.shield = this.player.maxShield;
        this.player.dashCharges = 2;
        this.player.heat = 0;
        this.player.isOverheated = false;
        this.player.trailPoints = [];

        const overEl = document.getElementById('game-over-modal');
        if (overEl) overEl.classList.remove('active');

        this.startWave(1);
    }

    clearMeshes(array) {
        array.forEach(item => {
            if (item.mesh) this.scene.remove(item.mesh);
        });
        array.length = 0;
    }

    startWave(w) {
        this.wave = w;
        window.sounds.playAlert();
        this.showFloatingText(`WAVE ${w} TRANSMITTING ON GRID`, '#00ffff');

        // Spawn 3D Tron entities in infinite space
        const stalkerCount = 3 + w * 2;
        const droneCount = Math.floor(w * 1.5);
        const heavyCount = Math.floor((w - 1) / 2);
        const isBossWave = (w % 3 === 0);

        for (let i = 0; i < stalkerCount; i++) this.spawnEnemy('stalker');
        for (let i = 0; i < droneCount; i++) this.spawnEnemy('drone');
        for (let i = 0; i < heavyCount; i++) this.spawnEnemy('heavy');

        if (isBossWave) {
            this.spawnEnemy('boss');
            this.showFloatingText("⚠ TRON RECOGNIZER DETECTED ⚠", "#ff0055");
        }

        this.queryDirector();
    }

    spawnEnemy(type) {
        const spawnDist = 180 + Math.random() * 120;
        const spawnAngle = Math.random() * Math.PI * 2;
        const x = this.player.pos.x + Math.cos(spawnAngle) * spawnDist;
        const z = this.player.pos.z + Math.sin(spawnAngle) * spawnDist;

        let hp = 35;
        let speed = 85;
        let radius = 4;
        let color = 0xff0055;
        let mesh;

        if (type === 'stalker') {
            // Tron Light-Cycle Interceptor with glowing red edges
            const geom = new THREE.ConeGeometry(2.4, 7, 4);
            geom.rotateX(Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ color: 0x140308, roughness: 0.2, metalness: 0.8, emissive: 0x1a0005 });
            mesh = new THREE.Mesh(geom, mat);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 2 }));
            mesh.add(edges);

            speed = 115;
            hp = 30;
            radius = 3.5;
            color = 0xff0055;
        } else if (type === 'drone') {
            // Floating 3D Wireframe Icosahedron Bit
            const geom = new THREE.IcosahedronGeometry(3.2, 0);
            const mat = new THREE.MeshStandardMaterial({ color: 0x121002, roughness: 0.2, metalness: 0.8, emissive: 0x1c1600 });
            mesh = new THREE.Mesh(geom, mat);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0xffbb00, linewidth: 2 }));
            mesh.add(edges);

            mesh.position.y = 5.5;
            speed = 75;
            hp = 50;
            radius = 4;
            color = 0xffbb00;
        } else if (type === 'heavy') {
            // Tron Tank
            const group = new THREE.Group();
            const geom = new THREE.BoxGeometry(6, 3, 8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x180502, roughness: 0.3, metalness: 0.8 });
            const body = new THREE.Mesh(geom, mat);
            body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0xff3300 })));
            group.add(body);

            const turretGeom = new THREE.CylinderGeometry(1.8, 2.2, 2, 6);
            const turret = new THREE.Mesh(turretGeom, mat);
            turret.position.y = 2.2;
            turret.add(new THREE.LineSegments(new THREE.EdgesGeometry(turretGeom), new THREE.LineBasicMaterial({ color: 0xff5500 })));
            group.add(turret);

            mesh = group;
            speed = 55;
            hp = 160;
            radius = 6;
            color = 0xff3300;
        } else if (type === 'boss') {
            // Iconic flying Tron Recognizer
            mesh = this.buildTronRecognizerMesh();
            speed = 65;
            hp = 700 + this.wave * 120;
            radius = 16;
            color = 0xff00ff;
        }

        mesh.position.set(x, type === 'boss' ? 14 : 2.0, z);
        this.scene.add(mesh);

        this.enemies.push({
            id: 'e_' + Math.random().toString(36).substring(2, 8),
            type,
            mesh,
            hp,
            maxHp: hp,
            speed,
            radius,
            color,
            shootTimer: Math.random() * 2.0,
            tactic: 'direct_charge',
            isBerserk: false,
            angle: 0,
        });
    }

    buildTronRecognizerMesh() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: 0x16020c,
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x220010
        });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 2 });

        // Bridge
        const topGeom = new THREE.BoxGeometry(30, 5, 14);
        const top = new THREE.Mesh(topGeom, mat);
        top.add(new THREE.LineSegments(new THREE.EdgesGeometry(topGeom), edgeMat));
        group.add(top);

        // Left leg
        const legGeom = new THREE.BoxGeometry(6.5, 18, 12);
        const leftLeg = new THREE.Mesh(legGeom, mat);
        leftLeg.position.set(-12, -9, 0);
        leftLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeom), edgeMat));
        group.add(leftLeg);

        // Right leg
        const rightLeg = new THREE.Mesh(legGeom, mat);
        rightLeg.position.set(12, -9, 0);
        rightLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeom), edgeMat));
        group.add(rightLeg);

        // Center glowing eye
        const eyeGeom = new THREE.BoxGeometry(8, 2.5, 2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const eye = new THREE.Mesh(eyeGeom, eyeMat);
        eye.position.set(0, -1, -7);
        group.add(eye);

        // Downward searchlight beam
        const light = new THREE.PointLight(0xff0055, 3.5, 60);
        light.position.set(0, -12, 0);
        group.add(light);

        return group;
    }

    executePlayerDash() {
        if (this.player.dashCharges < 1 || this.player.isDashing) return;

        this.player.dashCharges--;
        this.player.isDashing = true;
        this.player.dashTimer = 0.22;
        this.player.invulnerableTimer = 0.3;
        this.screenShake = 6;
        window.sounds.playDash();

        let dx = 0, dz = 0;
        if (this.keys['w'] || this.keys['arrowup']) dz -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dz += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        if (dx === 0 && dz === 0) {
            dx = Math.sin(this.player.angle);
            dz = Math.cos(this.player.angle);
        } else {
            const len = Math.hypot(dx, dz);
            dx /= len;
            dz /= len;
        }

        this.player.vel.set(dx * 480, 0, dz * 480);
        this.spawnVoxelBurst(this.player.pos.x, 2.0, this.player.pos.z, 0x00ffff, 20, 45);
    }

    // ==========================================
    // JEV AI QUERIES
    // ==========================================

    async queryEnemyAI(enemy) {
        const dx = this.player.pos.x - enemy.mesh.position.x;
        const dz = this.player.pos.z - enemy.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        const state = {
            enemy_id: enemy.id,
            enemy_type: enemy.type,
            distance_to_player: Math.round(dist),
            player_hp_pct: Math.round((this.player.hp / this.player.maxHp) * 100),
            enemy_hp_pct: Math.round((enemy.hp / enemy.maxHp) * 100),
            player_is_dashing: this.player.isDashing,
            player_is_reloading: this.player.isOverheated,
            bullets_nearby: this.bullets.filter(b => b.mesh.position.distanceTo(enemy.mesh.position) < 80).length,
            allies_alive: this.enemies.length,
            boss_present: this.enemies.some(e => e.type === 'boss'),
        };

        try {
            const res = await fetch(`${API_BASE}/api/ai/enemy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
            });
            if (res.ok) {
                const data = await res.json();
                this.applyEnemyDecision(enemy, data);
                window.jevHud.recordDecision(enemy.type.toUpperCase(), state, data);
            }
        } catch (e) {
            const fakeData = this.emulateJevResponse(state, 'enemy');
            this.applyEnemyDecision(enemy, fakeData);
            window.jevHud.recordDecision(enemy.type.toUpperCase(), state, fakeData);
        }
    }

    applyEnemyDecision(enemy, data) {
        const choice = data.answers?.combat_action?.choice || 'direct_charge';
        const berserkProb = data.answers?.trigger_berserk?.noul || 0;

        enemy.tactic = choice;
        if (berserkProb > 0.65 && !enemy.isBerserk) {
            enemy.isBerserk = true;
            enemy.speed *= 1.4;
            this.showFloatingText("JEV: BERSERK OVERDRIVE", "#ff0055");
        }
    }

    async queryDirector() {
        const state = {
            wave: this.wave,
            player_health: Math.round((this.player.hp / this.player.maxHp) * 100),
            kill_streak: this.enemiesDefeated,
            active_enemies: this.enemies.length,
            overdrive_active: this.player.overdriveTimer > 0,
            infinite_distance_traveled: Math.round(this.player.pos.length()),
        };

        try {
            const res = await fetch(`${API_BASE}/api/ai/director`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
            });
            if (res.ok) {
                const data = await res.json();
                this.applyDirectorDecision(data);
                window.jevHud.recordDecision('DIRECTOR', state, data);
            }
        } catch (e) {
            const fake = this.emulateJevResponse(state, 'director');
            this.applyDirectorDecision(fake);
            window.jevHud.recordDecision('DIRECTOR', state, fake);
        }
    }

    applyDirectorDecision(data) {
        const eventChoice = data.answers?.director_event?.choice || 'tactical_supply_drop';
        const aidProb = data.answers?.grant_emergency_aid?.noul || 0;

        if (eventChoice === 'tactical_supply_drop' || aidProb > 0.7) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 50;
            this.spawnPickup(
                this.player.pos.x + Math.cos(angle) * dist,
                this.player.pos.z + Math.sin(angle) * dist,
                Math.random() > 0.5 ? 'heal' : 'shield'
            );
            this.showFloatingText("DIRECTOR: 3D SUPPLY AIRLIFTED", "#00ffcc");
        } else if (eventChoice === 'laser_hazard_grid') {
            this.triggerLaserWallHazard();
        } else if (eventChoice === 'glitch_overdrive') {
            this.player.overdriveTimer = 6.0;
            this.showFloatingText("OVERDRIVE MATRIX BOOST!", "#ff00ff");
            window.sounds.playPowerup();
        } else if (eventChoice === 'swarming_ambush') {
            this.spawnEnemy('stalker');
            this.spawnEnemy('stalker');
            this.showFloatingText("DIRECTOR: REINFORCEMENTS INBOUND", "#ffaa00");
        }
    }

    async queryBotPilot() {
        let nearestEnemy = null;
        let minDist = 9999;
        this.enemies.forEach(e => {
            const d = this.player.pos.distanceTo(e.mesh.position);
            if (d < minDist) {
                minDist = d;
                nearestEnemy = e;
            }
        });

        const incomingBullets = this.enemyBullets.filter(b =>
            this.player.pos.distanceTo(b.mesh.position) < 80
        ).length;

        const state = {
            player_hp: Math.round(this.player.hp),
            player_shield: Math.round(this.player.shield),
            incoming_bullets_count: incomingBullets,
            distance_to_nearest_enemy: Math.round(minDist),
            dash_charges: this.player.dashCharges,
            is_overheated: this.player.isOverheated,
            pickups_available: this.pickups.length > 0,
        };

        try {
            const res = await fetch(`${API_BASE}/api/ai/bot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
            });
            if (res.ok) {
                const data = await res.json();
                this.applyBotDecision(data, nearestEnemy);
                window.jevHud.recordDecision('AUTOPILOT', state, data);
            }
        } catch (e) {
            const fake = this.emulateJevResponse(state, 'bot');
            this.applyBotDecision(fake, nearestEnemy);
            window.jevHud.recordDecision('AUTOPILOT', state, fake);
        }
    }

    applyBotDecision(data, nearestEnemy) {
        const nav = data.answers?.navigation_action?.choice || 'circle_strafe_cw';
        const target = data.answers?.target_priority?.choice || 'focus_nearest';
        const fireNoul = data.answers?.trigger_fire?.noul || 0.85;
        const dashNoul = data.answers?.trigger_dash?.noul || 0.2;

        this.botIntent = {
            nav,
            targetPriority: target,
            fire: fireNoul > 0.5,
            dash: dashNoul > 0.7,
        };

        if (dashNoul > 0.75 && this.player.dashCharges > 0) {
            this.executePlayerDash();
        }

        if (nearestEnemy) {
            this.aimPoint.copy(nearestEnemy.mesh.position);
        }
    }

    emulateJevResponse(state, system) {
        const start = performance.now();
        const answers = {};

        if (system === 'enemy') {
            const choices = ['flank_left', 'flank_right', 'direct_charge', 'take_cover', 'suppressive_fire'];
            const chosen = choices[Math.floor(Math.random() * choices.length)];
            answers['combat_action'] = {
                choice: chosen,
                confidence: 0.84,
                probabilities: { flank_left: 0.22, flank_right: 0.22, direct_charge: 0.38, take_cover: 0.08, suppressive_fire: 0.1 }
            };
            answers['threat_assessment'] = {
                score: 2,
                confidence: 0.78,
                legend: { 0: 'minimal', 1: 'moderate', 2: 'high', 3: 'critical', 4: 'fatal' }
            };
            answers['trigger_berserk'] = { noul: state.enemy_hp_pct < 40 ? 0.85 : 0.2 };
        } else if (system === 'director') {
            answers['director_event'] = {
                choice: state.player_health < 40 ? 'tactical_supply_drop' : 'laser_hazard_grid',
                confidence: 0.89,
                probabilities: { tactical_supply_drop: 0.45, laser_hazard_grid: 0.35, swarming_ambush: 0.2 }
            };
            answers['pacing_tension'] = {
                score: 2,
                confidence: 0.81,
                legend: { 0: 'calm', 1: 'rising', 2: 'climax', 3: 'apocalyptic' }
            };
            answers['grant_emergency_aid'] = { noul: state.player_health < 35 ? 0.92 : 0.1 };
        } else if (system === 'bot') {
            answers['navigation_action'] = {
                choice: state.incoming_bullets_count > 1 ? 'circle_strafe_ccw' : 'circle_strafe_cw',
                confidence: 0.82,
                probabilities: { circle_strafe_cw: 0.45, circle_strafe_ccw: 0.4, retreat_open_space: 0.15 }
            };
            answers['trigger_fire'] = { noul: 0.94 };
            answers['trigger_dash'] = { noul: state.incoming_bullets_count > 1 ? 0.88 : 0.12 };
        }

        return {
            success: true,
            is_simulated: true,
            model: 'jev-latest (3D client-emulation)',
            latency_ms: Math.round(performance.now() - start + 4),
            answers,
        };
    }

    triggerLaserWallHazard() {
        const isHorizontal = Math.random() > 0.5;
        const length = 280;
        const wallGeom = new THREE.BoxGeometry(isHorizontal ? length : 1.5, 14, isHorizontal ? 1.5 : length);
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0xff0055,
            transparent: true,
            opacity: 0.75,
        });
        const wallMesh = new THREE.Mesh(wallGeom, wallMat);

        const offsetDist = 80;
        wallMesh.position.set(
            this.player.pos.x + (isHorizontal ? 0 : (Math.random() > 0.5 ? offsetDist : -offsetDist)),
            7,
            this.player.pos.z + (isHorizontal ? (Math.random() > 0.5 ? offsetDist : -offsetDist) : 0)
        );
        this.scene.add(wallMesh);

        this.activeHazards.push({
            mesh: wallMesh,
            warningTimer: 1.5,
            activeTimer: 3.5,
            isHorizontal,
        });

        this.showFloatingText("⚠ SECTOR DEFENSE LASER GRID ⚠", "#ff0055");
        window.sounds.playAlert();
    }

    spawnPickup(x, z, type) {
        const geom = new THREE.OctahedronGeometry(2.5, 0);
        let color = 0x00ffff;
        if (type === 'shield') color = 0x0088ff;
        else if (type === 'overdrive') color = 0xff00ff;
        else if (type === 'nuke') color = 0xffff00;

        const mat = new THREE.MeshStandardMaterial({
            color: 0x040e15,
            roughness: 0.1,
            metalness: 0.9,
            emissive: color,
        });
        const mesh = new THREE.Mesh(geom, mat);
        const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color }));
        mesh.add(wire);
        mesh.position.set(x, 2.5, z);
        this.scene.add(mesh);

        this.pickups.push({
            mesh,
            type,
            life: 20.0,
            pulse: 0,
        });
    }

    showFloatingText(text, color = '#ffffff') {
        const msg = document.createElement('div');
        msg.className = 'floating-3d-msg';
        msg.style.position = 'absolute';
        msg.style.top = '75px';
        msg.style.left = '50%';
        msg.style.transform = 'translateX(-50%)';
        msg.style.color = color;
        msg.style.fontFamily = "'Orbitron', sans-serif";
        msg.style.fontSize = '0.9rem';
        msg.style.letterSpacing = '1px';
        msg.style.fontWeight = 'bold';
        msg.style.textShadow = '0 0 10px ' + color;
        msg.style.pointerEvents = 'none';
        msg.style.transition = 'all 0.8s ease-out';
        msg.textContent = text;
        this.container.appendChild(msg);

        setTimeout(() => {
            msg.style.top = '40px';
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 800);
        }, 1000);
    }

    // ==========================================
    // UPDATE & 3D LOOP
    // ==========================================

    update(dt) {
        if (this.isGameOver) return;

        if (this.screenShake > 0) {
            this.screenShake -= dt * 25;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        // Director Timer
        this.directorTimer += dt;
        if (this.directorTimer >= this.directorCooldown) {
            this.directorTimer = 0;
            this.queryDirector();
        }

        // Raycasting for Mouse Aim on 3D Ground Plane (Y = 0)
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);

        // Player Dash Timers
        if (this.player.isDashing) {
            this.player.dashTimer -= dt;
            this.player.pos.addScaledVector(this.player.vel, dt);
            if (this.player.dashTimer <= 0) this.player.isDashing = false;
        }
        if (this.player.invulnerableTimer > 0) {
            this.player.invulnerableTimer -= dt;
        }

        // Dash Recharge
        if (this.player.dashCharges < this.player.maxDashCharges) {
            this.player.dashRechargeTimer += dt;
            if (this.player.dashRechargeTimer >= 2.2) {
                this.player.dashCharges++;
                this.player.dashRechargeTimer = 0;
            }
        }

        // Shield Recharge
        this.player.shieldRechargeTimer += dt;
        if (this.player.shieldRechargeTimer > 3.0 && this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 28 * dt);
        }

        // Weapon Heat
        if (this.player.isOverheated) {
            this.player.heat -= 48 * dt;
            if (this.player.heat <= 0) {
                this.player.heat = 0;
                this.player.isOverheated = false;
            }
        } else {
            this.player.heat = Math.max(0, this.player.heat - 38 * dt);
        }

        if (this.player.overdriveTimer > 0) {
            this.player.overdriveTimer -= dt;
        }

        // Movement: Manual vs Jev Autopilot
        if (this.autoPilot) {
            this.botDecisionTimer += dt;
            if (this.botDecisionTimer >= 0.16) {
                this.botDecisionTimer = 0;
                this.queryBotPilot();
            }
            this.updateAutoPilotMovement(dt);
        } else {
            this.updateManualMovement(dt);
        }

        // Smooth Craft Banking & Hovering
        this.playerGroup.position.copy(this.player.pos);
        this.playerGroup.position.y = 2.2 + Math.sin(performance.now() * 0.005) * 0.35;
        this.playerGroup.rotation.y = this.player.angle;
        this.playerGroup.rotation.z = this.player.bankAngle;

        // Under-glow follows player on ground
        this.playerUnderGlow.position.x = this.player.pos.x;
        this.playerUnderGlow.position.z = this.player.pos.z;

        // Shield Mesh rotation
        if (this.shieldMesh) {
            this.shieldMesh.visible = (this.player.shield > 0);
            this.shieldMat.opacity = Math.min(0.25, (this.player.shield / this.player.maxShield) * 0.2);
            this.shieldMesh.rotation.y += dt * 2.0;
        }

        // Update Light Ribbon Trail
        this.updatePlayerLightTrail();

        // Infinite Grid Position Snapping
        const cell = this.gridCellSize;
        this.gridHelper.position.x = Math.floor(this.player.pos.x / cell) * cell;
        this.gridHelper.position.z = Math.floor(this.player.pos.z / cell) * cell;
        this.subGridHelper.position.x = Math.floor(this.player.pos.x / (cell * 2)) * (cell * 2);
        this.subGridHelper.position.z = Math.floor(this.player.pos.z / (cell * 2)) * (cell * 2);

        // Distant Skyline follows player smoothly so it stays on horizon
        this.skylineGroup.position.x = this.player.pos.x;
        this.skylineGroup.position.z = this.player.pos.z;

        // Player Firing
        this.player.fireCooldown -= dt;
        const wantFire = this.autoPilot ? this.botIntent.fire : this.isMouseDown;
        if (wantFire && this.player.fireCooldown <= 0 && !this.player.isOverheated) {
            this.firePlayerWeapon();
        }

        // Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.mesh.position.addScaledVector(b.vel, dt);
            b.life -= dt;

            let hit = false;
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const d = b.mesh.position.distanceTo(e.mesh.position);
                if (d < b.radius + e.radius) {
                    e.hp -= b.damage;
                    this.spawnVoxelBurst(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, b.color, 6, 25);
                    window.sounds.playShieldHit();

                    if (e.hp <= 0) {
                        this.destroyEnemy(e, j);
                    }
                    this.scene.remove(b.mesh);
                    this.bullets.splice(i, 1);
                    hit = true;
                    break;
                }
            }

            if (!hit && b.life <= 0) {
                this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
            }
        }

        // Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.mesh.position.addScaledVector(b.vel, dt);
            b.life -= dt;

            const d = b.mesh.position.distanceTo(this.player.pos);
            if (d < b.radius + 3.0 && this.player.invulnerableTimer <= 0) {
                this.damagePlayer(b.damage);
                this.spawnVoxelBurst(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 0xff0055, 8, 30);
                this.scene.remove(b.mesh);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (b.life <= 0) {
                this.scene.remove(b.mesh);
                this.enemyBullets.splice(i, 1);
            }
        }

        // Enemies
        this.enemyDecisionTimer += dt;
        const triggerEnemyJev = (this.enemyDecisionTimer >= 0.7);
        if (triggerEnemyJev) this.enemyDecisionTimer = 0;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (triggerEnemyJev && Math.random() > 0.4) {
                this.queryEnemyAI(e);
            }
            this.updateEnemy(e, dt);

            const d = e.mesh.position.distanceTo(this.player.pos);
            if (d < e.radius + 3.0 && this.player.invulnerableTimer <= 0) {
                this.damagePlayer(25);
                this.screenShake = 10;
                const push = new THREE.Vector3().subVectors(this.player.pos, e.mesh.position).normalize().multiplyScalar(30);
                this.player.pos.add(push);
            }
        }

        // Pickups
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.life -= dt;
            p.pulse += dt * 3;
            p.mesh.position.y = 2.5 + Math.sin(p.pulse) * 0.8;
            p.mesh.rotation.y += dt * 2.0;
            p.mesh.rotation.x += dt * 1.5;

            const d = p.mesh.position.distanceTo(this.player.pos);
            if (d < 6.0) {
                this.collectPickup(p);
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
            }
        }

        // Voxel Particles
        for (let i = this.voxelParticles.length - 1; i >= 0; i--) {
            const p = this.voxelParticles[i];
            p.mesh.position.addScaledVector(p.vel, dt);
            p.mesh.rotation.x += p.rotSpeed;
            p.mesh.rotation.y += p.rotSpeed;
            p.life -= dt;

            const scale = Math.max(0.01, p.life / p.maxLife);
            p.mesh.scale.set(scale, scale, scale);

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.voxelParticles.splice(i, 1);
            }
        }

        // Active Laser Hazards
        for (let i = this.activeHazards.length - 1; i >= 0; i--) {
            const h = this.activeHazards[i];
            if (h.warningTimer > 0) {
                h.warningTimer -= dt;
                h.mesh.material.opacity = 0.3 + Math.sin(performance.now() * 0.02) * 0.2;
            } else if (h.activeTimer > 0) {
                h.activeTimer -= dt;
                h.mesh.material.opacity = 0.85;

                if (this.player.invulnerableTimer <= 0) {
                    const dist = this.player.pos.distanceTo(h.mesh.position);
                    if (dist < 140 && (Math.abs(this.player.pos.x - h.mesh.position.x) < 5 || Math.abs(this.player.pos.z - h.mesh.position.z) < 5)) {
                        this.damagePlayer(45 * dt);
                    }
                }
            } else {
                this.scene.remove(h.mesh);
                this.activeHazards.splice(i, 1);
            }
        }

        // Wave Completion
        if (this.enemies.length === 0) {
            this.startWave(this.wave + 1);
        }

        // Camera Follow
        this.updateCameraPos(dt);

        // Render 2D Radar & Update HUD
        this.renderRadar();
        this.updateHUD();
    }

    updateManualMovement(dt) {
        let dx = 0, dz = 0;
        if (this.keys['w'] || this.keys['arrowup']) dz -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dz += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        const moveVec = new THREE.Vector3(dx, 0, dz);
        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();
            const spd = this.player.overdriveTimer > 0 ? this.player.speed * 1.4 : this.player.speed;
            this.player.pos.addScaledVector(moveVec, spd * dt);
        }

        // Aim towards 3D ground hit point
        const aimDx = this.aimPoint.x - this.player.pos.x;
        const aimDz = this.aimPoint.z - this.player.pos.z;
        this.player.targetAngle = Math.atan2(aimDx, aimDz);

        let diff = this.player.targetAngle - this.player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.player.angle += diff * Math.min(1.0, dt * 14);

        const targetBank = -dx * 0.45;
        this.player.bankAngle += (targetBank - this.player.bankAngle) * Math.min(1.0, dt * 10);
    }

    updateAutoPilotMovement(dt) {
        let nearest = null;
        let minDist = 9999;
        this.enemies.forEach(e => {
            const d = this.player.pos.distanceTo(e.mesh.position);
            if (d < minDist) { minDist = d; nearest = e; }
        });

        let moveAng = 0;
        if (nearest) {
            const angToEnemy = Math.atan2(nearest.mesh.position.x - this.player.pos.x, nearest.mesh.position.z - this.player.pos.z);
            const nav = this.botIntent.nav;
            if (nav === 'circle_strafe_cw') {
                moveAng = angToEnemy + Math.PI / 2;
                if (minDist < 60) moveAng += Math.PI / 4;
            } else if (nav === 'circle_strafe_ccw') {
                moveAng = angToEnemy - Math.PI / 2;
                if (minDist < 60) moveAng -= Math.PI / 4;
            } else if (nav === 'retreat_open_space') {
                moveAng = angToEnemy + Math.PI;
            } else if (nav === 'rush_pickup' && this.pickups.length > 0) {
                const p = this.pickups[0];
                moveAng = Math.atan2(p.mesh.position.x - this.player.pos.x, p.mesh.position.z - this.player.pos.z);
            } else {
                moveAng = angToEnemy;
            }
        }

        this.enemyBullets.forEach(b => {
            if (this.player.pos.distanceTo(b.mesh.position) < 50) {
                moveAng = Math.atan2(this.player.pos.x - b.mesh.position.x, this.player.pos.z - b.mesh.position.z);
            }
        });

        const spd = this.player.speed * (this.player.overdriveTimer > 0 ? 1.4 : 1.15);
        this.player.pos.x += Math.sin(moveAng) * spd * dt;
        this.player.pos.z += Math.cos(moveAng) * spd * dt;

        if (nearest) {
            const aimDx = nearest.mesh.position.x - this.player.pos.x;
            const aimDz = nearest.mesh.position.z - this.player.pos.z;
            this.player.targetAngle = Math.atan2(aimDx, aimDz);
            let diff = this.player.targetAngle - this.player.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.player.angle += diff * Math.min(1.0, dt * 14);
        }
    }

    firePlayerWeapon() {
        const isOverdrive = this.player.overdriveTimer > 0;
        this.player.fireCooldown = isOverdrive ? 0.08 : 0.15;
        this.player.heat = Math.min(100, this.player.heat + (isOverdrive ? 2 : 7));

        if (this.player.heat >= 100) {
            this.player.isOverheated = true;
            this.showFloatingText("WEAPONS OVERHEATED!", "#ff0055");
            window.sounds.playAlert();
        }

        // 3D Glowing Tron Projectile (Neon laser cylinder)
        const bGeom = new THREE.CylinderGeometry(0.35, 0.35, 4.0, 6);
        bGeom.rotateX(Math.PI / 2);
        const bMat = new THREE.MeshBasicMaterial({ color: isOverdrive ? 0xff00ff : 0x00ffff });
        const bMesh = new THREE.Mesh(bGeom, bMat);

        const spawnPos = this.player.pos.clone().add(new THREE.Vector3(
            Math.sin(this.player.angle) * 4.0,
            2.0,
            Math.cos(this.player.angle) * 4.0
        ));
        bMesh.position.copy(spawnPos);
        bMesh.rotation.y = this.player.angle;
        this.scene.add(bMesh);

        const bSpeed = 400;
        const spread = (Math.random() - 0.5) * 0.04;
        const fireAng = this.player.angle + spread;

        this.bullets.push({
            mesh: bMesh,
            vel: new THREE.Vector3(Math.sin(fireAng) * bSpeed, 0, Math.cos(fireAng) * bSpeed),
            radius: 2.5,
            damage: isOverdrive ? 45 : 25,
            color: isOverdrive ? 0xff00ff : 0x00ffff,
            life: 1.8,
        });

        window.sounds.playLaser();
        this.screenShake = 1.5;
    }

    updateEnemy(e, dt) {
        const dx = this.player.pos.x - e.mesh.position.x;
        const dz = this.player.pos.z - e.mesh.position.z;
        let ang = Math.atan2(dx, dz);

        if (e.tactic === 'flank_left') {
            ang += Math.PI / 3;
        } else if (e.tactic === 'flank_right') {
            ang -= Math.PI / 3;
        } else if (e.tactic === 'take_cover') {
            ang += Math.PI;
        }

        e.mesh.position.x += Math.sin(ang) * e.speed * dt;
        e.mesh.position.z += Math.cos(ang) * e.speed * dt;
        e.mesh.rotation.y = ang;

        if (e.type === 'drone') {
            e.mesh.position.y = 5.5 + Math.sin(performance.now() * 0.005 + e.mesh.position.x) * 1.5;
            e.mesh.rotation.x += dt * 1.5;
            e.mesh.rotation.z += dt * 1.5;
        }

        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
            if (e.type === 'drone') {
                e.shootTimer = 1.8 + Math.random() * 0.8;
                this.fireEnemyBullet(e.mesh.position, ang, 160, 15, 0xffbb00);
            } else if (e.type === 'heavy') {
                e.shootTimer = 2.4;
                for (let off = -0.22; off <= 0.22; off += 0.22) {
                    this.fireEnemyBullet(e.mesh.position, ang + off, 180, 20, 0xff0055);
                }
                window.sounds.playHeavyLaser();
            } else if (e.type === 'boss') {
                e.shootTimer = 1.2;
                const count = 12;
                for (let r = 0; r < count; r++) {
                    const ringAng = (r / count) * Math.PI * 2 + performance.now() * 0.001;
                    this.fireEnemyBullet(e.mesh.position, ringAng, 140, 22, 0xff00ff);
                }
                window.sounds.playHeavyLaser();
            }
        }
    }

    fireEnemyBullet(pos, angle, speed, damage, color) {
        const geom = new THREE.SphereGeometry(1.2, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        this.enemyBullets.push({
            mesh,
            vel: new THREE.Vector3(Math.sin(angle) * speed, 0, Math.cos(angle) * speed),
            radius: 2.0,
            damage,
            color,
            life: 4.5,
        });
    }

    damagePlayer(amount) {
        this.player.shieldRechargeTimer = 0;
        if (this.player.shield > 0) {
            const absorbed = Math.min(this.player.shield, amount);
            this.player.shield -= absorbed;
            amount -= absorbed;
            window.sounds.playShieldHit();
        }

        if (amount > 0) {
            this.player.hp -= amount;
            this.screenShake = 12;
            window.sounds.playExplosion();

            if (this.player.hp <= 0) {
                this.player.hp = 0;
                this.gameOver();
            }
        }
    }

    destroyEnemy(e, index) {
        this.scene.remove(e.mesh);
        this.enemies.splice(index, 1);
        this.enemiesDefeated++;
        this.score += (e.type === 'boss' ? 3000 : (e.type === 'heavy' ? 500 : 120));

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_high_score', this.highScore.toString());
        }

        this.spawnVoxelBurst(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, e.color, 32, 60);
        window.sounds.playExplosion();

        if (Math.random() < 0.25 || e.type === 'boss') {
            const types = ['heal', 'shield', 'overdrive', 'nuke'];
            const pType = types[Math.floor(Math.random() * types.length)];
            this.spawnPickup(e.mesh.position.x, e.mesh.position.z, pType);
        }
    }

    collectPickup(p) {
        window.sounds.playPowerup();
        if (p.type === 'heal') {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
            this.showFloatingText("+40 REPAIR", "#00ffcc");
        } else if (p.type === 'shield') {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 60);
            this.showFloatingText("+60 SHIELD", "#0088ff");
        } else if (p.type === 'overdrive') {
            this.player.overdriveTimer = 8.0;
            this.showFloatingText("OVERDRIVE SURGE", "#ff00ff");
        } else if (p.type === 'nuke') {
            this.screenShake = 22;
            this.enemies.forEach(e => {
                if (e.type !== 'boss') {
                    e.hp = 0;
                    this.spawnVoxelBurst(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, 0x00ffff, 20, 50);
                    this.scene.remove(e.mesh);
                }
            });
            this.enemies = this.enemies.filter(e => e.hp > 0);
            this.showFloatingText("GRID PURGE DETONATED", "#ffffff");
            window.sounds.playExplosion();
        }
    }

    spawnVoxelBurst(x, y, z, color, count = 24, maxSpeed = 50) {
        const boxGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshBasicMaterial({ color });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(boxGeom, mat);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);

            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI;
            const spd = 10 + Math.random() * maxSpeed;

            this.voxelParticles.push({
                mesh,
                vel: new THREE.Vector3(
                    Math.cos(theta) * Math.cos(phi) * spd,
                    Math.sin(phi) * spd + 15,
                    Math.sin(theta) * Math.cos(phi) * spd
                ),
                rotSpeed: (Math.random() - 0.5) * 8,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0,
            });
        }
    }

    updateCameraPos(dt = 0.016) {
        let targetCamPos;
        const zoom = this.camZoom;

        if (this.cameraMode === 'chase') {
            // Low-angle 3D Chase Cam (iconic 3D Tron depth looking towards horizon)
            const height = zoom * this.camPitch;
            const dist = zoom * (1.0 - this.camPitch * 0.4);

            targetCamPos = new THREE.Vector3(
                this.player.pos.x - Math.sin(this.player.angle) * dist,
                height,
                this.player.pos.z - Math.cos(this.player.angle) * dist
            );
        } else if (this.cameraMode === 'tactical') {
            // Elevated Top-Down Tactical Cam
            targetCamPos = new THREE.Vector3(
                this.player.pos.x,
                zoom * 1.5,
                this.player.pos.z + zoom * 0.7
            );
        } else {
            // Cockpit First-Person Cam
            targetCamPos = new THREE.Vector3(
                this.player.pos.x + Math.sin(this.player.angle) * 1.5,
                3.2,
                this.player.pos.z + Math.cos(this.player.angle) * 1.5
            );
        }

        if (this.screenShake > 0) {
            targetCamPos.x += (Math.random() - 0.5) * this.screenShake;
            targetCamPos.y += (Math.random() - 0.5) * this.screenShake;
            targetCamPos.z += (Math.random() - 0.5) * this.screenShake;
        }

        this.camera.position.lerp(targetCamPos, Math.min(1.0, dt * 7.0));

        if (this.cameraMode === 'cockpit') {
            const lookTarget = this.player.pos.clone().add(new THREE.Vector3(
                Math.sin(this.player.angle) * 80,
                2.0,
                Math.cos(this.player.angle) * 80
            ));
            this.camera.lookAt(lookTarget);
        } else {
            this.camera.lookAt(this.player.pos.x, 2.5, this.player.pos.z);
        }
    }

    renderRadar() {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radarRadius = w / 2 - 4;
        const worldRadarRange = 360;

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radarRadius * 0.33, 0, Math.PI * 2);
        ctx.arc(cx, cy, radarRadius * 0.66, 0, Math.PI * 2);
        ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, 4); ctx.lineTo(cx, h - 4);
        ctx.moveTo(4, cy); ctx.lineTo(w - 4, cy);
        ctx.stroke();

        // Pickups
        this.pickups.forEach(p => {
            const rx = (p.mesh.position.x - this.player.pos.x) / worldRadarRange;
            const rz = (p.mesh.position.z - this.player.pos.z) / worldRadarRange;
            if (Math.hypot(rx, rz) <= 1.0) {
                ctx.fillStyle = '#00ffff';
                ctx.fillRect(cx + rx * radarRadius - 2, cy + rz * radarRadius - 2, 4, 4);
            }
        });

        // Enemies
        this.enemies.forEach(e => {
            const rx = (e.mesh.position.x - this.player.pos.x) / worldRadarRange;
            const rz = (e.mesh.position.z - this.player.pos.z) / worldRadarRange;
            if (Math.hypot(rx, rz) <= 1.0) {
                ctx.fillStyle = e.type === 'boss' ? '#ff00ff' : (e.type === 'heavy' ? '#ff3300' : '#ff0055');
                const sz = e.type === 'boss' ? 6 : (e.type === 'heavy' ? 4 : 3);
                ctx.beginPath();
                ctx.arc(cx + rx * radarRadius, cy + rz * radarRadius, sz, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Player heading
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-this.player.angle + Math.PI);
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    updateHUD() {
        const hpBar = document.getElementById('hud-hp-bar');
        const hpVal = document.getElementById('hud-hp-val');
        const shieldBar = document.getElementById('hud-shield-bar');
        const shieldVal = document.getElementById('hud-shield-val');
        const heatBar = document.getElementById('hud-heat-bar');
        const dashDots = document.getElementById('hud-dash-dots');
        const scoreEl = document.getElementById('hud-score');
        const waveEl = document.getElementById('hud-wave');
        const coordEl = document.getElementById('coord-display');

        if (hpBar) hpBar.style.width = `${Math.round(this.player.hp)}%`;
        if (hpVal) hpVal.textContent = Math.round(this.player.hp);
        if (shieldBar) shieldBar.style.width = `${Math.round(this.player.shield)}%`;
        if (shieldVal) shieldVal.textContent = Math.round(this.player.shield);

        if (heatBar) {
            heatBar.style.width = `${Math.round(this.player.heat)}%`;
            heatBar.style.backgroundColor = this.player.isOverheated ? '#ff0055' : '#ffbb00';
        }

        if (dashDots) {
            dashDots.innerHTML = '';
            for (let i = 0; i < this.player.maxDashCharges; i++) {
                const d = document.createElement('span');
                d.className = `dash-dot ${i < this.player.dashCharges ? 'charged' : ''}`;
                dashDots.appendChild(d);
            }
        }

        if (scoreEl) scoreEl.textContent = this.score;
        if (waveEl) waveEl.textContent = this.wave;

        if (coordEl) {
            const x = Math.round(this.player.pos.x);
            const z = Math.round(this.player.pos.z);
            coordEl.textContent = `GRID: X: ${x} | Z: ${z} | BOUNDS: ∞ INFINITE`;
        }
    }

    gameOver() {
        this.isGameOver = true;
        window.sounds.playAlert();
        const overEl = document.getElementById('game-over-modal');
        const finalScore = document.getElementById('final-score');
        const finalWave = document.getElementById('final-wave');
        if (finalScore) finalScore.textContent = this.score;
        if (finalWave) finalWave.textContent = this.wave;
        if (overEl) overEl.classList.add('active');
    }

    loop() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.update(dt);
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => this.loop());
    }
}

// Robust auto-boot across all DOM states
function bootGame() {
    if (!window.game) {
        console.log("🎮 Initializing TronCyberGame 3D Engine...");
        window.game = new TronCyberGame();
        window.game.loop();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGame);
} else {
    bootGame();
}
