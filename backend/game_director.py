from typing import Dict, Any
from backend.jev_client import jev_service

def decide_director_event(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates macro encounter pacing and dynamic events using Jev System One.
    """
    questions = {
        "director_event": {
            "type": "choice",
            "instructions": "Determine the next dynamic battlefield mutation or encounter event.",
            "criteria": {
                "tactical_supply_drop": "Airdrop emergency nanite repair or shield battery to player",
                "swarming_ambush": "Open quantum rift and spawn rapid-striking cyber stalkers",
                "heavy_incursion": "Deploy heavily armored dreadnought mech into the arena",
                "laser_hazard_grid": "Activate sweeping neon defense laser grids across arena sectors",
                "glitch_overdrive": "Trigger global matrix overdrive, granting player double fire rate and speed",
            },
        },
        "pacing_tension": {
            "type": "score",
            "instructions": "Score the current narrative/combat tension based on operative health and streak.",
            "criteria": [
                "downtime_calm",
                "rising_action",
                "combat_climax",
                "apocalyptic_chaos",
            ],
        },
        "grant_emergency_aid": {
            "type": "noul",
            "instructions": "Is the operative in dire mortal danger and deserving of emergency aid?",
        },
        "escalate_difficulty": {
            "type": "noul",
            "instructions": "Has the operative dominated current wave to warrant immediate spawn escalation?",
        },
        "tactical_copilot_advisory": {
            "type": "choice",
            "instructions": "Select the highest priority tactical combat advisory for the operative flight HUD.",
            "criteria": {
                "scan_flank_threat": "Flank threat approaching lateral vector; advise pilot to check warning chevrons",
                "gate_speed_recommended": "Energy recharge gate detected in sector; vector through gate for shield recharge",
                "evade_incoming_fire": "Heavy projectile barrage inbound; initiate lateral strafe thrusters or quantum blink",
                "weapons_free_target_lock": "Enemy locked in forward firing cone; unleash twin blasters",
                "optimal_combat_rhythm": "Grid telemetry optimal; maintain high-speed circular strafe rhythm",
            },
        },
    }

    result = jev_service.evaluate(state=state, questions=questions)
    return result
