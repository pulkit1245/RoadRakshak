"""
server.py — RoadGuard AI Enhanced
===================================
Changes vs original:
  • Passes raw frame to detect_collisions() for scene signals
  • Uses draw_detections() from detection.py (red zone included)
  • Sends richer JSON to frontend (severity, confidence, victims, evidence)
  • Snapshot saved only on new_alert (no duplicate saves)
  • FPS throttle: skips alternate frames for performance
"""

from fastapi import FastAPI, WebSocket
import cv2
import base64
import time

from detection import process_frame, detect_collisions, draw_detections

app = FastAPI()

last_saved_time = 0
SAVE_INTERVAL   = 5       # minimum seconds between snapshots
frame_count     = 0


# ─────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "RoadGuard AI Server Running"}


# ─────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global last_saved_time, frame_count

    await websocket.accept()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Camera not accessible")
        await websocket.close()
        return

    prev_time   = 0
    detections  = []
    collisions  = []

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Frame grab failed, retrying...")
                continue

            frame_count += 1
            raw_frame = frame.copy()     # keep unmodified for signals

            # ── Process every 2nd frame to keep FPS up ──
            if frame_count % 2 == 0:
                detections = process_frame(frame)
                detections = [d for d in detections
                              if d["confidence"] > 0.38]
                collisions = detect_collisions(detections, raw_frame)
            # On skipped frames, reuse previous detections/collisions

            # ── Draw everything ──
            frame = draw_detections(frame, detections, collisions)

            # ── FPS ──
            curr_time = time.time()
            fps = 1 / (curr_time - prev_time) if prev_time else 0
            prev_time = curr_time

            cv2.putText(frame, f"FPS: {int(fps)}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # ── Global status text ──
            if collisions:
                worst = max(collisions, key=lambda e: e["confidence"])
                status = (f"COLLISION [{worst['severity']}] "
                          f"conf={worst['confidence']:.0%} "
                          f"victims={worst['victim_count']}")
                cv2.putText(frame, status, (10, frame.shape[0]-15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.58,
                            (0, 0, 255), 2)
            else:
                cv2.putText(frame, "Monitoring...", (10, frame.shape[0]-15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.58,
                            (0, 220, 100), 2)

            # ── Snapshot — only on genuinely new alerts ──
            now = time.time()
            new_alerts = [e for e in collisions if e["new_alert"]]
            if new_alerts and (now - last_saved_time) > SAVE_INTERVAL:
                fname = f"collision_{int(now)}.jpg"
                cv2.imwrite(fname, frame)
                last_saved_time = now
                print(f"Snapshot saved: {fname}")

            # ── Encode & send ──
            _, buffer = cv2.imencode(
                '.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')

            # Build collision payload
            collision_payload = []
            for e in collisions:
                collision_payload.append({
                    "confidence": e["confidence"],
                    "severity":   e["severity"],
                    "evidence":   e["evidence"],
                    "victims":    e["victim_count"],
                    "new_alert":  e["new_alert"],
                })

            await websocket.send_json({
                "frame":      frame_b64,
                "collision":  bool(collisions),
                "collisions": collision_payload,
                "fps":        int(fps),
            })

    except Exception as exc:
        print("WebSocket error:", exc)
    finally:
        cap.release()
        print("Camera released")
