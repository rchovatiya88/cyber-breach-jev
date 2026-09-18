"""
Cua Browser Runner
==================
Integrates Cua Driver (trycua/cua) with browser automation for application
testing, telemetry observation, and deterministic state verification.

Supports:
- Cua Driver native SDK & CLI integration
- Cua semantic element extraction (semantic_v2 / dom_refs_v1)
- Deterministic predicate evaluation (verify_state)
- CDP-backed low-latency execution and headless fallback
- Visual evidence capture and trajectory recording
"""

import os
import sys
import time
import json
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Tuple

import aiohttp

logger = logging.getLogger("cua_browser")
logging.basicConfig(level=logging.INFO)

# Attempt to load native cua_driver
try:
    import cua_driver
    CUA_SDK_AVAILABLE = True
except ImportError:
    CUA_SDK_AVAILABLE = False
    logger.warning("cua_driver not found in Python path.")


# JavaScript helper to extract Cua-style semantic DOM nodes & elements
CUA_SEMANTIC_SNAPSHOT_JS = """
(() => {
    const visible = (el) => {
        if (!el || el.nodeType !== 1) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };

    const getAccessibleName = (el) => {
        return el.getAttribute('aria-label') ||
               el.getAttribute('title') ||
               el.getAttribute('placeholder') ||
               el.innerText?.trim() ||
               el.value || '';
    };

    const elements = [];
    let nextRef = 1;

    // Interactive and semantic roles
    const interactiveSelectors = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="switch"], [role="tab"], canvas, [onclick]';
    const nodes = document.querySelectorAll(interactiveSelectors);

    for (const node of nodes) {
        if (!visible(node)) continue;
        const rect = node.getBoundingClientRect();
        const role = node.getAttribute('role') || node.tagName.toLowerCase();
        const name = getAccessibleName(node);
        const refId = `ref_${nextRef++}`;
        
        node.setAttribute('data-cua-ref', refId);

        elements.push({
            ref: refId,
            tag: node.tagName.toLowerCase(),
            role: role,
            name: name.slice(0, 120),
            id: node.id || null,
            classes: Array.from(node.classList),
            bounds: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            enabled: !node.disabled,
            value: node.value ?? null
        });
    }

    return {
        title: document.title,
        url: window.location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        elements: elements,
        element_count: elements.length,
        timestamp: Date.now()
    };
})()
"""


