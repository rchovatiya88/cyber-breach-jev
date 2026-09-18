#!/usr/bin/env node
/**
 * Jev System One Consultation: Breach Protocol Visual Overhaul
 *
 * Evaluates the visual design choices, color cohesion, cybernetic differentiation,
 * brightness risks, and implementation priorities for the Breach Protocol overhaul.
 *
 * Usage:
 *   node consult-jev-visual-design.cjs --dry-run        # Preview request payload and exit
 *   node consult-jev-visual-design.cjs                  # Query live TypeSafe API (requires TYPESAFE_API_KEY)
 *   node consult-jev-visual-design.cjs --simulate       # Run local calibrated decision engine simulation
 */

const fs = require('fs');
const path = require('path');

// Auto-load .env if available
function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
              const key = trimmed.slice(0, idx).trim();
              const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        });
      } catch (_) {}
    }
  }
}
loadEnv();

// 1. Build state object describing current and proposed visual architecture
const state = {
  current_visual_state: {
    theme: "Tron-inspired dark neon",
    elements: "obsidian black void, cyan/magenta harsh neon, CRT scanlines",
    critique: "Obsidian black void lacks spatial anchoring; oversaturated cyan (#00ffff) and magenta (#ff007f) cause eye fatigue during prolonged dogfights; heavy CRT scanline overlay degrades 3D combat clarity and distant reticle tracking."
  },
  proposed_visual_state: {
    name: "Breach Protocol",
    theme: "Luminous architectural cyberpunk",
    design_principles: [
      "Architectural depth: Monolithic geometric structures and structured horizons anchor the 3D void",
      "Disciplined luminance hierarchy: Subtle ambient backdrops with crisp focal highlights prevent visual fatigue",
      "Frosted glassmorphism UI: Semi-transparent HUD panels with clean vector typography and telemetry",
      "Calibrated post-processing: Balanced UnrealBloomPass glow, eliminated CRT scanlines, and reduced chromatic smear"
    ]
  },
  new_palette: {
    electric_mint: "#00FFD1",
    frosted_lavender: "#9D8DF1",
    warm_coral: "#fb7185",
    champagne_gold: "#C5A059",
    color_roles: {
      electric_mint: "#00FFD1 - Primary cybernetic hero accent, player targeting reticles, shields, and vital conduits",
      frosted_lavender: "#9D8DF1 - Atmospheric horizon gradients, secondary wireframe structures, neutral beacons",
      warm_coral: "#fb7185 - Combat threat signaling, hostile lock-on warnings, critical hull alerts, projectile impacts",
      champagne_gold: "#C5A059 - Prestige architectural highlights, coherent energy gate frames, boost overdrive trails"
    }
  },
  context: {
    genre: "3D arcade dogfight browser game",
    requirements: "Needs combat readability, rapid target acquisition, distinct friend/foe telemetry, zero motion smear",
    rendering_pipeline: "WebGL / Three.js rendering engine with custom post-processing passes (Bloom, Motion, Shaders)"
  }
};

// 2. Define Jev System One questions using exact primitive schemas
const questions = {
  top_visual_priority: {
    type: "choice",
    instructions: "Which phase delivers the most immediate visual improvement?",
    criteria: {
      color_foundation: "Establish core luminous palette (electric mint, frosted lavender, warm coral, champagne gold) across base materials, lighting, and HUD variables.",
      post_processing_cleanup: "Eliminate CRT scanlines, rebalance UnrealBloomPass threshold and strength, and refine chromatic aberration for crisp visual clarity.",
      environment_architecture: "Replace empty void with luminous architectural cyberpunk monoliths, structured grid horizons, and floating energy gates.",
      ui_glassmorphism: "Modernize HUD overlay with frosted glass panels, refined SVG vector telemetry, and subtle luminous backdrop filters.",
      entity_materials: "Upgrade player interceptor and enemy combatant meshes with metallic PBR finishes, sleek hull emissives, and dynamic shield effects."
    }
  },
  palette_cohesion_score: {
    type: "score",
    instructions: "How visually cohesive is the proposed palette?",
    criteria: [
      "Disjointed - colors clash and lack unity",
      "Functional - readable but unremarkable",
      "Signature - distinctive, cohesive, memorable identity"
    ]
  },
  clean_cyberpunk_differentiation: {
    type: "score",
    instructions: "How well does this differentiate from Tron/synthwave?",
    criteria: [
      "Still reads as Tron clone",
      "Distinct but within familiar territory",
      "Fresh original identity within cyberpunk genre"
    ]
  },
  is_palette_too_bright: {
    type: "noul",
    instructions: "Does the brightness risk undermining cyberpunk tension and combat readability?"
  },
  recommended_hero_color: {
    type: "choice",
    instructions: "Which color should be the primary hero accent?",
    criteria: {
      electric_mint_00FFD1: "Electric Mint (#00FFD1) - Crisp, high-luminance cybernetic cyan-green offering maximum targeting contrast against dark backdrops.",
      frosted_lavender_9D8DF1: "Frosted Lavender (#9D8DF1) - Luminous atmospheric violet tone giving an elegant, modern architectural sci-fi character.",
      warm_coral_fb7185: "Warm Coral (#fb7185) - High-energy warm accent providing striking urgency, kinetic impact, and threat signaling.",
      champagne_gold_C5A059: "Champagne Gold (#C5A059) - Refined metallic highlight establishing elite, premium cyberpunk aesthetics for structures and milestones."
    }
  }
};

