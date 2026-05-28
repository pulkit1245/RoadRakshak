"""
agents/scene_agent.py — Agent 2: Scene Analysis Agent
=======================================================
Responsibility:
  • Computes scene-level signals INDEPENDENT of object tracking
  • Optical flow chaos — detects sudden violent motion
  • Pixel delta — detects large frame-to-frame change
  • Edge density — detects scattered debris / broken parts
  • Background subtraction blob — detects stationary foreign object
  • Smoke / fire hue detection — post-crash fire signal
  • Returns a SceneReport dict the coordinator uses for scoring

Why separate?
  Scene signals don't depend on YOLO at all.
  This agent can run on a lightweight thread without GPU,
  freeing YOLO compute for Agent 1.
"""

import cv2
import numpy as np

# ── State ─────────────────────────────────────────────────────────────────────
_prev_gray      = None
_prev_raw       = None
_bg_sub         = cv2.createBackgroundSubtractorMOG2(
                      history=400, varThreshold=50, detectShadows=False)


# ── Optical flow chaos ────────────────────────────────────────────────────────
def _flow_chaos(curr_gray: np.ndarray) -> float:
    """
    High chaos = violent unpredictable motion = likely crash.
    Normal traffic has low angular variance in optical flow.
    """
    global _prev_gray
    chaos = 0.0
    if _prev_gray is not None and curr_gray.shape == _prev_gray.shape:
        flow = cv2.calcOpticalFlowFarneback(
            _prev_gray, curr_gray, None,
            pyr_scale=0.5, levels=3, winsize=15,
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0)
        _, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        chaos  = float(np.std(ang))
    _prev_gray = curr_gray.copy()
    return chaos


# ── Pixel delta ───────────────────────────────────────────────────────────────
def _pixel_delta(frame: np.ndarray) -> int:
    """Count pixels that changed significantly between frames."""
    global _prev_raw
    delta = 0
    # Safety: check if frame shape changed (e.g. resolution toggle)
    if _prev_raw is not None and _prev_raw.shape == frame.shape:
        diff       = cv2.absdiff(_prev_raw, frame)
        gray       = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, th      = cv2.threshold(gray, 28, 255, cv2.THRESH_BINARY)
        k          = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        th         = cv2.morphologyEx(th, cv2.MORPH_OPEN, k)
        delta      = int(cv2.countNonZero(th))
    _prev_raw = frame.copy()
    return delta


# ── Edge density ──────────────────────────────────────────────────────────────
def _edge_density(frame: np.ndarray) -> float:
    """
    Compute edge density on road ROI (skip top 25% sky).
    High density = scattered wreckage / shattered glass.
    """
    h = frame.shape[0]
    if h < 10: return 0.0 # Safety
    road       = frame[h // 4:, :]
    gray_road  = cv2.cvtColor(road, cv2.COLOR_BGR2GRAY)
    blurred    = cv2.GaussianBlur(gray_road, (5, 5), 0)
    edges      = cv2.Canny(blurred, 50, 150)
    return float(cv2.countNonZero(edges)) / (edges.size + 1e-6)


# ── Background blob ───────────────────────────────────────────────────────────
def _bg_blob(frame: np.ndarray) -> int:
    """Large stationary foreground blob = stopped/crashed vehicle."""
    try:
        fg = _bg_sub.apply(frame)
        fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE,
             cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
        return int(cv2.countNonZero(fg))
    except cv2.error:
        # If MOG2 fails (usually due to size change), reset it
        return 0


# ── Smoke / fire hue ─────────────────────────────────────────────────────────
def _detect_fire_smoke(frame: np.ndarray) -> dict:
    """
    Fire: orange-red hue (HSV H=0-20 or 160-180), high saturation.
    Smoke: low saturation, mid-gray value blob.
    Returns fire_score and smoke_score in [0, 1].
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Fire mask — orange to red hues
    fire1 = cv2.inRange(hsv, (0,   120, 100), (20,  255, 255))
    fire2 = cv2.inRange(hsv, (160, 120, 100), (180, 255, 255))
    fire_mask  = cv2.bitwise_or(fire1, fire2)
    fire_score = float(cv2.countNonZero(fire_mask)) / (fire_mask.size + 1e-6)

    # Smoke mask — low saturation, mid value
    smoke_mask  = cv2.inRange(hsv, (0, 0, 80), (180, 40, 200))
    smoke_score = float(cv2.countNonZero(smoke_mask)) / (smoke_mask.size + 1e-6)

    return {
        "fire_score":  round(fire_score,  4),
        "smoke_score": round(smoke_score, 4),
        "fire_detected":  fire_score  > 0.015,
        "smoke_detected": smoke_score > 0.08,
    }


# ── Main run function ─────────────────────────────────────────────────────────
def run(frame: np.ndarray) -> dict:
    """
    Main entry called by coordinator.

    Returns SceneReport:
    {
      "chaos":        float,   # optical flow chaos score
      "pixel_delta":  int,     # changed pixels count
      "edge_density": float,   # road edge density
      "bg_blob":      int,     # foreground blob size
      "fire_score":   float,
      "smoke_score":  float,
      "fire_detected":  bool,
      "smoke_detected": bool,
    }
    """
    curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    chaos       = _flow_chaos(curr_gray)
    pixel_delta = _pixel_delta(frame)
    edge_den    = _edge_density(frame)
    bg_b        = _bg_blob(frame)
    fire_smoke  = _detect_fire_smoke(frame)

    return {
        "chaos":          round(chaos, 3),
        "pixel_delta":    pixel_delta,
        "edge_density":   round(edge_den, 4),
        "bg_blob":        bg_b,
        "fire_score":     fire_smoke["fire_score"],
        "smoke_score":    fire_smoke["smoke_score"],
        "fire_detected":  fire_smoke["fire_detected"],
        "smoke_detected": fire_smoke["smoke_detected"],
    }