class CuaBrowserRunner:
    """
    High-level automation and verification runner implementing Cua Driver semantics.
    """

    def __init__(self, cdp_port: int = 9225, auto_connect: bool = True):
        self.cdp_port = cdp_port
        self.cdp_host = "127.0.0.1"
        self.session_id: Optional[str] = None
        self.ws_url: Optional[str] = None
        self.native_driver: Optional[Any] = None
        self.http_session: Optional[aiohttp.ClientSession] = None
        self.ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self._msg_counter = 0
        self._recording_active = False
        self._recorded_turns: List[Dict[str, Any]] = []

        if CUA_SDK_AVAILABLE:
            try:
                self.native_driver = cua_driver.CuaDriver.create()
            except Exception as e:
                logger.debug(f"Could not initialize native CuaDriver: {e}")

    async def initialize(self, retries: int = 8, retry_delay: float = 0.6) -> bool:
        """Initialize connection to the browser target with retry capability."""
        if not self.http_session or self.http_session.closed:
            self.http_session = aiohttp.ClientSession()

        url = f"http://{self.cdp_host}:{self.cdp_port}/json"
        self.ws_url = None

        for attempt in range(retries):
            try:
                async with self.http_session.get(url, timeout=3.0) as resp:
                    if resp.status == 200:
                        tabs = await resp.json()
                        page_tabs = [t for t in tabs if t.get("type") == "page"]
                        if not page_tabs:
                            # Attempt to open a page tab if none exist
                            try:
                                async with self.http_session.put(f"http://{self.cdp_host}:{self.cdp_port}/json/new?http://localhost:8000", timeout=3.0) as new_resp:
                                    if new_resp.status == 200:
                                        new_t = await new_resp.json()
                                        page_tabs = [new_t]
                            except Exception:
                                pass
                        if page_tabs:
                            target = next((t for t in page_tabs if "8000" in t.get("url", "")), page_tabs[0])
                            self.ws_url = target.get("webSocketDebuggerUrl")
                            logger.info(f"Cua Browser attached to tab: {target.get('title')} ({target.get('url')})")
                            break
            except Exception as e:
                logger.debug(f"CDP connection attempt {attempt + 1}/{retries} pending: {e}")
            await asyncio.sleep(retry_delay)

        # Connect WebSocket if URL was discovered
        if self.ws_url:
            try:
                self.ws = await self.http_session.ws_connect(self.ws_url)
                logger.info("Connected to Cua CDP WebSocket channel.")
                try:
                    await self._send_cdp("Page.bringToFront")
                except Exception:
                    pass
                return True
            except Exception as e:
                logger.error(f"WebSocket connection failed: {e}")

        return False

    async def close(self):
        """Close browser connections and sessions."""
        if self._recording_active:
            await self.stop_recording()
        if self.ws and not self.ws.closed:
            await self.ws.close()
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
        logger.info("Cua Browser Runner closed.")

    async def _send_cdp(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send raw DevTools command over active WebSocket with reconnection resilience."""
        for attempt in range(3):
            try:
                if not self.ws or self.ws.closed:
                    reconnected = await self.initialize()
                    if not reconnected:
                        raise RuntimeError("No active Cua browser WebSocket connection.")

                self._msg_counter += 1
                call_id = self._msg_counter
                payload = {"id": call_id, "method": method, "params": params or {}}
                await self.ws.send_str(json.dumps(payload))

                while True:
                    msg = await self.ws.receive()
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        if data.get("id") == call_id:
                            if "error" in data:
                                raise RuntimeError(f"CDP Error in {method}: {data['error']}")
                            return data.get("result", {})
                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        raise ConnectionResetError("CDP WebSocket connection closed.")
            except (ConnectionResetError, aiohttp.ClientError, Exception) as e:
                if attempt < 2:
                    logger.warning(f"CDP WebSocket glitch during {method} ({e}), reconnecting ({attempt + 1}/3)...")
                    if self.ws and not self.ws.closed:
                        try:
                            await self.ws.close()
                        except Exception:
                            pass
                    self.ws = None
                    await asyncio.sleep(0.4)
                    await self.initialize()
                else:
                    raise

    # ------------------------------------------------------------------------
    # Core Cua Browser Operations
    # ------------------------------------------------------------------------

    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate tab to URL (implements cua browser_navigate)."""
        logger.info(f"[Cua Browser] Navigating to: {url}")
        start = time.perf_counter()
        res = await self._send_cdp("Page.navigate", {"url": url})
        # Wait briefly for dom content to load
        await asyncio.sleep(0.5)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        if self._recording_active:
            self._record_turn("browser_navigate", {"url": url}, {"elapsed_ms": elapsed_ms})

        return {"status": "ok", "url": url, "elapsed_ms": elapsed_ms, "result": res}

    async def evaluate_js(self, expression: str) -> Any:
        """Evaluate arbitrary JavaScript expression in page context."""
        res = await self._send_cdp("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True
        })
        result_obj = res.get("result", {})
        return result_obj.get("value")

    async def get_browser_state(self, snapshot_format: str = "semantic_v2") -> Dict[str, Any]:
        """
        Extract Cua-compliant browser state outline (elements, coordinates, accessibility).
        """
        snapshot = await self.evaluate_js(CUA_SEMANTIC_SNAPSHOT_JS)
        if not snapshot:
            snapshot = {"elements": [], "title": "", "url": "", "element_count": 0}

        # Structure response conforming to Cua Driver get_browser_state
        state = {
            "format": snapshot_format,
            "title": snapshot.get("title", ""),
            "url": snapshot.get("url", ""),
            "viewport": snapshot.get("viewport", {}),
            "elements": snapshot.get("elements", []),
            "element_count": snapshot.get("element_count", 0),
            "timestamp": snapshot.get("timestamp", int(time.time() * 1000)),
        }
        return state

    async def click(self, target: Union[str, Dict[str, int]]) -> Dict[str, Any]:
        """
        Click element by Cua ref (e.g. 'ref_1'), CSS selector, or (x, y) coordinates.
        """
        x, y = 0, 0
        if isinstance(target, dict) and "x" in target and "y" in target:
            x, y = target["x"], target["y"]
        elif isinstance(target, str):
            if target.startswith("ref_"):
                # Find element by data-cua-ref
                expr = f"""(() => {{
                    const el = document.querySelector('[data-cua-ref="{target}"]');
                    if (!el) return null;
                    el.click();
                    const r = el.getBoundingClientRect();
                    return {{ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }};
                }})()"""
                coords = await self.evaluate_js(expr)
                if not coords:
                    raise ValueError(f"Target ref '{target}' not found in DOM.")
                x, y = coords["x"], coords["y"]
            else:
                # Target is CSS selector
                expr = f"""(() => {{
                    const el = document.querySelector('{target}');
                    if (!el) return null;
                    el.click();
                    const r = el.getBoundingClientRect();
                    return {{ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }};
                }})()"""
                coords = await self.evaluate_js(expr)
                if not coords:
                    raise ValueError(f"Selector '{target}' not found in DOM.")
                x, y = coords["x"], coords["y"]

        # Also dispatch synthetic pointer event via CDP for full realism
        await self._send_cdp("Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1
        })
        await self._send_cdp("Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1
        })

        await asyncio.sleep(0.2)
        action_res = {"status": "ok", "clicked": target, "coords": {"x": x, "y": y}}
        if self._recording_active:
            self._record_turn("browser_click", {"target": target}, action_res)

        return action_res

    async def type_text(self, target: str, text: str) -> Dict[str, Any]:
        """Insert text into targeted element."""
        if target.startswith("ref_"):
            selector = f'[data-cua-ref="{target}"]'
        else:
            selector = target

        expr = f"""(() => {{
            const el = document.querySelector('{selector}');
            if (!el) return false;
            el.focus();
            el.value = {json.dumps(text)};
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            return true;
        }})()"""
        success = await self.evaluate_js(expr)
        if not success:
            raise ValueError(f"Failed to type text into '{target}'. Element not found.")

        # Simulate individual key events via CDP
        for ch in text:
            await self._send_cdp("Input.dispatchKeyEvent", {"type": "char", "text": ch})

        action_res = {"status": "ok", "target": target, "text": text}
        if self._recording_active:
            self._record_turn("browser_type", {"target": target, "text": text}, action_res)

        return action_res

    async def press_key(self, key: str) -> Dict[str, Any]:
        """Press and release a keyboard key (e.g. 'v', 'p', 'g', 'm', 'Space')."""
        k = " " if key.lower() == "space" else key
        code = "Space" if key.lower() in (" ", "space") else (f"Key{key.upper()}" if len(key) == 1 else key)

        await self._send_cdp("Input.dispatchKeyEvent", {"type": "rawKeyDown", "key": k, "code": code, "text": k, "unmodifiedText": k})
        await asyncio.sleep(0.05)
        await self._send_cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": k, "code": code})

        # Also trigger window.game key handlers if bound
        js_dispatch = f"""(() => {{
            window.dispatchEvent(new KeyboardEvent('keydown', {{ key: '{k}', code: '{code}', bubbles: true }}));
            window.dispatchEvent(new KeyboardEvent('keyup', {{ key: '{k}', code: '{code}', bubbles: true }}));
        }})()"""
        await self.evaluate_js(js_dispatch)

        action_res = {"status": "ok", "key": key}
        if self._recording_active:
            self._record_turn("press_key", {"key": key}, action_res)
        return action_res

    async def hold_key(self, key: str, duration_sec: float = 0.4) -> Dict[str, Any]:
        """Hold a key down for a duration (e.g. 'w' for flight acceleration, 'a' for banking)."""
        k = " " if key.lower() == "space" else key
        code = "Space" if key.lower() in (" ", "space") else (f"Key{key.upper()}" if len(key) == 1 else key)

        await self._send_cdp("Input.dispatchKeyEvent", {"type": "rawKeyDown", "key": k, "code": code, "text": k, "unmodifiedText": k})
        js_down = f"""(() => {{
            if (window.game && window.game.keys) window.game.keys['{k.lower()}'] = true;
            window.dispatchEvent(new KeyboardEvent('keydown', {{ key: '{k}', code: '{code}', bubbles: true }}));
        }})()"""
        await self.evaluate_js(js_down)

        await asyncio.sleep(duration_sec)

        await self._send_cdp("Input.dispatchKeyEvent", {"type": "keyUp", "key": k, "code": code})
        js_up = f"""(() => {{
            if (window.game && window.game.keys) window.game.keys['{k.lower()}'] = false;
            window.dispatchEvent(new KeyboardEvent('keyup', {{ key: '{k}', code: '{code}', bubbles: true }}));
        }})()"""
        await self.evaluate_js(js_up)

        action_res = {"status": "ok", "key": key, "duration_sec": duration_sec}
        if self._recording_active:
            self._record_turn("hold_key", {"key": key, "duration_sec": duration_sec}, action_res)
        return action_res

    async def capture_screenshot(self, out_path: Optional[Union[str, Path]] = None) -> bytes:
        """Capture screenshot via DevTools protocol."""
        import base64
        res = await self._send_cdp("Page.captureScreenshot", {"format": "png"})
        raw_b64 = res.get("data", "")
        img_bytes = base64.b64decode(raw_b64)

        if out_path:
            out_file = Path(out_path)
            out_file.parent.mkdir(parents=True, exist_ok=True)
            with open(out_file, "wb") as f:
                f.write(img_bytes)
            logger.info(f"Saved Cua screenshot to {out_file}")

        return img_bytes

    # ------------------------------------------------------------------------
    # Cua Deterministic Predicate Verification (verify_state)
    # ------------------------------------------------------------------------

    async def verify_state(self, expect: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Deterministically verify bounded predicates against current page DOM/window.
        Matches Cua Driver verify_state schema.
        """
        browser_state = await self.get_browser_state()
        elements = browser_state.get("elements", [])

        results = []
        overall_satisfied = True

        for pred in expect:
            elem_spec = pred.get("element")
            win_spec = pred.get("window")

            if elem_spec:
                selector = elem_spec.get("selector", {})
                label_contains = selector.get("label_contains", "").lower()
                role = selector.get("role", "").lower()
                expected_value = elem_spec.get("value_equals")
                check_enabled = elem_spec.get("enabled")

                matches = []
                for el in elements:
                    el_role = el.get("role", "").lower()
                    el_name = el.get("name", "").lower()

                    role_ok = not role or (role == el_role)
                    label_ok = not label_contains or (label_contains in el_name)
                    if role_ok and label_ok:
                        matches.append(el)

                matched = len(matches) > 0
                val_ok = True
                enabled_ok = True

                if matched and expected_value is not None:
                    val_ok = matches[0].get("value") == expected_value
                if matched and check_enabled is not None:
                    enabled_ok = matches[0].get("enabled") == check_enabled

                is_pred_ok = matched and val_ok and enabled_ok
                results.append({
                    "predicate": "element",
                    "selector": selector,
                    "matched_count": len(matches),
                    "satisfied": is_pred_ok,
                    "matched_refs": [m.get("ref") for m in matches[:3]]
                })
                if not is_pred_ok:
                    overall_satisfied = False

            elif win_spec:
                vp = browser_state.get("viewport", {})
                bounds = win_spec.get("bounds")
                win_ok = True
                if bounds:
                    min_w = bounds.get("width", 0) - bounds.get("tolerance_px", 0)
                    min_h = bounds.get("height", 0) - bounds.get("tolerance_px", 0)
                    win_ok = vp.get("width", 0) >= min_w and vp.get("height", 0) >= min_h

                results.append({
                    "predicate": "window",
                    "viewport": vp,
                    "satisfied": win_ok
                })
                if not win_ok:
                    overall_satisfied = False

        return {
            "satisfied": overall_satisfied,
            "predicates_evaluated": len(expect),
            "predicate_results": results
        }

    # ------------------------------------------------------------------------
    # Application & Game Telemetry Inspection
    # ------------------------------------------------------------------------

    async def get_app_telemetry(self) -> Dict[str, Any]:
        """
        Extract detailed runtime telemetry from the target app (e.g. WebGL context,
        window.game state, FPS, error logs, and Jev loop metrics).
        """
        telemetry_js = """
        (() => {
            const result = {
                has_webgl: false,
                webgl_vendor: null,
                fps: null,
                game: null,
                console_errors: window.__captured_errors || [],
                performance: {
                    memory: window.performance?.memory ? {
                        usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / 1048576) + ' MB',
                        totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / 1048576) + ' MB'
                    } : null
                }
            };

            // Test canvas & WebGL (check Three.js renderer context first)
            if (window.game && window.game.renderer && typeof window.game.renderer.getContext === 'function') {
                const gl = window.game.renderer.getContext();
                if (gl) {
                    result.has_webgl = true;
                    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                    if (dbg) {
                        result.webgl_vendor = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                    }
                }
            } else {
                const canvas = document.querySelector('canvas') || document.getElementById('three-canvas');
                if (canvas) {
                    try {
                        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                        if (gl) result.has_webgl = true;
                    } catch (e) {}
                }
            }

            // Extract Cyber-Breach Tron Protocol game state
            if (window.game) {
                const g = window.game;
                const p = g.player || {};
                const vel = p.velocity || p.vel;
                const speed = vel && typeof vel.length === 'function' ? Math.round(vel.length() * 3.6) : 0;

                result.game = {
                    running: !g.isGameOver,
                    camera_mode: g.cameraMode || 'unknown',
                    auto_pilot: Boolean(g.autoPilot),
                    wave: g.wave || 1,
                    score: g.score || 0,
                    enemies_count: g.enemies ? g.enemies.length : 0,
                    bullets_count: g.bullets ? g.bullets.length : 0,
                    player: {
                        health: p.health !== undefined ? Math.round(p.health) : 100,
                        shield: p.shield !== undefined ? Math.round(p.shield) : 0,
                        speed: speed,
                        dash_charges: p.dashCharges !== undefined ? p.dashCharges : 3
                    },
                    has_three_scene: Boolean(g.scene && g.scene.children),
                    scene_objects_count: g.scene && g.scene.children ? g.scene.children.length : 0
                };
            }

            return result;
        })()
        """
        telemetry = await self.evaluate_js(telemetry_js)
        return telemetry or {}

    # ------------------------------------------------------------------------
    # Trajectory Recording (Cua-Bench Compatibility)
    # ------------------------------------------------------------------------

    def start_recording(self):
        """Begin recording action trajectory for reproducible benchmarks."""
        self._recording_active = True
        self._recorded_turns = []
        logger.info("[Cua Trajectory] Recording started.")

    async def stop_recording(self, out_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """Stop trajectory recording and optionally export trajectory json."""
        self._recording_active = False
        logger.info(f"[Cua Trajectory] Recording stopped with {len(self._recorded_turns)} turns.")
        if out_path:
            p = Path(out_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "w") as f:
                json.dump({"turns": self._recorded_turns, "count": len(self._recorded_turns)}, f, indent=2)
        return self._recorded_turns

    def _record_turn(self, tool_name: str, args: Dict[str, Any], result: Dict[str, Any]):
        turn = {
            "step": len(self._recorded_turns) + 1,
            "tool": tool_name,
            "arguments": args,
            "result": result,
            "timestamp": time.time()
        }
        self._recorded_turns.append(turn)
