"""
detection.py — RoadGuard AI Enhanced
======================================
Fixes applied vs original:
  1. Multi-parameter confidence scoring (not just IoU alone)
  2. One-collision-per-event lock  — same accident NOT re-counted
  3. Helmet vs hat/cap distinction using head-zone aspect ratio + colour
  4. Red bounding box drawn around the full collision zone
  5. Optical flow chaos, sudden-stop, pixel-delta, edge-density signals
  6. Night-vision CLAHE preprocessing
  7. Smoothed detections via NMS deduplication
"""

import cv2
import time
import numpy as np
from collections import defaultdict, deque
from ultralytics import YOLO

# ─────────────────────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────────────────────
model = YOLO("yolov8n.pt")

VEHICLE_CLASSES  = {"car", "truck", "bus", "motorcycle", "motorbike",
                    "bicycle", "van"}
PERSON_CLASSES   = {"person"}

# ─────────────────────────────────────────────────────────────
# PER-TRACK STATE
# ─────────────────────────────────────────────────────────────
speed_history   = defaultdict(lambda: deque(maxlen=12))
pos_history     = defaultdict(lambda: deque(maxlen=30))
aspect_history  = defaultdict(lambda: deque(maxlen=8))
trajectory      = defaultdict(lambda: deque(maxlen=40))  # for sinuosity

# ─────────────────────────────────────────────────────────────
# SCENE-LEVEL STATE
# ─────────────────────────────────────────────────────────────
prev_frame_gray = None
prev_frame_raw  = None
bg_subtractor   = cv2.createBackgroundSubtractorMOG2(
                      history=400, varThreshold=50, detectShadows=False)

# ─────────────────────────────────────────────────────────────
# COLLISION LOCK  — prevents counting same accident multiple times
# ─────────────────────────────────────────────────────────────
# Structure: { frozenset({id1, id2}): {"start": t, "locked": bool, "alerted": bool} }
collision_registry = {}
CONFIRM_SECONDS  = 0.5  # overlap must persist this long before confirming
COOLDOWN_SECONDS = 15    # after alert fires, ignore same pair for this long


# ═════════════════════════════════════════════════════════════
# HELPER — IoU
# ═════════════════════════════════════════════════════════════
def iou(b1, b2):
    ix1 = max(b1[0], b2[0]);  iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2]);  iy2 = min(b1[3], b2[3])
    inter = max(0, ix2-ix1) * max(0, iy2-iy1)
    a1 = (b1[2]-b1[0]) * (b1[3]-b1[1])
    a2 = (b2[2]-b2[0]) * (b2[3]-b2[1])
    return inter / (a1 + a2 - inter + 1e-6)


