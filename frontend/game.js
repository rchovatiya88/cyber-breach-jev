/**
 * CYBER-BREACH: THE JEV PROTOCOL
 * 60 FPS HTML5 Canvas Arena Shooter powered by TypeSafe AI's Jev Model
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : 'http://localhost:8000';

class CyberGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = 860;
        this.height = this.canvas.height = 640;

        // Game State
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_high_score') || '0', 10);
        this.wave = 1;
        this.enemiesDefeated = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.autoPilot = false;
        this.screenShake = 0;
        this.lastTime = performance.now();

        // Director
        this.directorCooldown = 6.0;
        this.directorTimer = 0;
        this.activeHazards = [];

        // Player
        this.player = {
            x: this.width / 2,
            y: this.height / 2,
            radius: 16,
            angle: 0,
            speed: 260,
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
            lastDamageTime: 0,
        };

        // Collections
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.particles = [];
        this.pickups = [];
        this.floatingTexts = [];

        // Inputs
        this.keys = {};
        this.mouse = { x: this.width / 2, y: this.height / 2, down: false };

        // Jev Decision Loop Timers
        this.enemyDecisionTimer = 0;
        this.botDecisionTimer = 0;
        this.botIntent = {
            nav: "circle_strafe_cw",
            targetPriority: "focus_nearest",
            fire: true,
            dash: false,
            urgency: 0.3
        };

        this.initEvents();
        this.checkBackendHealth();
        this.startWave(1);
    }

    initEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;

            if (e.key.toLowerCase() === 'p') {
                this.toggleAutoPilot();
            }
            if (e.key.toLowerCase() === 'm') {
                const on = window.sounds.toggleMusic();
                this.showFloatingText(this.player.x, this.player.y - 30, `MUSIC: ${on ? 'ON' : 'OFF'}`, '#00ffcc');
            }
            if (e.key.toLowerCase() === 'n') {
                const on = window.sounds.toggleSound();
                this.showFloatingText(this.player.x, this.player.y - 30, `SFX: ${on ? 'ON' : 'OFF'}`, '#00ffcc');
            }
            if (e.key.toLowerCase() === 'c') {
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
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouse.down = true;
                window.sounds.init();
                window.sounds.startMusic();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouse.down = false;
            }
        });
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
            window.jevHud.updateConfigStatus({ is_live: false, model: "jev-latest (embedded)" });
        }
    }

    toggleAutoPilot() {
        this.autoPilot = !this.autoPilot;
        const btn = document.getElementById('btn-autopilot');
        if (btn) {
            btn.classList.toggle('active', this.autoPilot);
            btn.textContent = this.autoPilot ? "⚡ JEV AUTOPILOT: ENGAGED [P]" : "🤖 JEV AUTOPILOT: OFF [P]";
        }
        this.showFloatingText(
            this.player.x,
            this.player.y - 40,
            this.autoPilot ? "JEV PROTOCOL ENGAGED" : "MANUAL CONTROL RESTORED",
            this.autoPilot ? "#00ffcc" : "#ffbb00"
        );
        window.sounds.playAlert();
    }

    restartGame() {
        this.score = 0;
        this.wave = 1;
        this.enemiesDefeated = 0;
        this.isGameOver = false;
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.particles = [];
        this.pickups = [];
        this.floatingTexts = [];
        this.activeHazards = [];

        this.player.x = this.width / 2;
        this.player.y = this.height / 2;
        this.player.hp = this.player.maxHp;
        this.player.shield = this.player.maxShield;
        this.player.dashCharges = 2;
        this.player.heat = 0;
        this.player.isOverheated = false;

        const overEl = document.getElementById('game-over-modal');
        if (overEl) overEl.classList.remove('active');

        this.startWave(1);
    }

    startWave(w) {
        this.wave = w;
        window.sounds.playAlert();
        this.showFloatingText(this.width / 2, this.height / 2 - 60, `WAVE ${w} INBOUND`, '#00ffff');

        // Spawn enemies based on wave number
        const stalkerCount = 2 + w * 2;
        const droneCount = Math.floor(w * 1.5);
        const heavyCount = Math.floor((w - 1) / 2);
        const isBossWave = (w % 3 === 0);

        for (let i = 0; i < stalkerCount; i++) this.spawnEnemy('stalker');
        for (let i = 0; i < droneCount; i++) this.spawnEnemy('drone');
        for (let i = 0; i < heavyCount; i++) this.spawnEnemy('heavy');

        if (isBossWave) {
            this.spawnEnemy('boss');
            this.showFloatingText(this.width / 2, this.height / 2, "⚠ APEX-JEV DETECTED ⚠", "#ff0055");
        }

        // Query Jev Game Director for wave kickoff
        this.queryDirector();
    }

    spawnEnemy(type) {
        let x, y;
        const edge = Math.floor(Math.random() * 4);
        const padding = 30;

        if (edge === 0) { x = Math.random() * this.width; y = -padding; }
        else if (edge === 1) { x = this.width + padding; y = Math.random() * this.height; }
        else if (edge === 2) { x = Math.random() * this.width; y = this.height + padding; }
        else { x = -padding; y = Math.random() * this.height; }

        let hp = 30;
        let speed = 150;
        let radius = 14;
        let color = '#00ffaa';

        if (type === 'drone') {
            hp = 45;
            speed = 100;
            radius = 16;
            color = '#ffcc00';
        } else if (type === 'heavy') {
            hp = 140;
            speed = 70;
            radius = 24;
            color = '#ff0055';
        } else if (type === 'boss') {
            hp = 600 + this.wave * 100;
            speed = 85;
            radius = 38;
            color = '#ff00aa';
            x = this.width / 2;
            y = -60;
        }

        this.enemies.push({
            id: 'e_' + Math.random().toString(36).substring(2, 8),
            type,
            x,
            y,
            vx: 0,
            vy: 0,
            hp,
            maxHp: hp,
            speed,
            radius,
            color,
            shootTimer: Math.random() * 2.0,
            tactic: 'charge',
            isBerserk: false,
            angle: 0,
        });
    }

    executePlayerDash() {
        if (this.player.dashCharges < 1 || this.player.isDashing) return;

        this.player.dashCharges--;
        this.player.isDashing = true;
        this.player.dashTimer = 0.18;
        this.player.invulnerableTimer = 0.25;
        this.screenShake = 6;
        window.sounds.playDash();

        // Calculate dash direction based on keys, or facing angle
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        if (dx === 0 && dy === 0) {
            dx = Math.cos(this.player.angle);
            dy = Math.sin(this.player.angle);
        } else {
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;
        }

        this.player.dashVx = dx * 650;
        this.player.dashVy = dy * 650;

        // Spawn dash particles
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: this.player.x + (Math.random() - 0.5) * 20,
                y: this.player.y + (Math.random() - 0.5) * 20,
                vx: -dx * (100 + Math.random() * 150),
                vy: -dy * (100 + Math.random() * 150),
                radius: 4,
                color: '#00ffff',
                life: 0.25,
                maxLife: 0.25,
            });
        }
    }

    // ==========================================
    // JEV AI QUERIES
    // ==========================================

    async queryEnemyAI(enemy) {
        const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
        const state = {
            enemy_id: enemy.id,
            enemy_type: enemy.type,
            distance_to_player: Math.round(dist),
            player_hp_pct: Math.round((this.player.hp / this.player.maxHp) * 100),
            enemy_hp_pct: Math.round((enemy.hp / enemy.maxHp) * 100),
            player_is_dashing: this.player.isDashing,
            player_is_reloading: this.player.isOverheated,
            bullets_nearby: this.bullets.filter(b => Math.hypot(b.x - enemy.x, b.y - enemy.y) < 180).length,
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
            // Local fallback
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
            this.showFloatingText(enemy.x, enemy.y - 20, "JEV: BERSERK", "#ff0055");
        }
    }

    async queryDirector() {
        const state = {
            wave: this.wave,
            player_health: Math.round((this.player.hp / this.player.maxHp) * 100),
            kill_streak: this.enemiesDefeated,
            active_enemies: this.enemies.length,
            overdrive_active: this.player.overdriveTimer > 0,
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
            this.spawnPickup(
                Math.random() * (this.width - 160) + 80,
                Math.random() * (this.height - 160) + 80,
                Math.random() > 0.5 ? 'heal' : 'shield'
            );
            this.showFloatingText(this.width / 2, 70, "DIRECTOR: SUPPLY DROP AIRLIFTED", "#00ffcc");
        } else if (eventChoice === 'laser_hazard_grid') {
            this.triggerLaserHazard();
        } else if (eventChoice === 'glitch_overdrive') {
            this.player.overdriveTimer = 6.0;
            this.showFloatingText(this.player.x, this.player.y - 30, "OVERDRIVE SURGE!", "#ff00ff");
            window.sounds.playPowerup();
        } else if (eventChoice === 'swarming_ambush') {
            this.spawnEnemy('stalker');
            this.spawnEnemy('stalker');
            this.showFloatingText(this.width / 2, 70, "DIRECTOR: REINFORCEMENTS DETECTED", "#ffaa00");
        }
    }

    async queryBotPilot() {
        let nearestEnemy = null;
        let minDist = 9999;
        this.enemies.forEach(e => {
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d < minDist) {
                minDist = d;
                nearestEnemy = e;
            }
        });

        const incomingBullets = this.enemyBullets.filter(b =>
            Math.hypot(b.x - this.player.x, b.y - this.player.y) < 140
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
        const fireNoul = data.answers?.trigger_fire?.noul || 0.8;
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

        // Aim towards target
        if (nearestEnemy) {
            this.player.angle = Math.atan2(nearestEnemy.y - this.player.y, nearestEnemy.x - this.player.x);
        }
    }

    emulateJevResponse(state, system) {
        // High fidelity browser fallback emulation
        const start = performance.now();
        const answers = {};

        if (system === 'enemy') {
            const choices = ['flank_left', 'flank_right', 'direct_charge', 'take_cover', 'suppressive_fire'];
            const chosen = choices[Math.floor(Math.random() * choices.length)];
            answers['combat_action'] = {
                choice: chosen,
                confidence: 0.84,
                probabilities: { flank_left: 0.2, flank_right: 0.2, direct_charge: 0.4, take_cover: 0.1, suppressive_fire: 0.1 }
            };
            answers['threat_assessment'] = {
                score: 2,
                confidence: 0.76,
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
            answers['grant_emergency_aid'] = { noul: state.player_health < 35 ? 0.9 : 0.1 };
        } else if (system === 'bot') {
            answers['navigation_action'] = {
                choice: state.incoming_bullets_count > 1 ? 'circle_strafe_ccw' : 'circle_strafe_cw',
                confidence: 0.82,
                probabilities: { circle_strafe_cw: 0.45, circle_strafe_ccw: 0.4, retreat_open_space: 0.15 }
            };
            answers['trigger_fire'] = { noul: 0.92 };
            answers['trigger_dash'] = { noul: state.incoming_bullets_count > 1 ? 0.88 : 0.12 };
        }

        return {
            success: true,
            is_simulated: true,
            model: 'jev-latest (client-emulation)',
            latency_ms: Math.round(performance.now() - start + 4),
            answers,
        };
    }

    triggerLaserHazard() {
        const isHorizontal = Math.random() > 0.5;
        const pos = isHorizontal ? Math.random() * (this.height - 100) + 50 : Math.random() * (this.width - 100) + 50;

        this.activeHazards.push({
            isHorizontal,
            pos,
            warningTimer: 1.5,
            activeTimer: 2.2,
            width: 14,
        });

        this.showFloatingText(this.width / 2, 100, "⚠ LASER GRID HAZARD ACTIVATED ⚠", "#ff0055");
        window.sounds.playAlert();
    }

    spawnPickup(x, y, type) {
        this.pickups.push({
            x,
            y,
            type, // 'heal', 'shield', 'overdrive', 'nuke'
            radius: 12,
            life: 15.0,
            pulse: 0,
        });
    }

    showFloatingText(x, y, text, color = '#ffffff') {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            life: 1.2,
            maxLife: 1.2,
            vy: -35,
        });
    }

    // ==========================================
    // UPDATE & GAME LOOP
    // ==========================================

    update(dt) {
        if (this.isGameOver) return;

        // Screen Shake
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

        // Update Hazards
        for (let i = this.activeHazards.length - 1; i >= 0; i--) {
            const h = this.activeHazards[i];
            if (h.warningTimer > 0) {
                h.warningTimer -= dt;
            } else if (h.activeTimer > 0) {
                h.activeTimer -= dt;

                // Check player damage
                if (this.player.invulnerableTimer <= 0) {
                    let hit = false;
                    if (h.isHorizontal && Math.abs(this.player.y - h.pos) < this.player.radius + h.width / 2) hit = true;
                    if (!h.isHorizontal && Math.abs(this.player.x - h.pos) < this.player.radius + h.width / 2) hit = true;

                    if (hit) {
                        this.damagePlayer(40 * dt);
                    }
                }
            } else {
                this.activeHazards.splice(i, 1);
            }
        }

        // Update Player Timers
        if (this.player.isDashing) {
            this.player.dashTimer -= dt;
            this.player.x += this.player.dashVx * dt;
            this.player.y += this.player.dashVy * dt;
            if (this.player.dashTimer <= 0) this.player.isDashing = false;
        }

        if (this.player.invulnerableTimer > 0) {
            this.player.invulnerableTimer -= dt;
        }

        // Dash Recharge
        if (this.player.dashCharges < this.player.maxDashCharges) {
            this.player.dashRechargeTimer += dt;
            if (this.player.dashRechargeTimer >= 2.5) {
                this.player.dashCharges++;
                this.player.dashRechargeTimer = 0;
            }
        }

        // Shield Recharge
        this.player.shieldRechargeTimer += dt;
        if (this.player.shieldRechargeTimer > 3.0 && this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 25 * dt);
        }

        // Heat Dissipation
        if (this.player.isOverheated) {
            this.player.heat -= 45 * dt;
            if (this.player.heat <= 0) {
                this.player.heat = 0;
                this.player.isOverheated = false;
            }
        } else {
            this.player.heat = Math.max(0, this.player.heat - 35 * dt);
        }

        // Overdrive powerup
        if (this.player.overdriveTimer > 0) {
            this.player.overdriveTimer -= dt;
        }

        // Handle Player Movement (Manual vs Jev Bot)
        if (this.autoPilot) {
            this.botDecisionTimer += dt;
            if (this.botDecisionTimer >= 0.18) { // 5 decisions/sec
                this.botDecisionTimer = 0;
                this.queryBotPilot();
            }
            this.updateAutoPilotMovement(dt);
        } else {
            this.updateManualMovement(dt);
        }

        // Constrain player to screen
        this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

        // Player Firing
        this.player.fireCooldown -= dt;
        const wantFire = this.autoPilot ? this.botIntent.fire : this.mouse.down;
        if (wantFire && this.player.fireCooldown <= 0 && !this.player.isOverheated) {
            this.firePlayerWeapon();
        }

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Check enemy hits
            let bulletRemoved = false;
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const d = Math.hypot(b.x - e.x, b.y - e.y);
                if (d < b.radius + e.radius) {
                    e.hp -= b.damage;
                    this.spawnSparks(b.x, b.y, b.color, 6);
                    window.sounds.playShieldHit();

                    if (e.hp <= 0) {
                        this.destroyEnemy(e, j);
                    }
                    this.bullets.splice(i, 1);
                    bulletRemoved = true;
                    break;
                }
            }

            if (!bulletRemoved && (b.life <= 0 || b.x < 0 || b.x > this.width || b.y < 0 || b.y > this.height)) {
                this.bullets.splice(i, 1);
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Check player hit
            const d = Math.hypot(b.x - this.player.x, b.y - this.player.y);
            if (d < b.radius + this.player.radius && this.player.invulnerableTimer <= 0) {
                this.damagePlayer(b.damage);
                this.spawnSparks(b.x, b.y, '#ff0055', 8);
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (b.life <= 0 || b.x < 0 || b.x > this.width || b.y < 0 || b.y > this.height) {
                this.enemyBullets.splice(i, 1);
            }
        }

        // Update Enemies
        this.enemyDecisionTimer += dt;
        const triggerEnemyJev = (this.enemyDecisionTimer >= 0.7);
        if (triggerEnemyJev) this.enemyDecisionTimer = 0;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (triggerEnemyJev && Math.random() > 0.4) {
                this.queryEnemyAI(e);
            }
            this.updateEnemy(e, dt);

            // Check collision with player
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d < e.radius + this.player.radius && this.player.invulnerableTimer <= 0) {
                this.damagePlayer(25);
                this.screenShake = 8;
                // Repel
                const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                this.player.x += Math.cos(ang) * 35;
                this.player.y += Math.sin(ang) * 35;
            }
        }

        // Update Pickups
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.life -= dt;
            p.pulse += dt * 5;

            const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
            if (d < p.radius + this.player.radius) {
                this.collectPickup(p);
                this.pickups.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.pickups.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y += t.vy * dt;
            t.life -= dt;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Check wave completion
        if (this.enemies.length === 0) {
            this.startWave(this.wave + 1);
        }

        this.updateHUD();
    }

    updateManualMovement(dt) {
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            const spd = (this.player.overdriveTimer > 0 ? this.player.speed * 1.35 : this.player.speed);
            this.player.x += (dx / len) * spd * dt;
            this.player.y += (dy / len) * spd * dt;
        }

        // Mouse aim
        this.player.angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
    }

    updateAutoPilotMovement(dt) {
        // High-speed autonomous navigation driven by Jev decisions
        const nav = this.botIntent.nav;
        let targetX = this.width / 2;
        let targetY = this.height / 2;

        let nearest = null;
        let minDist = 9999;
        this.enemies.forEach(e => {
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d < minDist) { minDist = d; nearest = e; }
        });

        let moveAngle = 0;
        let moving = true;

        if (nearest) {
            const angToEnemy = Math.atan2(nearest.y - this.player.y, nearest.x - this.player.x);
            if (nav === 'circle_strafe_cw') {
                moveAngle = angToEnemy + Math.PI / 2;
                if (minDist < 180) moveAngle += Math.PI / 4; // drift outward
            } else if (nav === 'circle_strafe_ccw') {
                moveAngle = angToEnemy - Math.PI / 2;
                if (minDist < 180) moveAngle -= Math.PI / 4;
            } else if (nav === 'retreat_open_space') {
                moveAngle = angToEnemy + Math.PI;
            } else if (nav === 'rush_pickup' && this.pickups.length > 0) {
                const p = this.pickups[0];
                moveAngle = Math.atan2(p.y - this.player.y, p.x - this.player.x);
            } else {
                moveAngle = angToEnemy;
            }
        }

        // Avoid incoming bullets
        this.enemyBullets.forEach(b => {
            const bd = Math.hypot(b.x - this.player.x, b.y - this.player.y);
            if (bd < 100) {
                const bAng = Math.atan2(this.player.y - b.y, this.player.x - b.x);
                moveAngle = bAng;
            }
        });

        const spd = this.player.speed * (this.player.overdriveTimer > 0 ? 1.35 : 1.1);
        this.player.x += Math.cos(moveAngle) * spd * dt;
        this.player.y += Math.sin(moveAngle) * spd * dt;
    }

    firePlayerWeapon() {
        const isOverdrive = this.player.overdriveTimer > 0;
        this.player.fireCooldown = isOverdrive ? 0.08 : 0.15;
        this.player.heat = Math.min(100, this.player.heat + (isOverdrive ? 2 : 7));

        if (this.player.heat >= 100) {
            this.player.isOverheated = true;
            this.showFloatingText(this.player.x, this.player.y - 25, "OVERHEATED!", "#ff0055");
            window.sounds.playAlert();
        }

        const angle = this.player.angle;
        const bSpeed = 680;

        // Dual barrel offset
        const spread = (Math.random() - 0.5) * 0.08;
        const finalAng = angle + spread;

        this.bullets.push({
            x: this.player.x + Math.cos(angle) * 18,
            y: this.player.y + Math.sin(angle) * 18,
            vx: Math.cos(finalAng) * bSpeed,
            vy: Math.sin(finalAng) * bSpeed,
            radius: isOverdrive ? 5 : 4,
            damage: isOverdrive ? 40 : 25,
            color: isOverdrive ? '#ff00ff' : '#00ffff',
            life: 1.2,
        });

        window.sounds.playLaser();
        this.screenShake = 1.5;
    }

    updateEnemy(e, dt) {
        const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
        const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        e.angle = ang;

        let moveAng = ang;
        if (e.tactic === 'flank_left') {
            moveAng = ang - Math.PI / 2.5;
        } else if (e.tactic === 'flank_right') {
            moveAng = ang + Math.PI / 2.5;
        } else if (e.tactic === 'take_cover') {
            moveAng = ang + Math.PI;
        }

        e.x += Math.cos(moveAng) * e.speed * dt;
        e.y += Math.sin(moveAng) * e.speed * dt;

        // Shooting logic for ranged units
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
            if (e.type === 'drone') {
                e.shootTimer = 1.8 + Math.random() * 0.8;
                this.fireEnemyBullet(e.x, e.y, ang, 220, 15, '#ffbb00');
            } else if (e.type === 'heavy') {
                e.shootTimer = 2.4;
                // Triple shotgun spread
                for (let off = -0.25; off <= 0.25; off += 0.25) {
                    this.fireEnemyBullet(e.x, e.y, ang + off, 260, 20, '#ff0055');
                }
                window.sounds.playHeavyLaser();
            } else if (e.type === 'boss') {
                e.shootTimer = 1.2;
                // Radial ring
                const count = 10;
                for (let r = 0; r < count; r++) {
                    const ringAng = (r / count) * Math.PI * 2 + performance.now() * 0.001;
                    this.fireEnemyBullet(e.x, e.y, ringAng, 180, 22, '#ff00ff');
                }
                window.sounds.playHeavyLaser();
            }
        }
    }

    fireEnemyBullet(x, y, angle, speed, damage, color) {
        this.enemyBullets.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5,
            damage,
            color,
            life: 4.0,
        });
    }

    damagePlayer(amount) {
        this.player.lastDamageTime = performance.now();
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
        this.enemies.splice(index, 1);
        this.enemiesDefeated++;
        this.score += (e.type === 'boss' ? 2500 : (e.type === 'heavy' ? 400 : 100));

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_high_score', this.highScore.toString());
        }

        this.spawnExplosion(e.x, e.y, e.color, e.radius * 1.5);
        window.sounds.playExplosion();

        // Chance to drop pickup
        if (Math.random() < 0.22 || e.type === 'boss') {
            const types = ['heal', 'shield', 'overdrive', 'nuke'];
            const pType = types[Math.floor(Math.random() * types.length)];
            this.spawnPickup(e.x, e.y, pType);
        }
    }

    collectPickup(p) {
        window.sounds.playPowerup();
        if (p.type === 'heal') {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
            this.showFloatingText(p.x, p.y, "+40 REPAIR", "#00ffcc");
        } else if (p.type === 'shield') {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 60);
            this.showFloatingText(p.x, p.y, "+60 SHIELD", "#0088ff");
        } else if (p.type === 'overdrive') {
            this.player.overdriveTimer = 8.0;
            this.showFloatingText(p.x, p.y, "OVERDRIVE ENGAGED", "#ff00ff");
        } else if (p.type === 'nuke') {
            this.screenShake = 20;
            this.enemies.forEach(e => {
                if (e.type !== 'boss') {
                    e.hp = 0;
                    this.spawnExplosion(e.x, e.y, '#00ffff', 25);
                }
            });
            this.enemies = this.enemies.filter(e => e.hp > 0);
            this.showFloatingText(this.width / 2, this.height / 2, "MATRIX NUKE DETONATED", "#ffffff");
            window.sounds.playExplosion();
        }
    }

    spawnSparks(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 140;
            this.particles.push({
                x,
                y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: Math.random() * 2.5 + 1.5,
                color,
                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.4,
            });
        }
    }

    spawnExplosion(x, y, color, scale = 20) {
        this.screenShake = 8;
        for (let i = 0; i < 24; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * (scale * 8);
            this.particles.push({
                x,
                y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: Math.random() * 4 + 2,
                color,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7,
            });
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

    updateHUD() {
        const hpBar = document.getElementById('hud-hp-bar');
        const hpVal = document.getElementById('hud-hp-val');
        const shieldBar = document.getElementById('hud-shield-bar');
        const shieldVal = document.getElementById('hud-shield-val');
        const heatBar = document.getElementById('hud-heat-bar');
        const dashDots = document.getElementById('hud-dash-dots');
        const scoreEl = document.getElementById('hud-score');
        const waveEl = document.getElementById('hud-wave');

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
    }

    // ==========================================
    // RENDER LOOP
    // ==========================================

    render() {
        const ctx = this.ctx;

        ctx.save();
        // Screen shake offset
        if (this.screenShake > 0) {
            const ox = (Math.random() - 0.5) * this.screenShake;
            const oy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(ox, oy);
        }

        // Clear Canvas with dark cyber grid
        ctx.fillStyle = '#060a12';
        ctx.fillRect(0, 0, this.width, this.height);

        this.drawGrid(ctx);

        // Draw Hazards
        this.activeHazards.forEach(h => {
            if (h.warningTimer > 0) {
                // Warning strobe
                ctx.strokeStyle = `rgba(255, 0, 85, ${0.3 + Math.sin(performance.now() * 0.02) * 0.25})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                if (h.isHorizontal) {
                    ctx.moveTo(0, h.pos); ctx.lineTo(this.width, h.pos);
                } else {
                    ctx.moveTo(h.pos, 0); ctx.lineTo(h.pos, this.height);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (h.activeTimer > 0) {
                // Searing laser beam
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth = h.width;
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 18;
                ctx.beginPath();
                if (h.isHorizontal) {
                    ctx.moveTo(0, h.pos); ctx.lineTo(this.width, h.pos);
                } else {
                    ctx.moveTo(h.pos, 0); ctx.lineTo(h.pos, this.height);
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        });

        // Draw Pickups
        this.pickups.forEach(p => {
            const scale = 1 + Math.sin(p.pulse) * 0.15;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(scale, scale);

            let color = '#00ffcc';
            let label = '+';
            if (p.type === 'shield') { color = '#0088ff'; label = 'S'; }
            else if (p.type === 'overdrive') { color = '#ff00ff'; label = '⚡'; }
            else if (p.type === 'nuke') { color = '#ffff00'; label = '☢'; }

            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;

            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 1);

            ctx.restore();
        });

        // Draw Player Bullets
        this.bullets.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Draw Enemy Bullets
        this.enemyBullets.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Draw Enemies
        this.enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);

            ctx.strokeStyle = e.isBerserk ? '#ff0055' : e.color;
            ctx.fillStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.shadowColor = e.isBerserk ? '#ff0055' : e.color;
            ctx.shadowBlur = e.isBerserk ? 14 : 6;

            if (e.type === 'stalker') {
                // Cyber canine / dart
                ctx.beginPath();
                ctx.moveTo(e.radius * 1.2, 0);
                ctx.lineTo(-e.radius, -e.radius * 0.8);
                ctx.lineTo(-e.radius * 0.5, 0);
                ctx.lineTo(-e.radius, e.radius * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (e.type === 'drone') {
                // Diamond drone
                ctx.beginPath();
                ctx.moveTo(e.radius, 0);
                ctx.lineTo(0, -e.radius);
                ctx.lineTo(-e.radius, 0);
                ctx.lineTo(0, e.radius);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Core eye
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'heavy') {
                // Hexagonal dreadnought
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
                // Giant apex boss
                ctx.beginPath();
                for (let a = 0; a < 8; a++) {
                    const rad = (a / 8) * Math.PI * 2;
                    const hx = Math.cos(rad) * e.radius;
                    const hy = Math.sin(rad) * e.radius;
                    if (a === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Rotating core bits
                const coreRot = performance.now() * 0.003;
                ctx.strokeStyle = '#ff00aa';
                ctx.strokeRect(-12, -12, 24, 24);
            }

            // Health bar over enemy
            if (e.hp < e.maxHp) {
                ctx.rotate(-e.angle);
                const barW = e.radius * 2;
                const barH = 4;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(-barW / 2, -e.radius - 12, barW, barH);
                ctx.fillStyle = e.isBerserk ? '#ff0055' : '#00ffaa';
                ctx.fillRect(-barW / 2, -e.radius - 12, barW * (e.hp / e.maxHp), barH);
            }

            ctx.restore();
        });

        // Draw Particles
        this.particles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        // Draw Player Ship
        this.drawPlayer(ctx);

        // Draw Floating Texts
        this.floatingTexts.forEach(t => {
            const alpha = Math.max(0, t.life / t.maxLife);
            ctx.fillStyle = t.color;
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 6;
            ctx.fillText(t.text, t.x, t.y);
        });
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    drawGrid(ctx) {
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.04)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < this.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.height; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
    }

    drawPlayer(ctx) {
        ctx.save();
        ctx.translate(this.player.x, this.player.y);

        // Shield bubble
        if (this.player.shield > 0) {
            const shieldAlpha = Math.min(0.7, (this.player.shield / this.player.maxShield) * 0.6);
            ctx.strokeStyle = `rgba(0, 162, 255, ${shieldAlpha})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00a2ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.player.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.rotate(this.player.angle);

        // Ship geometry
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = this.player.overdriveTimer > 0 ? '#ff00ff' : '#00ffcc';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = this.player.overdriveTimer > 0 ? '#ff00ff' : '#00ffcc';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(this.player.radius * 1.4, 0);
        ctx.lineTo(-this.player.radius, -this.player.radius * 0.9);
        ctx.lineTo(-this.player.radius * 0.5, 0);
        ctx.lineTo(-this.player.radius, this.player.radius * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit / Engine Core
        ctx.fillStyle = this.autoPilot ? '#ffbb00' : '#00ffff';
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Crosshair if manual mode
        if (!this.autoPilot) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.mouse.x, this.mouse.y, 8, 0, Math.PI * 2);
            ctx.moveTo(this.mouse.x - 12, this.mouse.y); ctx.lineTo(this.mouse.x + 12, this.mouse.y);
            ctx.moveTo(this.mouse.x, this.mouse.y - 12); ctx.lineTo(this.mouse.x, this.mouse.y + 12);
            ctx.stroke();
            ctx.restore();
        }
    }

    loop() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new CyberGame();
    window.game.loop();
});