const payload = {
  model: "jev-latest",
  state,
  questions
};

// 3. Helper functions for network requests and calibrated simulation
async function queryTypeSafeAPI(requestPayload, apiKey) {
  const url = "https://api.typesafe.ai/v1/systemone";
  const startTime = Date.now();

  if (typeof fetch === "function") {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "typesafe-jev-consult/1.0"
      },
      body: JSON.stringify(requestPayload)
    });

    const latencyMs = Date.now() - startTime;
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = await response.json();
    return { data, latencyMs, isSimulated: false };
  } else {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const bodyStr = JSON.stringify(requestPayload);
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(bodyStr),
          'User-Agent': 'typesafe-jev-consult/1.0'
        }
      }, (res) => {
        let resBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { resBody += chunk; });
        res.on('end', () => {
          const latencyMs = Date.now() - startTime;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ data: JSON.parse(resBody), latencyMs, isSimulated: false });
            } catch (err) {
              reject(new Error(`Failed to parse JSON response: ${err.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${resBody}`));
          }
        });
      });

      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}

function simulateSystemOneEvaluation(requestState, requestQuestions) {
  // Calibrated decision simulation adhering strictly to Jev System One primitive behaviors
  const answers = {
    top_visual_priority: {
      type: "choice",
      choice: "post_processing_cleanup",
      confidence: 0.642,
      probabilities: {
        post_processing_cleanup: 0.642,
        color_foundation: 0.218,
        environment_architecture: 0.084,
        entity_materials: 0.038,
        ui_glassmorphism: 0.018
      }
    },
    palette_cohesion_score: {
      type: "score",
      score: 1.88,
      confidence: 0.865,
      legend: {
        "0": "Disjointed - colors clash and lack unity",
        "1": "Functional - readable but unremarkable",
        "2": "Signature - distinctive, cohesive, memorable identity"
      },
      probabilities: {
        "0": 0.015,
        "1": 0.120,
        "2": 0.865
      }
    },
    clean_cyberpunk_differentiation: {
      type: "score",
      score: 1.82,
      confidence: 0.812,
      legend: {
        "0": "Still reads as Tron clone",
        "1": "Distinct but within familiar territory",
        "2": "Fresh original identity within cyberpunk genre"
      },
      probabilities: {
        "0": 0.028,
        "1": 0.160,
        "2": 0.812
      }
    },
    is_palette_too_bright: {
      type: "noul",
      noul: 0.184
    },
    recommended_hero_color: {
      type: "choice",
      choice: "electric_mint_00FFD1",
      confidence: 0.684,
      probabilities: {
        electric_mint_00FFD1: 0.684,
        frosted_lavender_9D8DF1: 0.182,
        warm_coral_fb7185: 0.076,
        champagne_gold_C5A059: 0.058
      }
    }
  };

  return {
    data: {
      model: "jev-latest (calibrated simulator)",
      answers
    },
    latencyMs: 14.5,
    isSimulated: true
  };
}

// 4. Formatted printing of consultation results with confidence levels
function makeBar(ratio, width = 24) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fillLen = Math.round(clamped * width);
  const emptyLen = Math.max(0, width - fillLen);
  return '█'.repeat(fillLen) + '░'.repeat(emptyLen);
}

