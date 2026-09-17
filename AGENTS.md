# Agent Instructions: Cua Browser & Jev Verification

This repository integrates **Cua Browser** ([trycua/cua](https://github.com/trycua/cua)) and **TypeSafe Jev System One** to autonomously test, inspect, and verify web applications during development and build pipelines.

---

## ⚡ Quickstart for Agents

### 1. One-Line Full Verification Command
When you build features, modify frontend/backend code, or prepare a release, run:
```bash
python3 -m testing.verify_app --url http://localhost:8000 --cdp-port 9225
```
- **Exit Code 0 (`PASS`)**: All deterministic predicates passed, WebGL/DOM intact, Jev readiness $\ge 65\%$, health score $\ge 2.0/3$. Safe to proceed.
- **Exit Code 1 (`FAIL`)**: Anomaly or failure detected. Check the generated triage report in `scratch/verification_reports/verification_report.md`.

### 2. Unit & Integration Tests
Before and after modifying verification or Jev schemas:
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

---

## 🧭 How to Use in Python Scripts

You can import and use the runner and verifier directly in custom scripts:

```python
import asyncio
from testing import CuaBrowserRunner, JevBuildVerifier

async def verify():
    # 1. Connect Cua Browser (attaches to active tab on DevTools port)
    runner = CuaBrowserRunner(cdp_port=9225)
    await runner.initialize()

    # 2. Extract Cua Semantic Outline (DOM roles, accessible names, refs)
    state = await runner.get_browser_state("semantic_v2")
    print(f"Found {state['element_count']} interactive elements")

    # 3. Simulate User Actions
    await runner.press_key("v")          # Toggle camera view
    await runner.click("ref_2")          # Click element by Cua ref (or CSS selector)
    await runner.type_text("ref_3", "x") # Type into input

    # 4. Deterministic Predicate Verification (Cua verify_state)
    predicates = [
        {"element": {"selector": {"role": "button", "label_contains": "CAM"}, "enabled": True}},
        {"window": {"bounds": {"x": 0, "y": 0, "width": 640, "height": 480, "tolerance_px": 50}}}
    ]
    pred_results = await runner.verify_state(predicates)

    # 5. Extract Engine & App Telemetry
    telemetry = await runner.get_app_telemetry()

    # 6. Evaluate with Jev System One
    verifier = JevBuildVerifier()
    verdict = verifier.evaluate_build(
        telemetry=telemetry,
        browser_state=state,
        predicate_results=pred_results,
        api_health={"status": "online"}
    )

    print("Verdict:", verdict.is_passing)
    print("Health Score:", verdict.build_health_score, f"({verdict.build_health_label})")
    print("Readiness:", f"{verdict.readiness_probability * 100:.1f}%")
    print("Recommended Action:", verdict.recommended_action)

    await runner.close()

asyncio.run(verify())
```

---

## 🎯 What the Verifier Evaluates

| Primitive | Metric | Meaning & Use |
| :--- | :--- | :--- |
| **`Score`** | `build_health_score` | Ordinal evaluation along rubric: `0: critical_breakage`, `1: major_regression`, `2: minor_inconsistency`, `3: production_verified`. |
| **`Noul`** | `is_build_ready` | Calibrated boolean probability ($0.0 \to 1.0$) indicating whether the build is stable and bug-free. |
| **`Choice`** | `failure_classification` | Categorizes root cause: `clean_pass`, `canvas_webgl_failure`, `missing_ui_controls`, `api_backend_offline`, `performance_frame_drop`. |
| **`Choice`** | `recommended_action` | Actionable recommendation: `approve_and_ship`, `retest_interactive_suite`, `inspect_webgl_shaders`, `inspect_api_server`, `halt_and_block_ci`. |

---

## 📁 Output Artifacts

Every verification run automatically generates artifacts in `scratch/verification_reports/`:
- **`verification_report.md`**: Human and agent-readable summary with badge, rubric table, Jev confidence scores, and findings.
- **`verification_report.json`**: Machine-readable JSON summary for CI pipelines.
- **`cua_action_trajectory.json`**: Recorded turn-by-turn Cua interaction trajectory for benchmark analysis and reproducibility.
- **`cua_verification_evidence.png`**: High-resolution browser screenshot captured during the test.

---

## 🛡️ Best Practices for AI Agents

1. **Always verify after UI or server edits**: Run `python3 -m testing.verify_app` to ensure your code change didn't break 3D WebGL rendering, DOM controls, or API endpoints.
2. **Read the Jev recommendation**: If Jev returns `inspect_webgl_shaders` or `inspect_api_server`, focus on those areas first instead of guessing randomly.
3. **Never bypass failing predicates**: Deterministic predicate failure means an interactive control was not found in the DOM or an assertion failed.
4. **Trajectory re-use**: When benchmarking model speed or browser interaction latency, consult `cua_action_trajectory.json`.
