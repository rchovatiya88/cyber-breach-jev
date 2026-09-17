"""
Unit and Integration Tests for Cua Browser Runner and Jev Build Verifier.
"""

import unittest
from unittest.mock import patch, Mock
from testing.cua_browser_runner import CuaBrowserRunner
from testing.jev_build_verifier import JevBuildVerifier, VerificationVerdict


class TestCuaJevIntegration(unittest.TestCase):
    def setUp(self):
        self.verifier = JevBuildVerifier()

    def test_clean_build_verification_verdict(self):
        """Verify that an app with online API, active WebGL, and satisfied predicates passes."""
        telemetry = {
            "has_webgl": True,
            "game": {
                "running": True,
                "camera_mode": "chase",
                "scene_objects_count": 50,
                "has_three_scene": True
            },
            "console_errors": []
        }
        browser_state = {
            "title": "CYBER-BREACH",
            "element_count": 12,
            "elements": [
                {"role": "button", "name": "CAM: 3D CHASE", "enabled": True},
                {"role": "button", "name": "JEV AUTOPILOT", "enabled": True}
            ]
        }
        predicate_results = {
            "satisfied": True,
            "predicates_evaluated": 3
        }
        api_health = {"status": "online", "code": 200}

        verdict: VerificationVerdict = self.verifier.evaluate_build(
            telemetry=telemetry,
            browser_state=browser_state,
            predicate_results=predicate_results,
            api_health=api_health
        )

        self.assertTrue(verdict.is_passing)
        self.assertGreaterEqual(verdict.readiness_probability, 0.70)
        self.assertEqual(verdict.build_health_label, "production_verified")
        self.assertEqual(verdict.failure_classification, "clean_pass")
        self.assertEqual(verdict.recommended_action, "approve_and_ship")
        self.assertGreater(verdict.action_confidence, 0.5)

    def test_broken_webgl_failure_triage(self):
        """Verify that a WebGL rendering crash triggers canvas failure classification."""
        telemetry = {
            "has_webgl": False,
            "game": None,
            "console_errors": ["Error: WebGL context creation failed"]
        }
        browser_state = {"element_count": 4, "elements": []}
        predicate_results = {"satisfied": False, "predicates_evaluated": 2}
        api_health = {"status": "online", "code": 200}

        verdict: VerificationVerdict = self.verifier.evaluate_build(
            telemetry=telemetry,
            browser_state=browser_state,
            predicate_results=predicate_results,
            api_health=api_health,
            error_logs=["WebGL context creation failed"]
        )

        self.assertFalse(verdict.is_passing)
        self.assertLess(verdict.readiness_probability, 0.50)
        self.assertEqual(verdict.failure_classification, "canvas_webgl_failure")
        self.assertIn(verdict.recommended_action, ("inspect_webgl_shaders", "halt_and_block_ci"))

    def test_backend_offline_triage(self):
        """Verify that an offline backend blocks the build and recommends API inspection."""
        telemetry = {"has_webgl": True, "game": {}}
        browser_state = {"element_count": 5}
        predicate_results = {"satisfied": True}
        api_health = {"status": "offline", "error": "Connection refused"}

        verdict: VerificationVerdict = self.verifier.evaluate_build(
            telemetry=telemetry,
            browser_state=browser_state,
            predicate_results=predicate_results,
            api_health=api_health
        )

        self.assertFalse(verdict.is_passing)
        self.assertEqual(verdict.failure_classification, "api_backend_offline")
        self.assertIn(verdict.recommended_action, ("inspect_api_server", "halt_and_block_ci"))

    def test_cua_predicate_logic_in_isolation(self):
        """Test predicate evaluation against mock browser state."""
        runner = CuaBrowserRunner(auto_connect=False)
        expectations = [
            {"element": {"selector": {"role": "button", "label_contains": "CONFIG"}, "enabled": True}},
            {"window": {"bounds": {"width": 800, "height": 600, "tolerance_px": 50}}}
        ]

        # Mock get_browser_state
        mock_state = {
            "viewport": {"width": 1024, "height": 768},
            "elements": [
                {"role": "button", "name": "⚙ JEV CONFIG", "enabled": True, "ref": "ref_1"}
            ]
        }

        async def run_check():
            with patch.object(runner, "get_browser_state", return_value=mock_state):
                res = await runner.verify_state(expectations)
                return res

        import asyncio
        res = asyncio.run(run_check())
        self.assertTrue(res["satisfied"])
        self.assertEqual(res["predicates_evaluated"], 2)


if __name__ == "__main__":
    unittest.main()
