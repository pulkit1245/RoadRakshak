"""
agents/collision_agent.py — Agent 3: Collision Reasoning Agent
===============================================================
Responsibility:
  • Receives vehicle list from Agent 1 + scene report from Agent 2
  • Runs pairwise IoU check between all vehicle pairs
  • Computes multi-parameter accident confidence score
  • Manages collision lock / cooldown registry
  • Returns list of confirmed CollisionEvent dicts

Accuracy improvements vs original:
  • Near-miss zone also triggers low-confidence pre-alert
  • Fire/smoke from Agent 2 adds major score boost
  • Victim count weighted by proximity AND number
  • Score thresholds split into 4 levels (not 3)
  • Registry prune only removes pairs gone for > 2 seconds (not immediately)
"""

import time
import numpy as np
from typing import List, Dict

CONFIRM_SECONDS  = 0.5   # overlap must persist before confirming
COOLDOWN_SECONDS = 60    # ignore same pair after alert fires (increased to prevent spam)

# Thresholds
SCORE_CRITICAL = 0.75
SCORE_HIGH     = 0.55
SCORE_MEDIUM   = 0.35
SCORE_LOW      = 0.20

# { frozenset({id1,id2}): {start, alerted, locked_until, last_seen} }
_registry: Dict = {}

# Spatial Deduplication Model: stores (timestamp, x, y, severity)
# Ensures we don't fire multiple accidents for the same physical crash site
_global_accident_history = []
SPATIAL_THRESHOLD_PX = 150  # Radius in pixels to consider "same accident"
TEMPORAL_THRESHOLD_SEC = 30 # Seconds to ignore repeat accidents at the same spot

def _is_redundant_spatial_event(x, y, now):
    """Checks if an accident already happened at this spot recently."""
    global _global_accident_history
    # Cleanup old history
    _global_accident_history = [e for e in _global_accident_history if now - e[0] < TEMPORAL_THRESHOLD_SEC]
    
    for (t, ex, ey, _) in _global_accident_history:
        dist = np.hypot(x - ex, y - ey)
        if dist < SPATIAL_THRESHOLD_PX:
            return True
    return False

# ── Geometry helpers ──────────────────────────────────────────────────────────
def _iou(b1, b2) -> float:
    ix1 = max(b1[0], b2[0]);  iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2]);  iy2 = min(b1[3], b2[3])
    inter = max(0, ix2-ix1) * max(0, iy2-iy1)
    a1    = (b1[2]-b1[0]) * (b1[3]-b1[1])
    a2    = (b2[2]-b2[0]) * (b2[3]-b2[1])
    return inter / (a1 + a2 - inter + 1e-6)


