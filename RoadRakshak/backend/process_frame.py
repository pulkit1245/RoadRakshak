import cv2
import numpy as np
from typing import Dict

from .detection import VEHICLE_CLASSES, detect_collisions, process_frame as detect_frame


def enhance_night_vision(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)

    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)


def annotate_frame(frame, detections, collisions):
    annotated = frame.copy()
    for obj in detections:
        x1, y1, x2, y2 = map(int, obj["bbox"])
        label = f"{obj['class']} {obj['confidence']:.2f}"
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(annotated, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    if collisions:
        cv2.putText(
            annotated,
            "🚨 COLLISION ALERT!",
            (50, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            3,
        )

    return annotated


def assess_severity(vehicles, accident):
    if accident:
        return "high"
    if vehicles >= 6:
        return "medium"
    if vehicles >= 3:
        return "medium"
    return "low"


def process_frame(frame: bytes) -> Dict:
    image_array = np.frombuffer(frame, dtype=np.uint8)
    frame_bgr = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame_bgr is None:
        raise ValueError("Unable to decode incoming frame bytes")

    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    if gray.mean() < 80:
        frame_bgr = enhance_night_vision(frame_bgr)

    detections = detect_frame(frame_bgr)
    # Pass BGR frame so optical-flow / pixel-delta scene signals in accident_score are non-zero.
    collisions = detect_collisions(detections, frame_bgr)

    annotated_frame = annotate_frame(frame_bgr, detections, collisions)
    # JPEG is much faster to encode than PNG for live streaming.
    _, encoded = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])

    vehicle_count = sum(1 for d in detections if d["class"] in VEHICLE_CLASSES)
    accident = bool(collisions)
    severity = assess_severity(vehicle_count, accident)

    violations = []
    if collisions:
        # detect_collisions() returns event dicts: pair, iou, confidence, severity, ...
        for ev in collisions:
            obj1, obj2 = ev["pair"]
            iou_val = ev["iou"]
            violations.append(
                {
                    "type": "collision",
                    "description": (
                        f"{obj1['class']} vs {obj2['class']} collision, IoU={iou_val:.2f} "
                        f"(conf={ev.get('confidence', 0):.2f})"
                    ),
                }
            )

    return {
        "vehicles": int(vehicle_count),
        "violations": violations,
        "accident": accident,
        "severity": severity,
        "annotated_frame": encoded.tobytes(),
        "snapshot_path": None,
    }
