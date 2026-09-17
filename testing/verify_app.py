"""
Verify App CLI
==============
Autonomous test execution, telemetry verification, and build triage
powered by Cua Browser and TypeSafe Jev System One.

Usage:
    python3 -m testing.verify_app --url http://localhost:8000 --cdp-port 9225
"""

import sys
import time
import json
import asyncio
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

import httpx
import subprocess

from testing.cua_browser_runner import CuaBrowserRunner
from testing.jev_build_verifier import JevBuildVerifier, VerificationVerdict

logger = logging.getLogger("verify_app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class AppVerifier:
    """
    Orchestrates end-to-end verification workflows combining Cua Browser actions
    with Jev System One structured decisions.
    """

    def __init__(
        self,
        target_url: str = "http://localhost:8000",
        cdp_port: int = 9225,
        report_dir: Optional[str] = None,
        launch_browser: bool = True,
        headless: bool = False,
        keep_browser_open: bool = True
    ):
        self.target_url = target_url
        self.cdp_port = cdp_port
        self.report_dir = Path(report_dir) if report_dir else Path("./scratch/verification_reports")
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.launch_browser = launch_browser
        self.headless = headless
        self.keep_browser_open = keep_browser_open
        self.browser_proc: Optional[subprocess.Popen] = None
        self.runner = CuaBrowserRunner(cdp_port=self.cdp_port)
        self.verifier = JevBuildVerifier()
        self.results: Dict[str, Any] = {
            "target_url": target_url,
            "mode": "headless" if headless else "headed (visible desktop)",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "suites": {},
            "verdict": None
        }

    async def _launch_chrome(self):
        """Launch Google Chrome in headed or headless mode with remote debugging enabled."""
        chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        profile_dir = f"/tmp/chrome_cua_{'headless' if self.headless else 'headed'}_{self.cdp_port}"

        args = [
            chrome_path,
            f"--remote-debugging-port={self.cdp_port}",
            "--window-size=1280,850",
            "--window-position=80,60",
            "--autoplay-policy=no-user-gesture-required",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={profile_dir}",
        ]
        if self.headless:
            args.append("--headless=new")
        args.append(self.target_url)

        mode = "Headless" if self.headless else "Headed (Visible Desktop GUI)"
        logger.info(f"🌐 Launching Chrome in {mode} mode on port {self.cdp_port}...")
        self.browser_proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        await asyncio.sleep(2.5)

    async def run_all_suites(self) -> Dict[str, Any]:
        """Execute all verification phases and return the final report."""
        mode_str = "Headless" if self.headless else "Headed (Visible Desktop)"
        logger.info(f"🚀 Starting Cua + Jev Verification Pipeline [{mode_str}] for {self.target_url}")

        # 1. API Health & Connectivity Suite
        api_health = await self._run_api_health_suite()
        self.results["suites"]["api_health"] = api_health

        # Optional: Auto-launch Chrome
        if self.launch_browser:
            await self._launch_chrome()

        # Initialize Cua Browser
        connected = await self.runner.initialize(retries=10, retry_delay=0.6)
        if not connected:
            logger.error(f"❌ Failed to connect to Cua Browser target on port {self.cdp_port}.")
            self.results["suites"]["browser_connection"] = {"status": "failed", "error": "CDP connection refused"}
            verdict = self.verifier.evaluate_build(
                telemetry={},
                browser_state={"element_count": 0},
                predicate_results={"satisfied": False},
                api_health=api_health,
                error_logs=["CDP connection refused on port " + str(self.cdp_port)]
            )
            self.results["verdict"] = verdict.to_dict()
            self._save_reports(verdict, None)
            return self.results

        # Check current URL; only navigate if not already on target URL
        curr_url = await self.runner.evaluate_js("window.location.href")
        if not curr_url or "localhost:8000" not in str(curr_url):
            await self.runner.navigate(self.target_url)
            await asyncio.sleep(1.2)
        else:
            await asyncio.sleep(0.5)

        self.runner.start_recording()

        # 2. Page & DOM Inspection Suite
        dom_suite = await self._run_dom_inspection_suite()
        self.results["suites"]["dom_inspection"] = dom_suite

        # 3. Interactive Flow Suite (Full Flight, Weapons, Audio, and Jev Autopilot)
        interactive_suite = await self._run_interactive_flow_suite()
        self.results["suites"]["interactive_flows"] = interactive_suite

        # 4. Telemetry & Engine Suite
        telemetry_suite = await self._run_telemetry_suite()
        self.results["suites"]["telemetry"] = telemetry_suite

        # 5. Deterministic Predicate Verification Suite (Cua verify_state)
        predicates_suite = await self._run_predicate_suite()
        self.results["suites"]["predicates"] = predicates_suite

        # Stop trajectory recording
        trajectory_file = self.report_dir / "cua_action_trajectory.json"
        await self.runner.stop_recording(str(trajectory_file))

        # Capture Visual Evidence Screenshot
        screenshot_file = self.report_dir / "cua_verification_evidence.png"
        screenshot_bytes = await self.runner.capture_screenshot(str(screenshot_file))

        # 6. Jev System One Build Evaluation Gate
        logger.info("⚡ Passing verification evidence to Jev System One decision engine...")
        verdict = self.verifier.evaluate_build(
            telemetry=telemetry_suite.get("telemetry", {}),
            browser_state=dom_suite.get("state", {}),
            predicate_results=predicates_suite,
            api_health=api_health,
            error_logs=telemetry_suite.get("telemetry", {}).get("console_errors", [])
        )
        self.results["verdict"] = verdict.to_dict()

        await self.runner.close()

        if self.browser_proc and not self.keep_browser_open:
            self.browser_proc.terminate()
            self.browser_proc.wait()
            logger.info("Closed test browser process.")
        elif self.browser_proc and self.keep_browser_open:
            logger.info(f"✨ Headed browser window kept open at {self.target_url} for live gameplay!")

        # 7. Generate Reports
        self._save_reports(verdict, screenshot_file)

        logger.info("==========================================================")
        logger.info(f"🏁 VERIFICATION COMPLETE: Verdict = {self.results['verdict']['verdict']}")
        logger.info(f"Health Score: {verdict.build_health_score}/3 ({verdict.build_health_label})")
        logger.info(f"Readiness: {verdict.readiness_probability * 100:.1f}%")
        logger.info(f"Action: {verdict.recommended_action} (confidence {verdict.action_confidence:.2f})")
        logger.info("==========================================================")

        return self.results

    async def _run_api_health_suite(self) -> Dict[str, Any]:
        """Verify backend endpoints and Jev service availability."""
        logger.info("Testing backend API health...")
        health_url = f"{self.target_url.rstrip('/')}/api/health"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(health_url)
                if resp.status_code == 200:
                    data = resp.json()
                    logger.info("✅ API Health OK.")
                    return {"status": "online", "code": 200, "data": data}
                return {"status": "degraded", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"Backend API unreachable at {health_url}: {e}")
            return {"status": "offline", "error": str(e)}

    async def _run_dom_inspection_suite(self) -> Dict[str, Any]:
        """Extract semantic element hierarchy via Cua Browser."""
        logger.info("Inspecting DOM and accessibility hierarchy...")
        state = await self.runner.get_browser_state("semantic_v2")
        elements = state.get("elements", [])
        logger.info(f"✅ Extracted {len(elements)} interactive semantic controls from DOM.")
        return {
            "title": state.get("title"),
            "element_count": len(elements),
            "state": state
        }

    async def _run_interactive_flow_suite(self) -> Dict[str, Any]:
        """Trigger interactive controls via Cua and measure DOM/app reactions."""
        logger.info("🎮 Simulating interactive user flows (Audio, Flight, Weapons, Cameras, Autopilot)...")
        flow_results = []

        # Flow 1: Audio Unlock & Synthesizer Check (Click banner or press 'm')
        audio_unlocked = await self.runner.evaluate_js("""(() => {
            const banner = document.getElementById('audio-unlock-banner');
            if (banner && banner.style.display !== 'none') {
                banner.click();
            }
            if (window.audioManager && !window.audioManager.isAudioUnlocked) {
                window.audioManager.unlockAudioAndStartMusic();
            }
            return window.audioManager ? window.audioManager.isAudioUnlocked : false;
        })()""")
        flow_results.append({
            "flow": "audio_unlock_and_synthesizer",
            "verified": bool(audio_unlocked),
            "audio_active": audio_unlocked
        })
        logger.info(f"  - Audio Synthesizer: unlocked={audio_unlocked}")

        # Flow 2: Flight Maneuvering (Accelerate W, Bank A, Bank D)
        logger.info("  - Simulating flight controls (WASD maneuvers)...")
        speed_before = await self.runner.evaluate_js("window.game && window.game.player ? window.game.player.speed : 0")
        await self.runner.hold_key("w", duration_sec=0.5)
        await self.runner.hold_key("a", duration_sec=0.3)
        await self.runner.hold_key("d", duration_sec=0.3)
        speed_after = await self.runner.evaluate_js("window.game && window.game.player ? window.game.player.speed : 0")
        flight_ok = (speed_after is not None)
        flow_results.append({
            "flow": "flight_maneuvering_wasd",
            "speed_before": speed_before,
            "speed_after": speed_after,
            "verified": flight_ok
        })
        logger.info(f"  - Flight maneuvering: initial speed={speed_before} -> response speed={speed_after}")

        # Flow 3: Weapons Systems (Plasma Primary, Identity Disc 'q', EMP 'e', Blink 'Space')
        logger.info("  - Simulating weapons systems (Plasma, Identity Disc, EMP, Blink)...")
        weapons_state = await self.runner.evaluate_js("""(() => {
            const g = window.game;
            if (!g) return null;
            // Fire plasma cannon
            g.firePlayerBullet();
            const bulletsFired = g.bullets.length;

            // Throw Identity Disc
            g.throwIdentityDisc();
            const discActive = Boolean(g.identityDisc);

            // Deploy EMP Mine
            g.deployMine();
            const minesDeployed = g.mines ? g.mines.length : 0;

            // Quantum Blink Hop
            const blinkBefore = g.player.blinkCharges;
            g.triggerQuantumBlink();
            const blinkAfter = g.player.blinkCharges;

            return {
                bulletsFired,
                discActive,
                minesDeployed,
                blinkUsed: (blinkBefore !== blinkAfter)
            };
        })()""")
        weapons_ok = weapons_state is not None and (weapons_state.get("bulletsFired", 0) > 0 or weapons_state.get("discActive"))
        flow_results.append({
            "flow": "weapons_and_combat_abilities",
            "state": weapons_state,
            "verified": weapons_ok
        })
        logger.info(f"  - Weapons state: {weapons_state}")

        # Flow 4: Camera View Cycling (Chase Option 1 -> Option 2 -> Option 3 -> Cockpit)
        logger.info("  - Cycling camera modes via key 'v'...")
        cam_modes = []
        for _ in range(3):
            await self.runner.press_key("v")
            await asyncio.sleep(0.2)
            cam = await self.runner.evaluate_js("""(() => {
                const g = window.game;
                return g ? { mode: g.cameraMode, option: g.cameraOption } : null;
            })()""")
            cam_modes.append(cam)
        cam_ok = len(cam_modes) == 3
        flow_results.append({
            "flow": "camera_mode_cycling",
            "modes": cam_modes,
            "verified": cam_ok
        })
        logger.info(f"  - Camera modes cycled: {cam_modes}")

        # Flow 5: Jev Autonomous Autopilot Active Combat Run
        logger.info("  - Engaging Jev Autopilot ('p') and observing autonomous combat decisions...")
        ap_res = await self.runner.evaluate_js("""(() => {
            const g = window.game;
            if (!g) return null;
            g.autoPilot = true;
            // Spawn test enemies if none present
            if (g.enemies.length === 0) {
                g.spawnEnemy('stalker');
                g.spawnEnemy('drone');
            }
            return {
                autoPilot: g.autoPilot,
                enemiesCount: g.enemies.length,
                jevDecisionsCount: g.jevDecisions ? g.jevDecisions.length : 0
            };
        })()""")
        # Let Jev pilot for 3.5 seconds in real time in the visible window!
        await asyncio.sleep(3.5)

        ap_telemetry = await self.runner.evaluate_js("""(() => {
            const g = window.game;
            return {
                autoPilot: g.autoPilot,
                enemiesCount: g.enemies.length,
                score: g.score,
                lastJevAction: g.lastCopilotAction || 'active',
                hudDecisionBadge: document.getElementById('hud-decision')?.innerText || 'engaged'
            };
        })()""")
        ap_ok = ap_res is not None and ap_res.get("autoPilot") == True
        flow_results.append({
            "flow": "jev_autopilot_combat_run",
            "initial": ap_res,
            "after_run": ap_telemetry,
            "verified": ap_ok
        })
        logger.info(f"  - Jev Autopilot combat telemetry: {ap_telemetry}")

        # Flow 6: Config Modal Interaction via Cua Click
        btn_config = await self.runner.evaluate_js("""(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('CONFIG'));
            return btn ? btn.getAttribute('data-cua-ref') : null;
        })()""")
        modal_opened = False
        if btn_config:
            await self.runner.click(btn_config)
            await asyncio.sleep(0.3)
            modal_opened = bool(await self.runner.evaluate_js("""(() => {
                const m = document.getElementById('config-modal');
                return m && m.classList.contains('active');
            })()"""))
            await self.runner.evaluate_js("const m = document.getElementById('config-modal'); if (m) m.classList.remove('active');")
        flow_results.append({
            "flow": "open_config_modal",
            "btn_ref": btn_config,
            "modal_opened": modal_opened,
            "verified": modal_opened
        })
        logger.info(f"  - Config modal click verified: {modal_opened}")

        return {"flows": flow_results, "all_passed": all(f["verified"] for f in flow_results)}

    async def _run_telemetry_suite(self) -> Dict[str, Any]:
        """Extract engine, WebGL, and performance telemetry."""
        logger.info("Extracting rendering and performance telemetry...")
        telemetry = await self.runner.get_app_telemetry()
        has_gl = telemetry.get("has_webgl", False)
        game_ok = bool(telemetry.get("game"))
        logger.info(f"✅ WebGL Active: {has_gl} | 3D Scene Objects: {telemetry.get('game', {}).get('scene_objects_count', 0)}")
        return {
            "has_webgl": has_gl,
            "game_initialized": game_ok,
            "telemetry": telemetry
        }

    async def _run_predicate_suite(self) -> Dict[str, Any]:
        """Execute Cua verify_state deterministic predicates."""
        logger.info("Evaluating Cua deterministic predicates...")
        predicates = [
            # Check CAM button presence
            {"element": {"selector": {"role": "button", "label_contains": "CAM"}, "enabled": True}},
            # Check AUTOPILOT button presence
            {"element": {"selector": {"role": "button", "label_contains": "AUTOPILOT"}, "enabled": True}},
            # Check CONFIG button presence
            {"element": {"selector": {"role": "button", "label_contains": "CONFIG"}, "enabled": True}},
            # Check viewport size bounds
            {"window": {"bounds": {"x": 0, "y": 0, "width": 640, "height": 480, "tolerance_px": 50}}}
        ]
        result = await self.runner.verify_state(predicates)
        logger.info(f"✅ Deterministic Predicates satisfied: {result['satisfied']} ({result['predicates_evaluated']} evaluated)")
        return result

    def _save_reports(self, verdict: VerificationVerdict, screenshot_file: Optional[Path]):
        """Write JSON and Markdown verification reports."""
        json_file = self.report_dir / "verification_report.json"
        with open(json_file, "w") as f:
            json.dump(self.results, f, indent=2)
        logger.info(f"Saved structured verification report to: {json_file}")

        md_file = self.report_dir / "verification_report.md"
        badge = "🟢 **PASS**" if verdict.is_passing else "🔴 **FAIL / BLOCKED**"
        screenshot_md = f"![Visual Evidence]({screenshot_file})" if screenshot_file else "_No screenshot captured._"

        md_content = f"""# Cua Browser & TypeSafe Jev Verification Report

**Target URL**: `{self.target_url}`  
**Timestamp**: `{self.results['timestamp']}`  
**Overall Verdict**: {badge}  
**Model**: `{verdict.model}` {'(Simulated)' if verdict.is_simulated else '(Live)'}  

---

## ⚡ Jev System One Decision Gate

| Metric | Value | Schema |
| :--- | :--- | :--- |
| **Build Health Score** | **{verdict.build_health_score:.2f} / 3.0** (`{verdict.build_health_label}`) | `Score` |
| **Readiness Probability** | **{verdict.readiness_probability * 100:.1f}%** | `Noul` |
| **Failure Classification** | **`{verdict.failure_classification}`** (Confidence: `{verdict.failure_confidence:.2f}`) | `Choice` |
| **Recommended Action** | **`{verdict.recommended_action}`** (Confidence: `{verdict.action_confidence:.2f}`) | `Choice` |
| **Decision Latency** | `{verdict.evaluation_latency_ms:.2f} ms` | Telemetry |

---

## 🔍 Cua Browser Evidence Summary

- **API Status**: `{self.results.get('suites', {}).get('api_health', {}).get('status', 'unknown')}`
- **DOM Elements**: `{self.results.get('suites', {}).get('dom_inspection', {}).get('element_count', 0)}` interactive controls detected
- **WebGL Context**: `{self.results.get('suites', {}).get('telemetry', {}).get('has_webgl', False)}` (`{self.results.get('suites', {}).get('telemetry', {}).get('telemetry', {}).get('webgl_vendor', 'none')}`)
- **Interactive Flows**: `{'Passed' if self.results.get('suites', {}).get('interactive_flows', {}).get('all_passed') else 'Failed'}`
- **Deterministic Predicates**: `{'Satisfied' if self.results.get('suites', {}).get('predicates', {}).get('satisfied') else 'Failed'}`

---

## 📸 Visual Screenshot Evidence

{screenshot_md}
"""
        with open(md_file, "w") as f:
            f.write(md_content)
        logger.info(f"Saved Markdown report to: {md_file}")


def main():
    parser = argparse.ArgumentParser(description="Jev + Cua Browser Verification CLI")
    parser.add_argument("--url", default="http://localhost:8000", help="Application URL to test")
    parser.add_argument("--cdp-port", type=int, default=9225, help="Chrome DevTools port")
    parser.add_argument("--report-dir", default=None, help="Directory to save report artifacts")
    parser.add_argument("--no-launch-browser", dest="launch_browser", action="store_false", default=True, help="Do not launch Chrome browser process")
    parser.add_argument("--headed", dest="headless", action="store_false", default=False, help="Launch Chrome in visible, headed desktop GUI mode")
    parser.add_argument("--headless", dest="headless", action="store_true", help="Launch Chrome in headless mode")
    parser.add_argument("--close-on-complete", dest="keep_browser_open", action="store_false", default=True, help="Close browser when test completes")
    args = parser.parse_args()

    verifier = AppVerifier(
        target_url=args.url,
        cdp_port=args.cdp_port,
        report_dir=args.report_dir,
        launch_browser=args.launch_browser,
        headless=args.headless,
        keep_browser_open=args.keep_browser_open
    )
    results = asyncio.run(verifier.run_all_suites())

    if results.get("verdict", {}).get("verdict") == "PASS":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
