from typing import Dict, Any
from backend.jev_client import jev_service

def decide_bot_actions(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates autonomous player control (Jev Protocol Bot) at high speed,
    replicating the real-time Doom bot demonstration.
    """
    questions = {
        "navigation_action": {
            "type": "choice",
            "instructions": "Select the optimal movement vector for the operative unit.",
            "criteria": {
                "circle_strafe_cw": "Circle strafe clockwise around central threats while maintaining distance",
                "circle_strafe_ccw": "Circle strafe counter-clockwise around central threats while maintaining distance",
                "retreat_open_space": "Backpedal away from approaching clusters towards open arena zones",
                "rush_pickup": "Navigate directly towards the nearest health or powerup canister",
                "aggressive_pursuit": "Advance aggressively towards isolated or low-health hostiles",
            },
        },
        "target_priority": {
            "type": "choice",
            "instructions": "Determine weapon aiming priority on the battlefield.",
            "criteria": {
                "focus_nearest": "Aim at the closest hostile unit",
                "focus_boss": "Prioritize heavy dreadnought or apex boss",
                "clear_swarms": "Aim at fast low-HP stalkers rushing the operative",
            },
        },
        "trigger_fire": {
            "type": "noul",
            "instructions": "Should the operative fire primary plasma blasters right now?",
        },
        "trigger_dash": {
            "type": "noul",
            "instructions": "Should the operative execute an emergency quantum blink/dash to evade damage?",
        },
        "threat_pressure": {
            "type": "score",
            "instructions": "Score the immediate survival pressure on the operative.",
            "criteria": [
                "safe",
                "controlled_skirmish",
                "heavy_pressure",
                "critical_survival",
            ],
        },
    }

    result = jev_service.evaluate(state=state, questions=questions)
    return result
