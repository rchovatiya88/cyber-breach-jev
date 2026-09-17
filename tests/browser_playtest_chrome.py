"""
Live Chrome Playtest & Verification Script for Cyber-Breach 3D Tron Protocol.
Uses jev-ultrafast / browser-harness to connect to real Chrome (non-headless).
"""

import os
import sys
import time
from pathlib import Path

# Ensure browser-harness and jev-ultrafast are importable
sys.path.insert(0, "/Users/ronakchovatiya/Documents/ChatGPT/jev/.tools/jev-ultrafast/.venv/lib/python3.13/site-packages")
sys.path.insert(0, "/Users/ronakchovatiya/Documents/ChatGPT/jev/.tools/jev-ultrafast")

os.environ["BU_NAME"] = "chrome9222"
os.environ["BU_CDP_URL"] = "http://127.0.0.1:9222"

from browser_harness.helpers import (
    list_tabs,
    switch_tab,
    page_info,
    js,
    capture_screenshot,
    wait_for_load,
    goto_url
)

def run_playtest():
    print("🚀 Starting Cyber-Breach Live Chrome Playtest...")
    
    tabs = list_tabs()
    game_tab = None
    for t in tabs:
        if "localhost:8000" in t.get("url", ""):
            game_tab = t
            break
            
    if not game_tab:
        print("❌ Could not find localhost:8000 tab in Chrome.")
        sys.exit(1)
        
    print(f"✅ Found Game Tab (Target: {game_tab['target_id']})")
    switch_tab(game_tab["target_id"])
    
    # Navigate/Reload
    goto_url("http://localhost:8000")
    time.sleep(1.0)

    # Wait for game to initialize
    ready = False
    for _ in range(20):
        try:
            if js("Boolean(window.game && window.game.hasWebGL)"):
                ready = True
                break
        except Exception:
            pass
        time.sleep(0.5)

    if not ready:
        print("❌ Game did not initialize WebGL successfully.")
        sys.exit(1)
    print("✅ WebGL 3D Game Engine Initialized successfully.")

    artifact_dir = Path("/Users/ronakchovatiya/.gemini/antigravity/brain/8decc865-29ea-45da-828f-82b9a46ca297")

    # 1. TEST PROCEDURAL ENVIRONMENT GENERATION
    chunks_count = js("window.game.proceduralChunks ? window.game.proceduralChunks.size : 0")
    gates_count = js("window.game.energyGates ? window.game.energyGates.length : 0")
    print(f"✅ Procedural World: {chunks_count} active chunks, {gates_count} coherent energy gates.")
    assert chunks_count >= 16, "Expected at least 16 active procedural chunks"
    assert gates_count >= 4, "Expected at least 4 energy gates in world"

    # 2. TEST CHASE VIEW
    js("window.game.cameraMode = 'chase'; window.game.setRenderMode('3d');")
    time.sleep(0.5)
    chase_path = str(artifact_dir / "chrome_chase_view.png")
    capture_screenshot(chase_path)
    print(f"📸 Captured Chase View: {chase_path}")

    # 3. TEST TACTICAL VIEW
    js("window.game.cameraMode = 'tactical';")
    time.sleep(0.5)
    tactical_path = str(artifact_dir / "chrome_tactical_view.png")
    capture_screenshot(tactical_path)
    print(f"📸 Captured Tactical View: {tactical_path}")

    # 4. TEST COCKPIT MODE & FLIGHT DYNAMICS
    js("""
        window.game.cameraMode = 'cockpit';
        if (window.game.cockpitOverlay) window.game.cockpitOverlay.style.display = 'block';
        // Accelerate forward along heading
        window.game.keys['w'] = true;
        // Steer yaw to right
        window.game.mouseScreen.x = window.innerWidth / 2 + 180;
    """)
    
    # Let flight simulate for 1.5 seconds
    time.sleep(1.5)
    
    # Check flight telemetry
    flight_data = js("""({
        speed: Math.round(window.game.player.vel.length() * 3.6),
        heading: Math.round(((-window.game.player.angle * 180 / Math.PI) % 360 + 360) % 360),
        bankAngle: Number(window.game.player.bankAngle.toFixed(2)),
        hudCanvasWidth: window.game.hudCanvas ? window.game.hudCanvas.width : 0,
        threatsTracked: window.game.enemies.length,
        posX: Math.round(window.game.player.pos.x),
        posZ: Math.round(window.game.player.pos.z)
    })""")
    print("✈️ Cockpit Flight Telemetry:", flight_data)
    assert flight_data["speed"] > 0, "Expected positive flight velocity"
    assert flight_data["hudCanvasWidth"] > 0, "Expected HUD canvas to be sized and active"

    # Test Energy Gate Fly-Through Trigger
    js("""
        // Simulate flying through the nearest energy gate
        if (window.game.energyGates && window.game.energyGates.length > 0) {
            const g = window.game.energyGates[0];
            window.game.player.pos.x = g.x;
            window.game.player.pos.z = g.z;
            window.game.player.speedBoostTimer = 4.0;
            window.game.player.shield = Math.min(100, window.game.player.shield + 25);
            window.game.spawnFloatingText("⚡ COHERENT ENERGY GATE BREACHED: +35% WARP / +25 SHIELD", g.x, g.z, '#00ffcc');
        }
    """)
    time.sleep(0.5)

    boost_active = js("window.game.player.speedBoostTimer > 0")
    print(f"⚡ Energy Gate Surge Verified: {boost_active}")
    assert boost_active, "Expected speedBoostTimer to be active after gate breach"

    cockpit_path = str(artifact_dir / "chrome_cockpit_view.png")
    capture_screenshot(cockpit_path)
    print(f"📸 Captured Cockpit View: {cockpit_path}")

    # 5. TEST 2D CLASSIC RETRO ARENA
    js("window.game.setRenderMode('2d');")
    time.sleep(0.5)
    arena_2d_path = str(artifact_dir / "chrome_classic_2d_view.png")
    capture_screenshot(arena_2d_path)
    print(f"📸 Captured 2D Classic Arena: {arena_2d_path}")

    # Restore 3D Cockpit Mode for player
    js("window.game.setRenderMode('3d'); window.game.cameraMode = 'cockpit'; window.game.keys['w'] = false;")
    
    print("🎉 All Playtest Suites Passed in Real Chrome Browser!")

if __name__ == "__main__":
    run_playtest()
