import os
import time
import random
import logging
from typing import Dict, Any, Optional, Union, List

logger = logging.getLogger("jev_client")
logging.basicConfig(level=logging.INFO)

# Attempt to import official TypeSafe SDK
try:
    from typesafe_sdk import (
        TypeSafeClient,
        AsyncTypeSafeClient,
        Choice,
        Score,
        Noul,
        SystemOneResponse,
        ChoiceAnswer,
        ScoreAnswer,
        NoulAnswer,
    )
    TYPESAFE_AVAILABLE = True
except ImportError:
    TYPESAFE_AVAILABLE = False
    logger.warning("typesafe_sdk not installed. Fallback simulator will be used.")


class JevSystemOneService:
    """
    Client service for TypeSafe AI's Jev "System One" decision model.
    Seamlessly routes to live TypeSafe API (jev-latest) when an API key is available,
    or falls back to an offline calibrated decision engine when offline or unconfigured.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "jev-latest"):
        self.api_key = api_key or os.environ.get("TYPESAFE_API_KEY") or os.environ.get("JEV_API_KEY")
        self.model = model
        self.client: Optional[Any] = None
        self._init_client()

    def _init_client(self):
        if TYPESAFE_AVAILABLE and self.api_key:
            try:
                self.client = TypeSafeClient(api_key=self.api_key, model=self.model)
                logger.info(f"Initialized live TypeSafeClient with model '{self.model}'.")
            except Exception as e:
                logger.error(f"Failed to initialize TypeSafeClient: {e}")
                self.client = None
        else:
            self.client = None

    def set_api_key(self, api_key: str):
        """Update API key dynamically at runtime."""
        self.api_key = api_key.strip()
        self._init_client()

    def get_status(self) -> Dict[str, Any]:
        return {
            "has_api_key": bool(self.api_key),
            "is_live": self.client is not None,
            "model": self.model,
            "typesafe_sdk_installed": TYPESAFE_AVAILABLE,
        }

    def evaluate(self, state: Dict[str, Any], questions: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate unstructured or structured game state against schema questions.
        Returns serialized response matching TypeSafe Jev output format.
        """
        start_time = time.perf_counter()

        # If live client is active, attempt live evaluation
        if self.client is not None:
            try:
                # Convert question specs into typesafe_sdk question primitives if needed
                sdk_questions = {}
                for key, q in questions.items():
                    q_type = q.get("type", "").lower()
                    instructions = q.get("instructions", "")
                    criteria = q.get("criteria")

                    if q_type == "choice":
                        sdk_questions[key] = Choice(instructions=instructions, criteria=criteria)
                    elif q_type == "score":
                        sdk_questions[key] = Score(instructions=instructions, criteria=criteria)
                    elif q_type == "noul":
                        sdk_questions[key] = Noul(instructions=instructions)
                    else:
                        sdk_questions[key] = Noul(instructions=instructions)

                response: SystemOneResponse = self.client.system_one(
                    state=state,
                    questions=sdk_questions,
                    model=self.model,
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                # Format response dictionary
                serialized_answers = {}
                serialized_choices = {}
                serialized_scores = {}
                serialized_nouls = {}

                for k, ans in response.answers.items():
                    if isinstance(ans, ChoiceAnswer):
                        val = {
                            "choice": ans.choice,
                            "confidence": ans.confidence,
                            "probabilities": ans.probabilities,
                        }
                        serialized_answers[k] = val
                        serialized_choices[k] = val
                    elif isinstance(ans, ScoreAnswer):
                        val = {
                            "score": ans.score,
                            "confidence": ans.confidence,
                            "legend": ans.legend,
                            "probabilities": ans.probabilities,
                        }
                        serialized_answers[k] = val
                        serialized_scores[k] = val
                    elif isinstance(ans, NoulAnswer):
                        val = {"noul": ans.noul}
                        serialized_answers[k] = val
                        serialized_nouls[k] = val

                return {
                    "success": True,
                    "is_simulated": False,
                    "model": response.model,
                    "latency_ms": latency_ms,
                    "answers": serialized_answers,
                    "choices": serialized_choices,
                    "scores": serialized_scores,
                    "nouls": serialized_nouls,
                }
            except Exception as e:
                logger.warning(f"Live TypeSafe API query failed: {e}. Falling back to calibrated simulator.")

        # Calibrated System One simulator fallback
        return self._simulate_system_one(state, questions, start_time)

    def _simulate_system_one(
        self, state: Dict[str, Any], questions: Dict[str, Any], start_time: float
    ) -> Dict[str, Any]:
        """
        Calibrated local emulation of Jev System One decision engine.
        Uses game state metrics to produce probabilistic, calibrated decisions
        adhering strictly to Choice, Score, and Noul schemas.
        """
        answers = {}
        choices = {}
        scores = {}
        nouls = {}

        player_hp = float(state.get("player_hp_pct", 100))
        dist = float(state.get("distance_to_player", 300))
        player_dashing = bool(state.get("player_is_dashing", False))
        player_reloading = bool(state.get("player_is_reloading", False))
        enemy_type = state.get("enemy_type", "stalker")
        allies_alive = int(state.get("allies_alive", 3))
        urgency_raw = float(state.get("combat_urgency", 0.5))
        incoming_bullets = int(state.get("incoming_bullets_count", 0))

        for key, q in questions.items():
            q_type = q.get("type", "").lower()
            criteria = q.get("criteria")
            instructions = q.get("instructions", "")

            if q_type == "choice":
                # Calculate weights based on state and candidate criteria
                options = list(criteria.keys()) if isinstance(criteria, dict) else list(criteria or ["A", "B"])
                raw_weights = {}

                for opt in options:
                    w = 1.0
                    # Build verification & triage heuristics
                    if "api_online" in state or "has_webgl" in state or "predicates_satisfied" in state:
                        api_ok = bool(state.get("api_online", True))
                        webgl_ok = bool(state.get("has_webgl", True))
                        preds_ok = bool(state.get("predicates_satisfied", True))
                        errs = int(state.get("error_count", 0))

                        if opt in ("clean_pass", "approve_and_ship"):
                            w = 8.0 if (api_ok and webgl_ok and preds_ok and errs == 0) else 0.05
                        elif opt in ("canvas_webgl_failure", "inspect_webgl_shaders"):
                            w = 10.0 if not webgl_ok else 0.05
                        elif opt in ("api_backend_offline", "inspect_api_server"):
                            w = 10.0 if not api_ok else 0.05
                        elif opt in ("missing_ui_controls", "retest_interactive_suite"):
                            w = 6.0 if not preds_ok else 0.05
                        elif opt in ("halt_and_block_ci",):
                            w = 8.0 if (not api_ok or not webgl_ok or errs > 3) else 0.05
                    else:
                        # Tactic adjustments based on battlefield geometry
                        if opt in ("flank_left", "circle_strafe_ccw"):
                            w += 2.0 if dist < 250 else 1.0
                        elif opt in ("flank_right", "circle_strafe_cw"):
                            w += 2.0 if dist < 250 else 1.0
                        elif opt in ("charge", "rush_forward", "direct_charge"):
                            w += 3.5 if (player_reloading or player_hp < 30) else 0.4
                            w += 2.0 if enemy_type in ("heavy", "boss") else 0.5
                        elif opt in ("retreat_cover", "retreat_from_swarms", "retreat"):
                            w += 4.0 if (player_dashing or incoming_bullets > 3 or player_hp > 80) else 0.5
                        elif opt in ("suppressive_fire", "emp_blast", "special_ability"):
                            w += 2.5 if dist > 150 else 1.0
                        elif opt in ("evasive_dodge",):
                            w += 5.0 if incoming_bullets > 2 else 0.3
                        elif opt in ("rush_pickup",):
                            w += 4.0 if player_hp < 40 else 0.8
                        elif opt in ("focus_boss",):
                            w += 3.0 if state.get("boss_present") else 0.2
                        elif opt in ("focus_nearest", "crowd_control"):
                            w += 2.0

                    # Add slight temperature entropy
                    raw_weights[opt] = max(0.01, w * random.uniform(0.92, 1.08))

                total_weight = sum(raw_weights.values())
                probabilities = {opt: round(raw_weights[opt] / total_weight, 4) for opt in options}
                chosen_opt = max(probabilities.items(), key=lambda x: x[1])[0]
                confidence = probabilities[chosen_opt]

                choice_ans = {
                    "choice": chosen_opt,
                    "confidence": confidence,
                    "probabilities": probabilities,
                }
                answers[key] = choice_ans
                choices[key] = choice_ans

            elif q_type == "score":
                # Ordinal rubric scoring
                levels = criteria if isinstance(criteria, list) else ["low", "medium", "high", "critical"]
                num_levels = len(levels)

                # Estimate base intensity between 0.0 and 1.0
                if "health" in key or "stability" in key:
                    api_ok = 1.0 if state.get("api_online", True) else 0.0
                    webgl_ok = 1.0 if state.get("has_webgl", True) else 0.0
                    preds_ok = 1.0 if state.get("predicates_satisfied", True) else 0.0
                    errs = min(5, int(state.get("error_count", 0)))
                    intensity = (api_ok * 0.3 + webgl_ok * 0.35 + preds_ok * 0.35) - (errs * 0.15)
                elif "threat" in key or "tension" in key:
                    intensity = 1.0 - (player_hp / 100.0) * 0.5 + (incoming_bullets * 0.1)
                elif "urgency" in key:
                    intensity = urgency_raw + (incoming_bullets * 0.15)
                else:
                    intensity = random.uniform(0.2, 0.8)

                intensity = max(0.0, min(1.0, intensity))
                score_index = min(num_levels - 1, int(intensity * num_levels))
                
                # Calibrated probabilities across levels
                probs = {}
                for idx in range(num_levels):
                    dist_from_target = abs(idx - score_index)
                    p = max(0.02, 1.0 / (1.0 + dist_from_target * 2.5))
                    probs[idx] = p
                
                tot = sum(probs.values())
                norm_probs = {idx: round(p / tot, 4) for idx, p in probs.items()}
                
                legend = {idx: levels[idx] for idx in range(num_levels)}
                score_ans = {
                    "score": float(score_index),
                    "confidence": norm_probs[score_index],
                    "legend": legend,
                    "probabilities": norm_probs,
                }
                answers[key] = score_ans
                scores[key] = score_ans

            elif q_type == "noul":
                # Boolean probability (0.0 to 1.0)
                if "ready" in key:
                    api_ok = bool(state.get("api_online", True))
                    webgl_ok = bool(state.get("has_webgl", True))
                    preds_ok = bool(state.get("predicates_satisfied", True))
                    errs = int(state.get("error_count", 0))
                    if api_ok and webgl_ok and preds_ok and errs == 0:
                        prob = 0.96
                    elif not api_ok or not webgl_ok:
                        prob = 0.08
                    else:
                        prob = 0.45
                elif "vulnerable" in key:
                    prob = 0.85 if (player_reloading or player_hp < 25) else (0.1 if player_dashing else 0.35)
                elif "enrage" in key or "boss" in key:
                    prob = 0.9 if player_hp < 35 or dist < 120 else 0.25
                elif "fire" in key:
                    prob = 0.95 if dist < 350 and not player_dashing else 0.2
                elif "dash" in key:
                    prob = 0.9 if incoming_bullets >= 2 else 0.15
                elif "pity" in key or "supply" in key:
                    prob = 0.85 if player_hp < 30 else 0.15
                elif "hazard" in key:
                    prob = 0.4 + (float(state.get("wave", 1)) * 0.08)
                else:
                    prob = 0.5

                prob = max(0.05, min(0.98, prob * random.uniform(0.9, 1.1)))
                noul_ans = {"noul": round(prob, 3)}
                answers[key] = noul_ans
                nouls[key] = noul_ans

        latency_ms = round((time.perf_counter() - start_time) * 1000 + random.uniform(2.0, 8.0), 2)

        return {
            "success": True,
            "is_simulated": True,
            "model": "jev-latest (calibrated simulator)",
            "latency_ms": latency_ms,
            "answers": answers,
            "choices": choices,
            "scores": scores,
            "nouls": nouls,
        }


# Singleton service instance
jev_service = JevSystemOneService()
