"""
agents/wrongway_agent.py — Agent 4: Wrong-Way & Overspeeding Agent
===================================================================
Responsibility:
  • Uses ByteTrack trajectory vectors from Agent 1
  • Detects vehicles moving AGAINST traffic flow
  • Estimates pixel-speed and flags overspeeding
  • Returns list of violation dicts for each offending vehicle

How wrong-way detection works:
  1. Collect last N positions from pos_history for each track
  2. Compute direction vector (dx, dy) = displacement over last 10 frames
  3. Compute the DOMINANT flow direction from ALL vehicles this frame
  4. Any vehicle whose direction differs by > 120 degrees = wrong way
  5. Use cosine similarity for angle comparison (robust to scale)

How overspeeding works:
  pixel_speed = euclidean distance moved per frame (pixels)
  We calibrate with a known reference: 1 lane width ≈ 80px at typical
  camera height. If speed > SPEED_THRESHOLD pixels/frame = flag.
"""

import numpy as np
from collections import defaultdict, deque
from typing import List, Dict

# ── Config ────────────────────────────────────────────────────────────────────
MIN_HISTORY      = 8    # frames needed before direction is reliable
ANGLE_THRESHOLD  = 120  # degrees — vehicles beyond this = wrong way
SPEED_THRESHOLD  = 22   # pixels/frame — above this = overspeeding flag

# Per-track position history shared with vehicle_agent
_pos_history: Dict[int, deque] = defaultdict(lambda: deque(maxlen=40))
_last_seen: Dict[int, float]   = {}  # track_id -> timestamp

import time

def _prune_history(now: float):
    """Removes history for tracks not seen for 10+ seconds."""
    expired = [tid for tid, last in _last_seen.items() if now - last > 10.0]
    for tid in expired:
        if tid in _pos_history: del _pos_history[tid]
        if tid in _last_seen:   del _last_seen[tid]

# ── Direction vector ──────────────────────────────────────────────────────────
def _direction_vector(track_id: int) -> np.ndarray:
    """
    Returns unit direction vector for a track from its recent positions.
    Returns None if not enough history.
    """
    hist = list(_pos_history[track_id])
    if len(hist) < MIN_HISTORY:
        return None

    # Use first quarter vs last quarter of history window
    mid   = len(hist) // 2
    start = np.mean(hist[:mid],  axis=0)
    end   = np.mean(hist[mid:],  axis=0)
    vec   = end - start

    norm = np.linalg.norm(vec)
    if norm < 1e-3:
        return None
    return vec / norm


def _angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    """Returns angle in degrees between two direction vectors."""
    cos_a = np.clip(np.dot(v1, v2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_a)))


# ── Speed estimate ────────────────────────────────────────────────────────────
def _pixel_speed(track_id: int) -> float:
    hist = list(_pos_history[track_id])
    if len(hist) < 2:
        return 0.0
    recent = hist[-min(5, len(hist)):]
    dists  = [np.hypot(recent[i][0]-recent[i-1][0],
                       recent[i][1]-recent[i-1][1])
              for i in range(1, len(recent))]
    return float(np.mean(dists)) if dists else 0.0


# ── Main run function ─────────────────────────────────────────────────────────
def run(vehicle_data: dict) -> List[dict]:
    """
    Main entry called by coordinator.

    vehicle_data = output of vehicle_agent.run()

    Returns list of ViolationEvent dicts:
    {
      "track_id":   int,
      "class":      str,
      "bbox":       list,
      "violation":  "wrong_way" | "overspeeding" | "both",
      "speed_px":   float,
      "direction":  [dx, dy],
    }
    """
    vehicles   = vehicle_data.get("vehicles", [])
    violations = []

    if not vehicles:
        return violations

    now = time.time()
    _prune_history(now)

    # Step 1: Update position history for all vehicles
    for v in vehicles:
        tid = v["track_id"]
        if tid < 0:
            continue
        _last_seen[tid] = now
        bbox  = v["bbox"]
        cx    = (bbox[0] + bbox[2]) / 2
        cy    = (bbox[1] + bbox[3]) / 2
        _pos_history[tid].append(np.array([cx, cy]))

    # Step 2: Compute direction vectors for all tracks with enough history
    dir_vectors = {}
    for v in vehicles:
        tid = v["track_id"]
        if tid < 0:
            continue
        dv = _direction_vector(tid)
        if dv is not None:
            dir_vectors[tid] = dv

    if len(dir_vectors) < 2:
        return violations   # need at least 2 tracks to determine flow

    # Step 3: Dominant flow direction = mean of all direction vectors
    all_vecs      = np.array(list(dir_vectors.values()))
    dominant_flow = np.mean(all_vecs, axis=0)
    dom_norm      = np.linalg.norm(dominant_flow)

    if dom_norm < 1e-3:
        return violations   # everyone is basically stationary

    dominant_flow /= dom_norm

    # Step 4: Check each vehicle against dominant flow
    for v in vehicles:
        tid = v["track_id"]
        if tid not in dir_vectors:
            continue

        vdir  = dir_vectors[tid]
        angle = _angle_between(vdir, dominant_flow)
        speed = _pixel_speed(tid)

        wrong_way    = angle > ANGLE_THRESHOLD
        overspeeding = speed > SPEED_THRESHOLD

        if wrong_way or overspeeding:
            violation_type = ("both"         if wrong_way and overspeeding else
                              "wrong_way"    if wrong_way                  else
                              "overspeeding")
            violations.append({
                "track_id":  tid,
                "class":     v["class"],
                "bbox":      v["bbox"],
                "violation": violation_type,
                "speed_px":  round(speed, 1),
                "angle_deg": round(angle, 1),
                "direction": vdir.tolist(),
            })

    return violations
