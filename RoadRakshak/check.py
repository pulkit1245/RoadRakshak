"""
check.py — RoadGuard AI Multi-Agent (local test, no server)
============================================================
Run with:  python check.py
Press  q  to quit,  s  to save snapshot manually,  n  to simulate night.
"""

import cv2
import time
from agents.coordinator import AgentCoordinator

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Camera not accessible — exiting")
    exit(1)

coord = AgentCoordinator(skip_frames=2)
print("RoadGuard AI Multi-Agent started.")
print("  q = quit   s = snapshot   n = toggle night sim")

night_sim = False

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    # Optional: darken frame to test night vision
    if night_sim:
        frame = (frame * 0.3).astype("uint8")

    result = coord.process(frame)
    annotated = result["frame"]
    payload   = result["payload"]

    # Print collision events to terminal
    if payload.get("collision"):
        for col in payload.get("collisions", []):
            if col.get("new_alert"):
                print(f"NEW ALERT | sev={col['severity']} "
                      f"conf={col['confidence']:.2f} "
                      f"victims={col['victims']} "
                      f"evidence={col['evidence']}")

    # Print violations
    for viol in payload.get("violations", []):
        print(f"VIOLATION | {viol['violation']} "
              f"track={viol['track_id']} "
              f"speed={viol['speed_px']}px/f "
              f"angle={viol['angle_deg']}°")

    cv2.imshow("RoadGuard AI — Multi-Agent", annotated)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('s'):
        fname = f"manual_snapshot_{int(time.time())}.jpg"
        cv2.imwrite(fname, annotated)
        print(f"Manual snapshot: {fname}")
    elif key == ord('n'):
        night_sim = not night_sim
        print(f"Night simulation: {'ON' if night_sim else 'OFF'}")

cap.release()
cv2.destroyAllWindows()
print("Exited cleanly.")