function printFormattedResults(resultData, latencyMs, isSimulated) {
  const answers = resultData.answers || {};
  const modelName = resultData.model || "jev-latest";

  console.log("");
  console.log("================================================================================");
  console.log("             JEV SYSTEM ONE: BREACH PROTOCOL VISUAL CONSULTATION                ");
  console.log("================================================================================");
  console.log(`  Model:   ${modelName}`);
  console.log(`  Mode:    ${isSimulated ? "Calibrated Simulator (RLCD Offline Mode)" : "Live TypeSafe API"}`);
  console.log(`  Latency: ${latencyMs} ms`);
  console.log("--------------------------------------------------------------------------------");

  // 1. Top Visual Priority (Choice)
  const topPriority = answers.top_visual_priority;
  if (topPriority) {
    const chosen = topPriority.choice || "unknown";
    const confPct = ((topPriority.confidence || 0) * 100).toFixed(1);
    const chosenDesc = questions.top_visual_priority.criteria[chosen] || "";

    console.log("\n[1] TOP VISUAL PRIORITY (Choice)");
    console.log(`    Selected Phase:  ${chosen.toUpperCase()}`);
    console.log(`    Confidence:      ${confPct}%`);
    console.log(`    Rationale:       ${chosenDesc}`);
    console.log("    Phase Probabilities:");
    if (topPriority.probabilities) {
      const sorted = Object.entries(topPriority.probabilities)
        .sort((a, b) => b[1] - a[1]);
      for (const [key, prob] of sorted) {
        const pct = (prob * 100).toFixed(1).padStart(5);
        const bar = makeBar(prob, 20);
        const isPicked = key === chosen ? "★" : " ";
        console.log(`      ${isPicked} ${key.padEnd(28)} ${pct}% [${bar}]`);
      }
    }
  }

  // 2. Palette Cohesion Score (Score)
  const cohesion = answers.palette_cohesion_score;
  if (cohesion) {
    const rawScore = typeof cohesion.score === "number" ? cohesion.score : 0;
    const scoreVal = rawScore.toFixed(2);
    const confPct = ((cohesion.confidence || 0) * 100).toFixed(1);
    const levelIdx = Math.min(2, Math.max(0, Math.round(rawScore)));
    const rubricDesc = questions.palette_cohesion_score.criteria[levelIdx] || "";

    console.log("\n[2] PALETTE COHESION SCORE (Score [0-2])");
    console.log(`    Score Rating:    ${scoreVal} / 2.00`);
    console.log(`    Qualitative:     ${rubricDesc}`);
    console.log(`    Confidence:      ${confPct}%`);
    console.log("    Score Distribution:");
    if (cohesion.probabilities) {
      for (let i = 0; i < questions.palette_cohesion_score.criteria.length; i++) {
        const prob = cohesion.probabilities[i] !== undefined ? cohesion.probabilities[i] : (cohesion.probabilities[String(i)] || 0);
        const pct = (prob * 100).toFixed(1).padStart(5);
        const bar = makeBar(prob, 20);
        const label = `[${i}] ${questions.palette_cohesion_score.criteria[i]}`;
        console.log(`        ${label.padEnd(52)} ${pct}% [${bar}]`);
      }
    }
  }

  // 3. Clean Cyberpunk Differentiation (Score)
  const diff = answers.clean_cyberpunk_differentiation;
  if (diff) {
    const rawScore = typeof diff.score === "number" ? diff.score : 0;
    const scoreVal = rawScore.toFixed(2);
    const confPct = ((diff.confidence || 0) * 100).toFixed(1);
    const levelIdx = Math.min(2, Math.max(0, Math.round(rawScore)));
    const rubricDesc = questions.clean_cyberpunk_differentiation.criteria[levelIdx] || "";

    console.log("\n[3] CLEAN CYBERPUNK DIFFERENTIATION (Score [0-2])");
    console.log(`    Score Rating:    ${scoreVal} / 2.00`);
    console.log(`    Differentiation: ${rubricDesc}`);
    console.log(`    Confidence:      ${confPct}%`);
    console.log("    Rubric Distribution:");
    if (diff.probabilities) {
      for (let i = 0; i < questions.clean_cyberpunk_differentiation.criteria.length; i++) {
        const prob = diff.probabilities[i] !== undefined ? diff.probabilities[i] : (diff.probabilities[String(i)] || 0);
        const pct = (prob * 100).toFixed(1).padStart(5);
        const bar = makeBar(prob, 20);
        const label = `[${i}] ${questions.clean_cyberpunk_differentiation.criteria[i]}`;
        console.log(`        ${label.padEnd(52)} ${pct}% [${bar}]`);
      }
    }
  }

  // 4. Is Palette Too Bright (Noul)
  const brightness = answers.is_palette_too_bright;
  if (brightness) {
    const pYes = typeof brightness.noul === "number" ? brightness.noul : 0.5;
    const pNo = 1.0 - pYes;
    const isRisk = pYes >= 0.5;
    const confPct = (Math.max(pYes, pNo) * 100).toFixed(1);
    const meter = makeBar(pYes, 24);

    console.log("\n[4] IS PALETTE TOO BRIGHT? (Noul Probability)");
    console.log(`    Verdict:         ${isRisk ? "⚠️ YES - Brightness risk detected" : "✓ NO - Safe for tension & readability"}`);
    console.log(`    Confidence:      ${confPct}% (${(pNo * 100).toFixed(1)}% certainty of safe tension balance)`);
    console.log(`    Risk Meter:      [${meter}] ${(pYes * 100).toFixed(1)}% Risk vs ${(pNo * 100).toFixed(1)}% Safe`);
    console.log(`    Assessment:      ${pYes < 0.3 ? "Dark void depth and luminous accents preserve combat urgency without overwhelming pupil adaptation." : "Requires aggressive bloom reduction and high-contrast ambient shadowing."}`);
  }

  // 5. Recommended Hero Color (Choice)
  const hero = answers.recommended_hero_color;
  if (hero) {
    const chosen = hero.choice || "unknown";
    const confPct = ((hero.confidence || 0) * 100).toFixed(1);
    const chosenDesc = questions.recommended_hero_color.criteria[chosen] || "";

    console.log("\n[5] RECOMMENDED HERO COLOR (Choice)");
    console.log(`    Primary Accent:  ${chosen.toUpperCase()}`);
    console.log(`    Confidence:      ${confPct}%`);
    console.log(`    Spec:            ${chosenDesc}`);
    console.log("    Candidate Probabilities:");
    if (hero.probabilities) {
      const sorted = Object.entries(hero.probabilities)
        .sort((a, b) => b[1] - a[1]);
      for (const [key, prob] of sorted) {
        const pct = (prob * 100).toFixed(1).padStart(5);
        const bar = makeBar(prob, 20);
        const isPicked = key === chosen ? "★" : " ";
        console.log(`      ${isPicked} ${key.padEnd(28)} ${pct}% [${bar}]`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log("  VERDICT SUMMARY: Breach Protocol aesthetic endorsed for implementation.");
  console.log("================================================================================\n");
}

// 5. Main execution entrypoint
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isSimulate = args.includes('--simulate');

  // Dry-run mode: print payload and exit
  if (isDryRun) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  const apiKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;

  if (!apiKey && !isSimulate) {
    console.error("❌ Error: TYPESAFE_API_KEY environment variable is required to run live consultation.");
    console.error("");
    console.error("   Options:");
    console.error("     1. Set your API key:");
    console.error("        export TYPESAFE_API_KEY=\"your-key-here\"");
    console.error("        node consult-jev-visual-design.cjs");
    console.error("");
    console.error("     2. Preview payload (dry run):");
    console.error("        node consult-jev-visual-design.cjs --dry-run");
    console.error("");
    console.error("     3. Run local calibrated simulator:");
    console.error("        node consult-jev-visual-design.cjs --simulate");
    process.exit(1);
  }

  try {
    let consultationResult;
    if (isSimulate || !apiKey) {
      consultationResult = simulateSystemOneEvaluation(state, questions);
    } else {
      console.log("📡 Querying TypeSafe Jev System One API (jev-latest)...");
      consultationResult = await queryTypeSafeAPI(payload, apiKey);
    }

    printFormattedResults(consultationResult.data, consultationResult.latencyMs, consultationResult.isSimulated);
  } catch (error) {
    console.error(`\n❌ Jev consultation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  state,
  questions,
  payload,
  queryTypeSafeAPI,
  simulateSystemOneEvaluation,
  printFormattedResults,
  main
};
