import cv2
import numpy as np
import base64
from typing import Dict
import os
import sys

# Ensure the root directory is in sys.path so we can import 'agents'
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.append(root_dir)

try:
    from agents.coordinator import AgentCoordinator
    # Initialize coordinator once (stateless-ish, but carries frame counters)
    coordinator = AgentCoordinator(skip_frames=1) # Backend main handles its own frame skipping
    HAS_AGENTS = True
except ImportError as e:
    print(f"Warning: Could not import AgentCoordinator: {e}")
    HAS_AGENTS = False
    from .detection import VEHICLE_CLASSES, detect_collisions, process_frame as detect_frame

def process_frame(frame: bytes) -> Dict:
    image_array = np.frombuffer(frame, dtype=np.uint8)
    frame_bgr = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame_bgr is None:
        raise ValueError("Unable to decode incoming frame bytes")

    if HAS_AGENTS:
        # Use the new Multi-Agent architecture
        result = coordinator.process(frame_bgr)
        annotated_frame = result["frame"]
        payload = result["payload"]
        
        # Bridge to the frontend's expected format
        _, encoded = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        
        # Map violations
        violations = []
        for v in payload.get("violations", []):
            violations.append({
                "type": v.get("violation", "unknown"),
                "description": f"Violation detected: {v.get('violation')} (track {v.get('track_id')})"
            })
            
        # Map collisions
        accident = payload.get("collision", False)
        if accident:
            for col in payload.get("collisions", []):
                violations.append({
                    "type": "collision",
                    "description": f"Accident detected | Severity: {col.get('severity')} | Confidence: {col.get('confidence', 0):.2f}"
                })

        # Map detections for frontend drawing
        vehicles_list = []
        for v in payload.get("vehicles", []):
            vehicles_list.append({
                "class": v.get("class"),
                "confidence": v.get("confidence"),
                "bbox": v.get("bbox"),
                "track_id": v.get("track_id"),
                "violation": v.get("violation") # wrong_way, overspeeding, etc.
            })
        
        persons_list = []
        for p in payload.get("persons", []):
            persons_list.append({
                "class": "person",
                "confidence": p.get("confidence"),
                "bbox": p.get("bbox"),
                "track_id": p.get("track_id")
            })

        return {
            "vehicles_count": len(payload.get("vehicles", [])),
            "vehicles": vehicles_list, # Full list for frontend
            "persons": persons_list,
            "violations": violations,
            "accident": accident,
            "new_accident": payload.get("alert_fired", False), # NEW FLAG
            "severity": "high" if accident else ("medium" if len(payload.get("vehicles", [])) > 5 else "low"),
            "annotated_frame": encoded.tobytes(),
            "snapshot_path": None, # Handled by backend/main.py
        }
    else:
        # Fallback to legacy logic
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        if gray.mean() < 80:
            # Simple night vision
            lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            frame_bgr = cv2.cvtColor(cv2.merge((clahe.apply(l), a, b)), cv2.COLOR_LAB2BGR)

        detections = detect_frame(frame_bgr)
        collisions = detect_collisions(detections, frame_bgr)

        # Simple annotation
        annotated = frame_bgr.copy()
        for obj in detections:
            x1, y1, x2, y2 = map(int, obj["bbox"])
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        _, encoded = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        
        vehicle_count = sum(1 for d in detections if d["class"] in VEHICLE_CLASSES)
        accident = bool(collisions)
        
        return {
            "vehicles": int(vehicle_count),
            "violations": [],
            "accident": accident,
            "severity": "high" if accident else "low",
            "annotated_frame": encoded.tobytes(),
            "snapshot_path": None,
        }
