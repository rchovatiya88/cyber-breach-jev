/**
 * JEV System One Live Telemetry & Decision Matrix HUD
 * Renders real-time probability distributions, score rubrics, and noul meters.
 */
class JevHUD {
    constructor() {
        this.totalDecisions = 0;
        this.decisionsInLastSec = 0;
        this.dps = 0;
        this.recentLatencies = [];
        this.history = [];
        this.maxHistory = 8;
        this.isLiveApi = false;
        this.currentModel = "jev-latest";

        this.initDpsTracker();
    }

    initDpsTracker() {
        setInterval(() => {
            this.dps = this.decisionsInLastSec;
            this.decisionsInLastSec = 0;
            const dpsEl = document.getElementById('jev-dps');
            if (dpsEl) dpsEl.textContent = this.dps;
        }, 1000);
    }

    updateConfigStatus(config) {
        this.isLiveApi = config.is_live;
        this.currentModel = config.model || "jev-latest";

        const badge = document.getElementById('jev-status-badge');
        const modelEl = document.getElementById('jev-model-name');

        if (badge) {
            if (this.isLiveApi) {
                badge.className = 'status-badge live';
                badge.textContent = '● LIVE API ACTIVE';
            } else {
                badge.className = 'status-badge simulated';
                badge.textContent = '● CALIBRATED PROTOCOL (RLCD)';
            }
        }
        if (modelEl) {
            modelEl.textContent = this.isLiveApi ? this.currentModel : `${this.currentModel} (simulated)`;
        }
    }

    recordDecision(source, state, result) {
        this.totalDecisions++;
        this.decisionsInLastSec++;

        const latency = result.latency_ms || 5;
        this.recentLatencies.push(latency);
        if (this.recentLatencies.length > 20) this.recentLatencies.shift();

        const avgLatency = Math.round(
            this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
        );

        // Update latency element
        const latencyEl = document.getElementById('jev-latency');
        if (latencyEl) {
            latencyEl.textContent = `${latency}ms (avg ${avgLatency}ms)`;
        }

        const totalEl = document.getElementById('jev-total-decisions');
        if (totalEl) totalEl.textContent = this.totalDecisions;

        // Render answers
        const answers = result.answers || {};

        // Find primary Choice, Score, and Noul
        let choiceData = null;
        let scoreData = null;
        let noulData = null;
        let choiceKey = "";
        let scoreKey = "";
        let noulKey = "";

        for (const [k, v] of Object.entries(answers)) {
            if (v.choice && !choiceData) {
                choiceData = v;
                choiceKey = k;
            } else if (v.score !== undefined && !scoreData) {
                scoreData = v;
                scoreKey = k;
            } else if (v.noul !== undefined && !noulData) {
                noulData = v;
                noulKey = k;
            }
        }

        this.renderChoice(choiceKey, choiceData);
        this.renderScore(scoreKey, scoreData);
        this.renderNoul(noulKey, noulData);

        // Update JSON State Inspector
        const stateInspector = document.getElementById('jev-state-json');
        if (stateInspector) {
            stateInspector.textContent = JSON.stringify(state, null, 2);
        }

        // Add to history log
        const topAction = choiceData ? choiceData.choice : (noulData ? `P(yes)=${noulData.noul}` : 'EVAL');
        this.addHistoryEntry(source, topAction, latency);
    }

    renderChoice(key, data) {
        const titleEl = document.getElementById('jev-choice-title');
        const winnerEl = document.getElementById('jev-choice-winner');
        const barsEl = document.getElementById('jev-choice-bars');

        if (!data || !barsEl) return;

        if (titleEl) titleEl.textContent = `CHOICE (${key.toUpperCase()}):`;
        if (winnerEl) {
            const confPct = Math.round((data.confidence || 0) * 100);
            winnerEl.innerHTML = `<span class="badge-choice">${data.choice}</span> <span class="conf-pct">${confPct}% conf</span>`;
        }

        barsEl.innerHTML = '';
        const probs = data.probabilities || {};
        for (const [option, prob] of Object.entries(probs)) {
            const pct = Math.round(prob * 100);
            const isWinner = option === data.choice;
            const barRow = document.createElement('div');
            barRow.className = `prob-row ${isWinner ? 'winner' : ''}`;
            barRow.innerHTML = `
                <div class="prob-label">${option}</div>
                <div class="prob-bar-container">
                    <div class="prob-bar-fill" style="width: ${pct}%"></div>
                </div>
                <div class="prob-val">${pct}%</div>
            `;
            barsEl.appendChild(barRow);
        }
    }

    renderScore(key, data) {
        const titleEl = document.getElementById('jev-score-title');
        const valEl = document.getElementById('jev-score-val');
        const stepsEl = document.getElementById('jev-score-steps');

        if (!data || !stepsEl) return;

        if (titleEl) titleEl.textContent = `SCORE (${key.toUpperCase()}):`;
        const scoreVal = data.score;
        const legend = data.legend || {};
        const scoreLabel = legend[scoreVal] || `Level ${scoreVal}`;

        if (valEl) {
            valEl.textContent = `${scoreVal} - ${scoreLabel}`;
        }

        stepsEl.innerHTML = '';
        for (const [idx, name] of Object.entries(legend)) {
            const numIdx = Number(idx);
            const isCurrent = numIdx === Math.round(scoreVal);
            const step = document.createElement('div');
            step.className = `score-step ${isCurrent ? 'active' : ''}`;
            step.title = `${idx}: ${name}`;
            step.textContent = name.substring(0, 7);
            stepsEl.appendChild(step);
        }
    }

    renderNoul(key, data) {
        const titleEl = document.getElementById('jev-noul-title');
        const valEl = document.getElementById('jev-noul-val');
        const meterFill = document.getElementById('jev-noul-meter-fill');

        if (!data || !meterFill) return;

        if (titleEl) titleEl.textContent = `NOUL (${key.toUpperCase()}):`;
        const prob = data.noul || 0;
        const pct = Math.round(prob * 100);

        if (valEl) valEl.textContent = `${prob.toFixed(3)} (${pct}%)`;

        meterFill.style.width = `${pct}%`;
        if (pct > 70) {
            meterFill.style.backgroundColor = '#ff0055';
        } else if (pct > 40) {
            meterFill.style.backgroundColor = '#ffbb00';
        } else {
            meterFill.style.backgroundColor = '#00ffcc';
        }
    }

    addHistoryEntry(source, action, latency) {
        const listEl = document.getElementById('jev-history-list');
        if (!listEl) return;

        const timeStr = new Date().toLocaleTimeString().split(' ')[0];
        const entry = document.createElement('div');
        entry.className = 'history-item';
        entry.innerHTML = `
            <span class="hist-time">${timeStr}</span>
            <span class="hist-src ${source.toLowerCase()}">${source}</span>
            <span class="hist-action">${action}</span>
            <span class="hist-lat">${latency}ms</span>
        `;

        listEl.prepend(entry);
        while (listEl.children.length > this.maxHistory) {
            listEl.removeChild(listEl.lastChild);
        }
    }
}

window.jevHud = new JevHUD();
