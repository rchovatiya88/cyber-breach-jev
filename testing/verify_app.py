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

from testing.cua_browser_runner import CuaBrowserRunner
from testing.jev_build_verifier import JevBuildVerifier, VerificationVerdict

logger = logging.getLogger("verify_app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class AppVerifier:
    """
    Orchestrates end-to-end verification workflows combining Cua Browser actions
    with Jev System One structured decisions.
    """

    def __init__(self, target_url: str = "http://localhost:8000", cdp_port: int = 9225, report_dir: Optional[str] = None):
        self.target_url = target_url
        self.cdp_port = cdp_port
        self.report_dir = Path(report_dir) if report_dir else Path("./scratch/verification_reports")
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.runner = CuaBrowserRunner(cdp_port=self.cdp_port)
        self.verifier = JevBuildVerifier()
        self.results: Dict[str, Any] = {
            "target_url": target_url,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "suites": {},
            "verdict": None
        }

    async def run_all_suites(self) -> Dict[str, Any]:
        """Execute all verification phases and return the final report."""
        logger.info(f"🚀 Starting Cua + Jev Verification Pipeline for {self.target_url}")
        
        # 1. API Health & Connectivity Suite
        api_health = await self._run_api_health_suite()
        self.results["suites"]["api_health"] = api_health

        # Initialize Cua Browser
        connected = await self.runner.initialize()
        if not connected:
            logger.error(f"❌ Failed to connect to Cua Browser target on port {self.cdp_port}.")
            self.results["suites"]["browser_connection"] = {"status": "failed", "error": "CDP connection refused"}
            # Let Jev evaluate the failure
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

        self.runner.start_recording()

        # 2. Page & DOM Inspection Suite
        dom_suite = await self._run_dom_inspection_suite()
        self.results["suites"]["dom_inspection"] = dom_suite

        # 3. Interactive Flow Suite
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
        logger.info("Simulating interactive user flows...")
        flow_results = []

        # Flow A: Toggle Camera (key 'v')
        cam_before = await self.runner.evaluate_js("window.game ? window.game.cameraMode : null")
        await self.runner.press_key("v")
        await asyncio.sleep(0.3)
        cam_after = await self.runner.evaluate_js("window.game ? window.game.cameraMode : null")
        toggled = cam_before != cam_after
        flow_results.append({
            "flow": "toggle_camera",
            "key": "v",
            "before": cam_before,
            "after": cam_after,
            "verified": toggled
        })
        logger.info(f"  - Camera toggle: {cam_before} -> {cam_after} (verified: {toggled})")

        # Flow B: Engage Autopilot (key 'p')
        ap_before = await self.runner.evaluate_js("window.game ? Boolean(window.game.autoPilot) : null")
        await self.runner.press_key("p")
        await asyncio.sleep(0.3)
        ap_after = await self.runner.evaluate_js("window.game ? Boolean(window.game.autoPilot) : null")
        flow_results.append({
            "flow": "toggle_autopilot",
            "key": "p",
            "before": ap_before,
            "after": ap_after,
            "verified": ap_after is not None
        })
        logger.info(f"  - Autopilot toggle: {ap_before} -> {ap_after}")

        # Flow C: Toggle Config Modal via Cua Click
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
            # Close modal
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
    args = parser.parse_args()

    verifier = AppVerifier(target_url=args.url, cdp_port=args.cdp_port, report_dir=args.report_dir)
    results = asyncio.run(verifier.run_all_suites())

    if results.get("verdict", {}).get("verdict") == "PASS":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