def _centroid(bbox):
    return ((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2)


def _dist(b1, b2) -> float:
    c1, c2 = _centroid(b1), _centroid(b2)
    return float(np.hypot(c1[0]-c2[0], c1[1]-c2[1]))


# ── Accident confidence scorer ────────────────────────────────────────────────
def _score(iou_val: float,
           near_miss: bool,
           sudden_stop: bool,
           deformed: bool,
           scene: dict,
           victim_count: int) -> tuple:
    """
    Returns (confidence: float, severity: str, evidence: list).

    Evidence list is shown in the frontend alert panel so judges can
    see exactly WHY the system flagged a collision.
    """
    s  = 0.0
    ev = []

    # ── Primary — direct overlap ──────────────────────────────────────────────
    if iou_val > 0.10:
        s += 0.40; ev.append(f"iou={iou_val:.2f}")
    elif iou_val > 0.05:
        s += 0.28; ev.append(f"iou={iou_val:.2f}")
    elif iou_val > 0.02:
        s += 0.14; ev.append(f"iou_partial={iou_val:.2f}")

    # ── Near miss ─────────────────────────────────────────────────────────────
    if near_miss:
        s += 0.08; ev.append("near_miss")

    # ── Motion signals ────────────────────────────────────────────────────────
    if sudden_stop:
        s += 0.20; ev.append("sudden_stop")
    if deformed:
        s += 0.12; ev.append("bbox_deform")

    # ── Scene signals ─────────────────────────────────────────────────────────
    pd = scene.get("pixel_delta", 0)
    if pd > 8000:
        s += 0.12; ev.append(f"px_delta={pd}")
    elif pd > 5000:
        s += 0.07; ev.append(f"px_delta={pd}")

    blob = scene.get("bg_blob", 0)
    if blob > 12000:
        s += 0.08; ev.append("bg_blob")

    ed = scene.get("edge_density", 0)
    if ed > 0.18:
        s += 0.07; ev.append(f"edge={ed:.2f}")

    chaos = scene.get("chaos", 0)
    if chaos > 1.8:
        s += 0.12; ev.append(f"chaos={chaos:.1f}")
    elif chaos > 1.4:
        s += 0.07; ev.append(f"chaos={chaos:.1f}")

    # ── Post-crash fire / smoke ───────────────────────────────────────────────
    if scene.get("fire_detected"):
        s += 0.18; ev.append("FIRE_DETECTED")
    if scene.get("smoke_detected"):
        s += 0.10; ev.append("SMOKE_DETECTED")

    # ── Victim presence ───────────────────────────────────────────────────────
    if victim_count >= 3:
        s += 0.15; ev.append(f"victims={victim_count}")
    elif victim_count >= 1:
        s += 0.10; ev.append(f"victims={victim_count}")

    s   = round(min(s, 1.0), 3)
    sev = ("CRITICAL" if s >= SCORE_CRITICAL else
           "HIGH"     if s >= SCORE_HIGH     else
           "MEDIUM"   if s >= SCORE_MEDIUM   else
           "LOW"      if s >= SCORE_LOW      else "NONE")

    return s, sev, ev


# ── Main run function ─────────────────────────────────────────────────────────
def run(vehicle_data: dict, scene: dict) -> List[dict]:
    """
    Main entry called by coordinator.

    vehicle_data = output of vehicle_agent.run()
    scene        = output of scene_agent.run()

    Returns list of CollisionEvent dicts:
    {
      "pair":         (v1_dict, v2_dict),
      "iou":          float,
      "confidence":   float,
      "severity":     str,
      "evidence":     list,
      "zone_bbox":    [x1,y1,x2,y2],
      "victim_count": int,
      "new_alert":    bool,
    }
    """
    global _registry

    vehicles = vehicle_data.get("vehicles", [])
    persons  = vehicle_data.get("persons",  [])
    now      = time.time()
    events   = []

    # Track which pairs are still alive this frame
    active_keys = set()

    for i in range(len(vehicles)):
        for j in range(i + 1, len(vehicles)):
            v1, v2 = vehicles[i], vehicles[j]
            b1, b2 = v1["bbox"], v2["bbox"]
            t1, t2 = v1["track_id"], v2["track_id"]

            iou_val  = _iou(b1, b2)
            dist     = _dist(b1, b2)
            avg_w    = ((b1[2]-b1[0]) + (b2[2]-b2[0])) / 2.0
            near_miss = (dist < avg_w * 0.85 and iou_val < 0.15)

            if iou_val < 0.02 and not near_miss:
                continue

            pair_key = frozenset({t1, t2})
            active_keys.add(pair_key)

            sudden_stop = v1.get("sudden_stop", False) or \
                          v2.get("sudden_stop", False)
            deformed    = v1.get("deformed",    False) or \
                          v2.get("deformed",    False)

            # Victim count
            zone_cx = int((b1[0]+b1[2]+b2[0]+b2[2]) / 4)
            zone_cy = int((b1[1]+b1[3]+b2[1]+b2[3]) / 4)
            victim_count = sum(
                1 for p in persons
                if np.hypot(_centroid(p["bbox"])[0] - zone_cx,
                            _centroid(p["bbox"])[1] - zone_cy) < 240
            )

            conf, sev, evidence = _score(
                iou_val, near_miss, sudden_stop, deformed,
                scene, victim_count
            )

            # ── Lock logic ────────────────────────────────────────────────────
            reg       = _registry.get(pair_key)
            new_alert = False

            if conf >= SCORE_LOW:
                if reg is None:
                    _registry[pair_key] = {
                        "start":        now,
                        "alerted":      False,
                        "locked_until": 0,
                        "last_seen":    now,
                    }
                    reg = _registry[pair_key]

                reg["last_seen"] = now
                elapsed = now - reg["start"]

                if elapsed >= CONFIRM_SECONDS and not reg["alerted"]:
                    # Before firing a new alert, check the spatial-temporal model
                    if not _is_redundant_spatial_event(zone_cx, zone_cy, now):
                        reg["alerted"]      = True
                        reg["locked_until"] = now + COOLDOWN_SECONDS
                        new_alert           = True
                        # Register in global history to block other nearby alerts
                        _global_accident_history.append((now, zone_cx, zone_cy, sev))
                    else:
                        # It is spatially redundant, so we treat it as "already alerted"
                        # to prevent it from trying to fire again immediately
                        reg["alerted"] = True
                        reg["locked_until"] = now + COOLDOWN_SECONDS
                        new_alert = False

                if now > reg["locked_until"] and reg["alerted"]:
                    reg["alerted"] = False
                    reg["start"]   = now

                if sev != "NONE":
                    events.append({
                        "pair":         (v1, v2),
                        "iou":          round(iou_val, 3),
                        "confidence":   conf,
                        "severity":     sev,
                        "evidence":     evidence,
                        "zone_bbox":    [
                            min(b1[0], b2[0]), min(b1[1], b2[1]),
                            max(b1[2], b2[2]), max(b1[3], b2[3])
                        ],
                        "victim_count": victim_count,
                        "new_alert":    new_alert,
                    })
            else:
                if reg is not None and not reg.get("alerted", False):
                    _registry[pair_key]["start"] = now

    # Prune pairs not seen for > 3 seconds (more forgiving than original)
    for k in list(_registry.keys()):
        if now - _registry[k].get("last_seen", now) > 3.0:
            del _registry[k]

    return events
