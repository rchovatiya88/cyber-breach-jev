import unittest
from backend.jev_client import JevSystemOneService
from backend.enemy_ai import decide_enemy_tactics
from backend.game_director import decide_director_event
from backend.bot_pilot import decide_bot_actions


class TestJevIntegration(unittest.TestCase):
    def setUp(self):
        self.service = JevSystemOneService()

    def test_client_status(self):
        status = self.service.get_status()
        self.assertIn("has_api_key", status)
        self.assertIn("is_live", status)
        self.assertIn("model", status)

    def test_enemy_ai_decision_structure(self):
        state = {
            "enemy_id": "test_enemy_1",
            "enemy_type": "stalker",
            "distance_to_player": 180,
            "player_hp_pct": 50,
            "enemy_hp_pct": 80,
            "player_is_dashing": False,
            "player_is_reloading": False,
            "bullets_nearby": 1,
            "allies_alive": 4,
            "boss_present": False,
        }
        res = decide_enemy_tactics(state)
        self.assertTrue(res["success"])
        self.assertIn("answers", res)

        # Verify Choice
        choice_ans = res["answers"].get("combat_action")
        self.assertIsNotNone(choice_ans)
        self.assertIn("choice", choice_ans)
        self.assertIn("probabilities", choice_ans)
        self.assertIn("confidence", choice_ans)

        # Verify Score
        score_ans = res["answers"].get("threat_assessment")
        self.assertIsNotNone(score_ans)
        self.assertIn("score", score_ans)
        self.assertIn("legend", score_ans)

        # Verify Noul
        noul_ans = res["answers"].get("is_player_vulnerable")
        self.assertIsNotNone(noul_ans)
        self.assertIn("noul", noul_ans)
        self.assertGreaterEqual(noul_ans["noul"], 0.0)
        self.assertLessEqual(noul_ans["noul"], 1.0)

    def test_game_director_decision_structure(self):
        state = {
            "wave": 3,
            "player_health": 25,
            "kill_streak": 15,
            "active_enemies": 2,
        }
        res = decide_director_event(state)
        self.assertTrue(res["success"])
        self.assertIn("director_event", res["answers"])
        self.assertIn("pacing_tension", res["answers"])
        self.assertIn("grant_emergency_aid", res["answers"])

        # When player health is low, emergency aid probability should be significant
        aid_prob = res["answers"]["grant_emergency_aid"]["noul"]
        self.assertGreater(aid_prob, 0.4)

    def test_bot_pilot_decision_structure(self):
        state = {
            "player_hp": 85,
            "player_shield": 50,
            "incoming_bullets_count": 3,
            "distance_to_nearest_enemy": 120,
            "dash_charges": 2,
            "is_overheated": False,
            "pickups_available": False,
        }
        res = decide_bot_actions(state)
        self.assertTrue(res["success"])
        self.assertIn("navigation_action", res["answers"])
        self.assertIn("target_priority", res["answers"])
        self.assertIn("trigger_fire", res["answers"])
        self.assertIn("trigger_dash", res["answers"])

        # With 3 incoming bullets, dash trigger probability should be high
        dash_prob = res["answers"]["trigger_dash"]["noul"]
        self.assertGreater(dash_prob, 0.6)


if __name__ == "__main__":
    unittest.main()
