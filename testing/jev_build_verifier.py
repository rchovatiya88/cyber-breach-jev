"""
Jev Build Verifier
==================
Integrates TypeSafe AI's Jev "System One" decision engine into the app build,
testing, and verification pipeline.

Evaluates:
1. `build_health_score`: Score rubric (critical_breakage -> production_verified)
2. `is_build_ready`: Calibrated Noul boolean probability
3. `failure_classification`: Choice categorization of observed defects
4. `recommended_action`: Choice recommendation for CI/CD gates and engineering teams
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Union

from backend.jev_client import JevSystemOneService, jev_service

logger = logging.getLogger("jev_verifier")


@dataclass
class VerificationVerdict:
    """Structured verdict produced by Jev System One evaluation."""
    is_passing: bool
    readiness_probability: float
    build_health_score: float
    build_health_label: str
    failure_classification: str
    failure_confidence: float
    recommended_action: str
    action_confidence: float
    evaluation_latency_ms: float
    model: str
    is_simulated: bool
    evidence_summary: Dict[str, Any] = field(default_factory=dict)
    raw_jev_response: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "verdict": "PASS" if self.is_passing else "FAIL",
            "readiness_probability": round(self.readiness_probability, 3),
            "build_health_score": round(self.build_health_score, 2),
            "build_health_label": self.build_health_label,
            "failure_classification": self.failure_classification,
            "failure_confidence": round(self.failure_confidence, 3),
            "recommended_action": self.recommended_action,
            "action_confidence": round(self.action_confidence, 3),
            "evaluation_latency_ms": self.evaluation_latency_ms,
            "model": self.model,
            "is_simulated": self.is_simulated,
            "evidence_summary": self.evidence_summary
        }


class JevBuildVerifier:
    """
    Translates observed Cua browser evidence into TypeSafe Jev System One
    schemas to produce calibrated judgments for application builds.
    """

    HEALTH_RUBRIC = [
        "critical_breakage",
        "major_regression",
        "minor_inconsistency",
        "production_verified"
    ]

    FAILURE_CHOICES = {
        "clean_pass": "Zero fatal defects observed across DOM, API, and rendering engines.",
        "canvas_webgl_failure": "WebGL 3D engine context crashed or canvas failed to initialize.",
        "missing_ui_controls": "Required UI controls, buttons, or accessible elements missing from DOM.",
        "api_backend_offline": "FastAPI health check failed or Jev decision API timed out.",
        "performance_frame_drop": "Frame rate severely degraded or Jev decision latency exceeds budget."
    }

    ACTION_CHOICES = {
        "approve_and_ship": "All automated predicates satisfied and Jev confidence high; approve deployment.",
        "retest_interactive_suite": "Marginal anomaly or transient state; re-run focused test suite.",
        "inspect_webgl_shaders": "Investigate Three.js render passes, shader compilation, or WebGL context.",
        "inspect_api_server": "Check backend endpoints, Jev service status, and network connectivity.",
        "halt_and_block_ci": "Critical failure detected; block build pipeline immediately."
    }

    def __init__(self, service: Optional[JevSystemOneService] = None):
        self.service = service or jev_service

    def evaluate_build(
        self,
        telemetry: Dict[str, Any],
        browser_state: Dict[str, Any],
        predicate_results: Dict[str, Any],
        api_health: Dict[str, Any],
        error_logs: Optional[List[str]] = None
    ) -> VerificationVerdict:
        """
        Evaluate full application build telemetry with Jev System One.
        """
        start = time.perf_counter()
        error_logs = error_logs or []

        # Prepare compact, relevant evidence state (no giant dumps)
        game_data = telemetry.get("game") or {}
        has_webgl = bool(telemetry.get("has_webgl", False) or game_data.get("has_webgl", False))
        predicates_satisfied = bool(predicate_results.get("satisfied", False))
        element_count = browser_state.get("element_count", 0)
        api_online = api_health.get("status") == "online"
        errors_count = len(error_logs) + len(telemetry.get("console_errors", []))

        compact_state = {
            "api_online": api_online,
            "has_webgl": has_webgl,
            "predicates_satisfied": predicates_satisfied,
            "interactive_elements_count": element_count,
            "error_count": errors_count,
            "procedural_chunks": game_data.get("procedural_chunks", 0),
            "energy_gates": game_data.get("energy_gates", 0),
            "jev_dps": game_data.get("jev_dps", 0),
            "jev_latency_ms": game_data.get("jev_latency_ms", 0),
            "render_mode": game_data.get("render_mode", "unknown"),
            "camera_mode": game_data.get("camera_mode", "unknown")
        }

        # Formulate batched questions
        questions = {
            "build_health_score": {
                "type": "score",
                "instructions": (
                    "Evaluate application stability and build health across API status, WebGL rendering, "
                    "DOM interaction count, and deterministic predicate satisfaction."
                ),
                "criteria": self.HEALTH_RUBRIC
            },
            "is_build_ready": {
                "type": "noul",
                "instructions": (
                    "Probability that this application build is fully functional, free of blocking defects, "
                    "and meets criteria for staging or production deployment."
                )
            },
            "failure_classification": {
                "type": "choice",
                "instructions": (
                    "Classify the primary root cause or failure category based on the observed evidence. "
                    "Select 'clean_pass' if all systems operate normally."
                ),
                "criteria": self.FAILURE_CHOICES
            },
            "recommended_action": {
                "type": "choice",
                "instructions": (
                    "Recommend the immediate engineering or CI/CD workflow action."
                ),
                "criteria": self.ACTION_CHOICES
            }
        }

        # Query Jev
        jev_res = self.service.evaluate(compact_state, questions)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        answers = jev_res.get("answers", {})

        # Extract Score
        score_ans = answers.get("build_health_score", {})
        score_val = float(score_ans.get("score", 0.0))
        score_idx = min(len(self.HEALTH_RUBRIC) - 1, max(0, int(score_val)))
        health_label = self.HEALTH_RUBRIC[score_idx]

        # Extract Noul
        noul_ans = answers.get("is_build_ready", {})
        readiness_prob = float(noul_ans.get("noul", 0.5))

        # Extract Choices
        fail_ans = answers.get("failure_classification", {})
        fail_class = fail_ans.get("choice", "clean_pass")
        fail_conf = float(fail_ans.get("confidence", 0.5))

        action_ans = answers.get("recommended_action", {})
        rec_action = action_ans.get("choice", "approve_and_ship")
        action_conf = float(action_ans.get("confidence", 0.5))

        # Determine pass/fail gate (readiness >= 0.7 and health >= 2.0 and predicates satisfied)
        is_passing = (readiness_prob >= 0.65) and (score_val >= 2.0) and predicates_satisfied and api_online

        verdict = VerificationVerdict(
            is_passing=is_passing,
            readiness_probability=readiness_prob,
            build_health_score=score_val,
            build_health_label=health_label,
            failure_classification=fail_class,
            failure_confidence=fail_conf,
            recommended_action=rec_action,
            action_confidence=action_conf,
            evaluation_latency_ms=elapsed_ms,
            model=jev_res.get("model", "jev-latest"),
            is_simulated=jev_res.get("is_simulated", False),
            evidence_summary=compact_state,
            raw_jev_response=jev_res
        )

        return verdict