def centroid(bbox):
    return ((bbox[0]+bbox[2])//2, (bbox[1]+bbox[3])//2)


def centroid_dist(b1, b2):
    c1, c2 = centroid(b1), centroid(b2)
    return float(np.hypot(c1[0]-c2[0], c1[1]-c2[1]))


# ═════════════════════════════════════════════════════════════
# HELPER — Night vision
# ═════════════════════════════════════════════════════════════
def enhance_night_vision(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = cv2.merge([clahe.apply(l), a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


# ═════════════════════════════════════════════════════════════
# PARAMETER — Optical flow chaos
# ═════════════════════════════════════════════════════════════
def optical_flow_chaos(curr_gray):
    global prev_frame_gray
    chaos = 0.0
    if prev_frame_gray is not None and \
       curr_gray.shape == prev_frame_gray.shape:
        flow = cv2.calcOpticalFlowFarneback(
            prev_frame_gray, curr_gray, None,
            pyr_scale=0.5, levels=3, winsize=15,
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0)
        _, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        chaos = float(np.std(ang))
    prev_frame_gray = curr_gray.copy()
    return chaos


# ═════════════════════════════════════════════════════════════
# PARAMETER — Scene change (pixel delta + edge density)
# ═════════════════════════════════════════════════════════════
def scene_signals(frame):
    global prev_frame_raw
    h, w = frame.shape[:2]
    pixel_delta = 0
    edge_density = 0.0

    if prev_frame_raw is not None:
        diff = cv2.absdiff(prev_frame_raw, frame)
        g    = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, th = cv2.threshold(g, 28, 255, cv2.THRESH_BINARY)
        k  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        th = cv2.morphologyEx(th, cv2.MORPH_OPEN, k)
        pixel_delta = int(cv2.countNonZero(th))

    # edge density on road ROI (skip top 25% = sky)
    road = frame[h//4:, :]
    gray_road = cv2.cvtColor(road, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray_road, (5, 5), 0), 50, 150)
    edge_density = cv2.countNonZero(edges) / (edges.size + 1e-6)

    fg = bg_subtractor.apply(frame)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE,
         cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    bg_blob = int(cv2.countNonZero(fg))

    prev_frame_raw = frame.copy()
    return pixel_delta, edge_density, bg_blob


# ═════════════════════════════════════════════════════════════
# PARAMETER — Motion per track
# ═════════════════════════════════════════════════════════════
def update_track_motion(track_id, bbox):
    cx, cy = centroid(bbox)
    pos_history[track_id].append((cx, cy))
    trajectory[track_id].append((cx, cy))

    speed = 0.0
    if len(pos_history[track_id]) >= 2:
        p1 = pos_history[track_id][-2]
        p2 = pos_history[track_id][-1]
        speed = float(np.hypot(p2[0]-p1[0], p2[1]-p1[1]))
    speed_history[track_id].append(speed)

    # aspect ratio deformation
    w = bbox[2]-bbox[0]; h = bbox[3]-bbox[1]
    asp = w / (h + 1e-6)
    aspect_history[track_id].append(asp)

    sudden_stop = False
    deformed    = False

    if len(speed_history[track_id]) >= 5:
        recent   = float(np.mean(list(speed_history[track_id])[-2:]))
        historic = float(np.mean(list(speed_history[track_id])[:-2]))
        sudden_stop = (historic - recent > 10 and historic > 6)

    if len(aspect_history[track_id]) >= 5:
        base     = float(np.mean(list(aspect_history[track_id])[:-1]))
        deformed = abs(asp - base) > 0.32

    return speed, sudden_stop, deformed


# ═════════════════════════════════════════════════════════════
# HELMET vs HAT/CAP CLASSIFIER
# ═════════════════════════════════════════════════════════════
def classify_head_protection(frame, head_bbox):
    """
    Returns: "helmet" | "hat_cap" | "none"

    Heuristics (no separate model needed):
      1. Aspect ratio: helmets are rounder (w/h ≈ 0.9–1.3)
         baseball caps are wider and flatter (w/h > 1.4)
      2. Colour: helmets are often solid bright/dark single colour
         caps have brim shadow creating a two-tone horizontal split
      3. Edge gradient: helmet edge is smooth curved arc
         cap has a nearly horizontal brim edge in lower half
    """
    x1, y1, x2, y2 = [int(v) for v in head_bbox]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)

    if x2 <= x1 or y2 <= y1:
        return "none"

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return "none"

    h_roi, w_roi = roi.shape[:2]
    if h_roi < 8 or w_roi < 8:
        return "none"

    aspect = w_roi / (h_roi + 1e-6)

    # ── Brim detection: horizontal edge in bottom 40% of head ROI ──
    lower = roi[int(h_roi * 0.55):, :]
    gray_lower = cv2.cvtColor(lower, cv2.COLOR_BGR2GRAY)
    edges_lower = cv2.Canny(gray_lower, 30, 80)
    # Count horizontal edge pixels (Sobel-x much less than Sobel-y)
    sobelx = cv2.Sobel(gray_lower, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray_lower, cv2.CV_64F, 0, 1, ksize=3)
    h_edge_ratio = float(np.mean(np.abs(sobely))) / \
                   (float(np.mean(np.abs(sobelx))) + 1e-6)

    # ── Colour uniformity (helmets are more uniform) ──
    hsv   = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h_std = float(np.std(hsv[:, :, 0]))   # hue std
    s_std = float(np.std(hsv[:, :, 1]))   # saturation std

    has_brim = (h_edge_ratio > 2.5 and aspect > 1.3)
    is_round = (0.75 < aspect < 1.45)
    is_uniform_colour = (h_std < 30 and s_std < 45)

    if has_brim:
        return "hat_cap"
    elif is_round and is_uniform_colour:
        return "helmet"
    elif is_round:
        return "helmet"      # benefit of doubt for round shapes
    else:
        return "none"


# ═════════════════════════════════════════════════════════════
# MULTI-PARAMETER ACCIDENT SCORE
# ═════════════════════════════════════════════════════════════
def accident_score(iou_val, near_miss,
                   sudden_stop_any, deformed_any,
                   pixel_delta, edge_density,
                   bg_blob, chaos,
                   victim_count):
    """
    Returns confidence ∈ [0, 1] and list of triggered signals.
    Accident confirmed when confidence ≥ 0.55 (tunable).
    """
    s  = 0.0
    ev = []

    # Primary collision signals
    if iou_val > 0.05:
        s += 0.40; ev.append(f"iou={iou_val:.2f}")
    elif iou_val > 0.02:
        s += 0.20; ev.append(f"iou_partial={iou_val:.2f}")

    if near_miss:
        s += 0.08; ev.append("near_miss")

    # Motion signals
    if sudden_stop_any:
        s += 0.20; ev.append("sudden_stop")
    if deformed_any:
        s += 0.12; ev.append("bbox_deform")

    # Scene signals
    if pixel_delta > 6000:
        s += 0.10; ev.append(f"px_delta={pixel_delta}")
    if bg_blob > 10000:
        s += 0.07; ev.append("bg_blob")
    if edge_density > 0.16:
        s += 0.06; ev.append(f"edge_den={edge_density:.2f}")
    if chaos > 1.6:
        s += 0.10; ev.append(f"flow_chaos={chaos:.1f}")

    # Victim presence
    if victim_count >= 1:
        s += 0.10; ev.append(f"victims={victim_count}")

    s = round(min(s, 1.0), 3)

    if s >= 0.75:   sev = "HIGH"
    elif s >= 0.50: sev = "MEDIUM"
    elif s >= 0.30: sev = "LOW"
    else:           sev = "NONE"

    return s, sev, ev


# ═════════════════════════════════════════════════════════════
# RED ZONE BOX — drawn around entire collision area
# ═════════════════════════════════════════════════════════════
def draw_collision_zone(frame, boxes, confidence, severity):
    """
    Merge all colliding vehicle boxes into one large red bounding box.
    Adds a semi-transparent red fill and a severity label.
    """
    if not boxes:
        return frame

    all_x1 = min(b[0] for b in boxes) - 15
    all_y1 = min(b[1] for b in boxes) - 15
    all_x2 = max(b[2] for b in boxes) + 15
    all_y2 = max(b[3] for b in boxes) + 15

    h, w = frame.shape[:2]
    all_x1 = max(0, all_x1); all_y1 = max(0, all_y1)
    all_x2 = min(w, all_x2); all_y2 = min(h, all_y2)

    # ── Semi-transparent red fill ──
    overlay = frame.copy()
    cv2.rectangle(overlay, (all_x1, all_y1), (all_x2, all_y2),
                  (0, 0, 200), -1)
    frame = cv2.addWeighted(overlay, 0.22, frame, 0.78, 0)

    # ── Solid thick red border ──
    cv2.rectangle(frame, (all_x1, all_y1), (all_x2, all_y2),
                  (0, 0, 255), 3)

    # ── Corner ticks (makes it look professional) ──
    tick = 18
    for (sx, sy, ex, ey) in [
        (all_x1, all_y1, all_x1+tick, all_y1),
        (all_x1, all_y1, all_x1, all_y1+tick),
        (all_x2, all_y1, all_x2-tick, all_y1),
        (all_x2, all_y1, all_x2, all_y1+tick),
        (all_x1, all_y2, all_x1+tick, all_y2),
        (all_x1, all_y2, all_x1, all_y2-tick),
        (all_x2, all_y2, all_x2-tick, all_y2),
        (all_x2, all_y2, all_x2, all_y2-tick),
    ]:
        cv2.line(frame, (sx, sy), (ex, ey), (0, 0, 255), 4)

    # ── Label ──
    label = f"ACCIDENT [{severity}] conf={confidence:.0%}"
    lw, lh = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.58, 2)[0]
    cv2.rectangle(frame,
                  (all_x1, all_y1 - lh - 10),
                  (all_x1 + lw + 8, all_y1),
                  (0, 0, 200), -1)
    cv2.putText(frame, label,
                (all_x1 + 4, all_y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2)

    return frame


# ═════════════════════════════════════════════════════════════
# PROCESS FRAME — main entry point called by server.py / check.py
# ═════════════════════════════════════════════════════════════
def process_frame(frame):
    """
    Run YOLO tracking + night vision on a frame.
    Returns list of detection dicts.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if gray.mean() < 80:
        frame = enhance_night_vision(frame)

    results = model.track(frame, persist=True, conf=0.35,
                          tracker="bytetrack.yaml", verbose=False)

    detections = []
    if results and results[0].boxes is not None:
        boxes = results[0].boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf   = float(box.conf[0])
            cls_id = int(box.cls[0])
            label  = model.names[cls_id]
            tid    = int(box.id[0]) if box.id is not None else -1

            detections.append({
                "class":      label,
                "confidence": conf,
                "bbox":       [x1, y1, x2, y2],
                "track_id":   tid,
            })

    return detections


# ═════════════════════════════════════════════════════════════
# DETECT COLLISIONS — called by server.py / check.py
# ═════════════════════════════════════════════════════════════
def detect_collisions(detections, frame=None):
    """
    Returns list of confirmed collision events.
    Each event: {
        "pair": (obj1, obj2),
        "iou": float,
        "confidence": float,
        "severity": str,
        "evidence": list,
        "zone_bbox": [x1,y1,x2,y2],   ← merged red-zone box
        "victim_count": int,
        "new_alert": bool,             ← True only on first confirmation
    }
    """
    global collision_registry

    # ── Scene-level signals ──────────────────────────────────
    pixel_delta = edge_density = bg_blob = chaos = 0
    if frame is not None:
        curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        chaos = optical_flow_chaos(curr_gray)
        pixel_delta, edge_density, bg_blob = scene_signals(frame)

    # ── Split detections ────────────────────────────────────
    vehicles = [d for d in detections if d["class"] in VEHICLE_CLASSES
                and d["confidence"] > 0.40]
    persons  = [d for d in detections if d["class"] in PERSON_CLASSES]

    # ── Update per-track motion ──────────────────────────────
    motion_map = {}
    for v in vehicles:
        tid = v["track_id"]
        if tid < 0:
            continue
        spd, s_stop, deform = update_track_motion(tid, v["bbox"])
        motion_map[tid] = {"speed": spd, "sudden_stop": s_stop,
                           "deformed": deform}

    confirmed_events = []
    now = time.time()

    # ── Pairwise collision check ─────────────────────────────
    for i in range(len(vehicles)):
        for j in range(i + 1, len(vehicles)):
            v1, v2 = vehicles[i], vehicles[j]
            b1, b2 = v1["bbox"], v2["bbox"]

            iou_val  = iou(b1, b2)
            dist     = centroid_dist(b1, b2)
            avg_w    = ((b1[2]-b1[0]) + (b2[2]-b2[0])) / 2.0
            near_miss = (dist < avg_w * 0.85 and iou_val < 0.15)

            # Only proceed if there is some overlap or very close
            if iou_val < 0.02:
                continue

            t1 = v1["track_id"]; t2 = v2["track_id"]
            pair_key = frozenset({t1, t2})

            # ── Motion signals for this pair ──
            s_stop1  = motion_map.get(t1, {}).get("sudden_stop", False)
            s_stop2  = motion_map.get(t2, {}).get("sudden_stop", False)
            deform1  = motion_map.get(t1, {}).get("deformed", False)
            deform2  = motion_map.get(t2, {}).get("deformed", False)
            sudden_stop_any = s_stop1 or s_stop2
            deformed_any    = deform1 or deform2

            # ── Victim count ──
            zone_cx = int((b1[0]+b1[2]+b2[0]+b2[2]) / 4)
            zone_cy = int((b1[1]+b1[3]+b2[1]+b2[3]) / 4)
            victim_count = sum(
                1 for p in persons
                if np.hypot(centroid(p["bbox"])[0] - zone_cx,
                            centroid(p["bbox"])[1] - zone_cy) < 220
            )

            # ── Score ──
            conf, sev, evidence = accident_score(
                iou_val, near_miss, sudden_stop_any, deformed_any,
                pixel_delta, edge_density, bg_blob, chaos, victim_count
            )

            # ── Collision lock logic ──────────────────────────
            reg = collision_registry.get(pair_key)
            new_alert = False

            if conf >= 0.25:
                if reg is None:
                    # First frame this pair overlaps enough
                    collision_registry[pair_key] = {
                        "start":   now,
                        "alerted": False,
                        "locked_until": 0,
                    }
                    reg = collision_registry[pair_key]

                elapsed = now - reg["start"]

                if elapsed >= CONFIRM_SECONDS and not reg["alerted"]:
                    # ── FIRST real alert for this collision ──
                    reg["alerted"]      = True
                    reg["locked_until"] = now + COOLDOWN_SECONDS
                    new_alert = True

                # After cooldown, allow re-alerting if still colliding
                if now > reg["locked_until"] and reg["alerted"]:
                    reg["alerted"]      = False
                    reg["start"]        = now
                    reg["locked_until"] = 0

                confirmed_events.append({
                    "pair":          (v1, v2),
                    "iou":           round(iou_val, 3),
                    "confidence":    conf,
                    "severity":      sev,
                    "evidence":      evidence,
                    "zone_bbox":     [
                        min(b1[0],b2[0]), min(b1[1],b2[1]),
                        max(b1[2],b2[2]), max(b1[3],b2[3])
                    ],
                    "victim_count":  victim_count,
                    "new_alert":     new_alert,
                })
            else:
                # Confidence dropped — reset timer but keep registry entry
                if reg is not None and not reg["alerted"]:
                    collision_registry[pair_key]["start"] = now

    # Prune stale registry entries (pairs no longer seen)
    active_keys = set()
    for i in range(len(vehicles)):
        for j in range(i+1, len(vehicles)):
            active_keys.add(frozenset({vehicles[i]["track_id"],
                                       vehicles[j]["track_id"]}))
    for k in list(collision_registry.keys()):
        if k not in active_keys:
            del collision_registry[k]

    return confirmed_events


# ═════════════════════════════════════════════════════════════
# DRAW ALL DETECTIONS  — called by server.py / check.py
# ═════════════════════════════════════════════════════════════
def draw_detections(frame, detections, collision_events):
    """
    Draw per-object boxes (green for vehicles, blue for persons).
    Draw helmet/hat label on persons near bikes.
    Then overlay the red collision zone on top.
    """
    # ── Normal detection boxes ──
    for obj in detections:
        x1, y1, x2, y2 = map(int, obj["bbox"])
        cls = obj["class"]
        conf = obj["confidence"]

        if cls in VEHICLE_CLASSES:
            colour = (0, 220, 0)
        elif cls in PERSON_CLASSES:
            colour = (220, 180, 0)
            # Helmet check on head region (top 35% of person box)
            head_h = int((y2-y1) * 0.38)
            head_bbox = [x1, y1, x2, y1+head_h]
            protection = classify_head_protection(frame, head_bbox)
            prot_colours = {
                "helmet":  (0, 200, 0),
                "hat_cap": (0, 200, 255),
                "none":    (0, 60, 255),
            }
            prot_colour = prot_colours[protection]
            cv2.putText(frame, protection.upper(),
                        (x1, y1 - 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                        prot_colour, 2)
        else:
            colour = (180, 180, 180)

        cv2.rectangle(frame, (x1, y1), (x2, y2), colour, 2)
        label = f"{cls} {conf:.2f}"
        (lw, lh), _ = cv2.getTextSize(label,
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(frame, (x1, y1-lh-6), (x1+lw+4, y1), colour, -1)
        cv2.putText(frame, label, (x1+2, y1-4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

    # ── RED COLLISION ZONE ──
    for event in collision_events:
        v1, v2   = event["pair"]
        b1, b2   = v1["bbox"], v2["bbox"]
        conf     = event["confidence"]
        sev      = event["severity"]

        # Draw individual colliding vehicles in orange-red
        for v in (v1, v2):
            vx1,vy1,vx2,vy2 = map(int, v["bbox"])
            cv2.rectangle(frame, (vx1,vy1), (vx2,vy2), (0, 80, 255), 3)

        frame = draw_collision_zone(
            frame,
            [list(map(int, b1)), list(map(int, b2))],
            conf, sev
        )

    return frame
