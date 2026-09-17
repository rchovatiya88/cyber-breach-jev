from typing import Dict, Any
from backend.jev_client import jev_service

def decide_enemy_tactics(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates enemy tactical decisions using Jev's System One model.
    Takes the immediate combat snapshot and queries Choice, Score, and Noul questions.
    """
    questions = {
        "combat_action": {
            "type": "choice",
            "instructions": "Select the optimal immediate combat maneuver for this synthetic unit against the operative.",
            "criteria": {
                "flank_left": "Circle towards operative's left flank to break line of sight",
                "flank_right": "Circle towards operative's right flank to find opening",
                "direct_charge": "Close distance aggressively with melee or shotgun burst",
                "take_cover": "Backpedal to safer range and seek tactical distance",
                "suppressive_fire": "Hold position and unleash continuous plasma barrage",
                "special_ability": "Trigger unit special ability (EMP shockwave, phase dash, or barrier shield)",
            },
        },
        "threat_assessment": {
            "type": "score",
            "instructions": "Evaluate the current threat level posed by the operative to this cyber unit.",
            "criteria": [
                "minimal_threat",
                "moderate_danger",
                "high_threat",
                "critical_danger",
                "fatal_threat",
            ],
        },
        "is_player_vulnerable": {
            "type": "noul",
            "instructions": "Is the operative in a vulnerable state (reloading, low health, caught without dash)?",
        },
        "trigger_berserk": {
            "type": "noul",
            "instructions": "Should this unit enter berserk overclock mode (speed increase and damage boost)?",
        },
    }

    result = jev_service.evaluate(state=state, questions=questions)
    return result
