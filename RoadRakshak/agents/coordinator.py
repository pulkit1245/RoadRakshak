"""
agents/coordinator.py — AgentCoordinator
=========================================
The single orchestrator that runs all 5 agents on every frame.

Call order:
  1. vehicle_agent.run(frame)          → vehicle + person detections
  2. scene_agent.run(frame)            → scene-level signals (parallel-safe)
  3. collision_agent.run(v_data, scene)→ confirmed collision events
  4. wrongway_agent.run(v_data)        → wrong-way + overspeeding violations
  5. alert_agent.run(events, viol, frame) → dispatch + build WS payload

Returns:
  {
    "frame":       annotated np.ndarray,
    "payload":     dict (sent over WebSocket),
    "night_mode":  bool,
  }

To use from server.py:
  from agents.coordinator import AgentCoordinator
  coord = AgentCoordinator()
  result = coord.process(frame)
  await websocket.send_json(result["payload"])
"""

import cv2
import base64
import numpy as np
import time
from typing import Optional

from agents import vehicle_agent
from agents import scene_agent
from agents import collision_agent
from agents import wrongway_agent
from agents import alert_agent

# ── Drawing helpers ───────────────────────────────────────────────────────────
VEHICLE_COLOUR   = (0,   220,  0)
PERSON_COLOUR    = (220, 180,  0)
COLLISION_COLOUR = (0,   0,   255)
WRONGWAY_COLOUR  = (0,   80,  255)
SPEED_COLOUR     = (255, 140,   0)


def _draw_box(frame, bbox, colour, label: str):
    x1, y1, x2, y2 = map(int, bbox)
    cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
    cv2.rectangle(frame, (x1, y1-th-6), (x1+tw+4, y1), colour, -1)
    cv2.putText(frame, label, (x1+2, y1-4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, (0, 0, 0), 1)


def _draw_collision_zone(frame, event: dict) -> np.ndarray:
    """Red zone box with transparent fill + corner ticks."""
    b1 = event["pair"][0]["bbox"]
    b2 = event["pair"][1]["bbox"]
    x1 = max(0, int(min(b1[0], b2[0])) - 15)
    y1 = max(0, int(min(b1[1], b2[1])) - 15)
    x2 = min(frame.shape[1], int(max(b1[2], b2[2])) + 15)
    y2 = min(frame.shape[0], int(max(b1[3], b2[3])) + 15)

    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 200), -1)
    frame = cv2.addWeighted(overlay, 0.22, frame, 0.78, 0)
    cv2.rectangle(frame, (x1, y1), (x2, y2), COLLISION_COLOUR, 3)

    tick = 16
    for (sx, sy, ex, ey) in [
        (x1, y1, x1+tick, y1), (x1, y1, x1, y1+tick),
        (x2, y1, x2-tick, y1), (x2, y1, x2, y1+tick),
        (x1, y2, x1+tick, y2), (x1, y2, x1, y2-tick),
        (x2, y2, x2-tick, y2), (x2, y2, x2, y2-tick),
    ]:
        cv2.line(frame, (sx, sy), (ex, ey), COLLISION_COLOUR, 3)

    sev  = event["severity"]
    conf = event["confidence"]
    lbl  = f"ACCIDENT [{sev}] {conf:.0%}"
    (lw, lh), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.58, 2)
    cv2.rectangle(frame, (x1, y1-lh-10), (x1+lw+8, y1), (0, 0, 200), -1)
    cv2.putText(frame, lbl, (x1+4, y1-6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2)
    return frame


def _annotate(frame: np.ndarray,
              vehicle_data: dict,
              collision_events: list,
              violations: list,
              fps: float,
              night_mode: bool) -> np.ndarray:
    """Draw all boxes + overlays onto frame."""

    # Vehicles
    for v in vehicle_data.get("vehicles", []):
        lbl = f"{v['class']} {v['confidence']:.2f}"
        _draw_box(frame, v["bbox"], VEHICLE_COLOUR, lbl)

    # Persons
    for p in vehicle_data.get("persons", []):
        lbl = f"person {p['confidence']:.2f}"
        _draw_box(frame, p["bbox"], PERSON_COLOUR, lbl)

    # Collision zones
    for ev in collision_events:
        frame = _draw_collision_zone(frame, ev)

    # Violation overlays (wrong-way = red arrow, overspeeding = orange label)
    for viol in violations:
        x1, y1, x2, y2 = map(int, viol["bbox"])
        colour = WRONGWAY_COLOUR if "wrong" in viol["violation"] else SPEED_COLOUR
        cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 3)
        lbl = viol["violation"].replace("_", " ").upper()
        cv2.putText(frame, lbl, (x1, y1-22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, colour, 2)

    # Status bar
    h = frame.shape[0]
    if collision_events:
        worst  = max(collision_events, key=lambda e: e["confidence"])
        status = (f"COLLISION [{worst['severity']}] "
                  f"conf={worst['confidence']:.0%} "
                  f"victims={worst['victim_count']}")
        cv2.putText(frame, status, (10, h-15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
    else:
        mode_str = " [NIGHT]" if night_mode else ""
        cv2.putText(frame, f"Monitoring...{mode_str}", (10, h-15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 210, 100), 2)

    # FPS
    cv2.putText(frame, f"FPS: {int(fps)}", (10, 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # Multi-agent badge
    cv2.putText(frame, "Multi-Agent v2", (frame.shape[1]-150, 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 255), 1)

    return frame


# ── Coordinator class ─────────────────────────────────────────────────────────
class AgentCoordinator:
    """
    Stateless wrapper — call process(frame) every frame.

    Example usage (in server.py):
        coord = AgentCoordinator()
        ...
        result = coord.process(frame)
        await ws.send_json(result["payload"])
    """

    def __init__(self, skip_frames: int = 2):
        """
        skip_frames: run heavy agents only every N frames.
        On skipped frames, reuse previous detections (keeps FPS up).
        """
        self.skip         = skip_frames
        self.frame_count  = 0
        self.prev_time    = 0.0

        # Cached results from previous heavy frame
        self._v_data      = {"vehicles": [], "persons": [], "night_mode": False}
        self._scene       = {}
        self._collisions  = []
        self._violations  = []

    def process(self, frame: np.ndarray) -> dict:
        """
        Run all agents on frame. Returns:
        {
          "frame":      annotated np.ndarray,
          "payload":    dict  ← send this over WebSocket,
          "night_mode": bool,
        }
        """
        self.frame_count += 1
        now = time.time()
        fps = 1 / (now - self.prev_time) if self.prev_time else 0
        self.prev_time = now

        # Heavy agents — run every N frames
        if self.frame_count % self.skip == 0:
            self._v_data     = vehicle_agent.run(frame)
            self._scene      = scene_agent.run(frame)
            self._collisions = collision_agent.run(self._v_data, self._scene)
            self._violations = wrongway_agent.run(self._v_data)

        night_mode = self._v_data.get("night_mode", False)

        # Alert agent runs EVERY frame (lightweight I/O, not CV)
        alert_payload = alert_agent.run(
            self._collisions,
            self._violations,
            frame,
            save_snapshot=True,
        )

        # Annotate
        annotated = _annotate(
            frame.copy(),
            self._v_data,
            self._collisions,
            self._violations,
            fps,
            night_mode,
        )

        # Encode frame to base64 for WebSocket
        _, buf   = cv2.imencode('.jpg', annotated,
                                [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_b64 = base64.b64encode(buf).decode("utf-8")

        payload = {
            "frame":      frame_b64,
            "fps":        int(fps),
            "night_mode": night_mode,
            "mode":       "night" if night_mode else "day",
            "vehicles":   self._v_data.get("vehicles", []),
            "persons":    self._v_data.get("persons", []),
            **alert_payload,   # collision, collisions, violations, alert_fired
        }

        return {
            "frame":      annotated,
            "payload":    payload,
            "night_mode": night_mode,
        }
