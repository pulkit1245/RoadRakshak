"""
server.py — RoadGuard AI Multi-Agent Enhanced
==============================================
Drop-in replacement for the original server.py.

Changes:
  • Uses AgentCoordinator instead of calling detection.py directly
  • Cleaner WebSocket loop — coordinator returns ready payload
  • FPS throttle handled inside coordinator (skip_frames param)
  • All CV logic lives in agents/ — server is now pure I/O
"""

from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
import cv2
import time
import os

from agents.coordinator import AgentCoordinator

app        = FastAPI()
coordinator = AgentCoordinator(skip_frames=2)


@app.get("/")
def home():
    return {"message": "RoadGuard AI Multi-Agent Server Running"}


@app.get("/ui")
def ui():
    """Serve the frontend HTML."""
    try:
        with open("index.html") as f:
            return HTMLResponse(f.read())
    except FileNotFoundError:
        return HTMLResponse("<h2>index.html not found</h2>")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    cam_index = int(os.getenv("CAMERA_INDEX", "0"))
    cap       = cv2.VideoCapture(cam_index)

    if not cap.isOpened():
        print(f"[server] Camera {cam_index} not accessible")
        await websocket.close()
        return

    print("[server] Camera opened — streaming")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[server] Frame grab failed — retrying")
                continue

            # Run all agents — get back annotated frame + payload
            result = coordinator.process(frame)

            # Send payload (frame already base64-encoded inside coordinator)
            await websocket.send_json(result["payload"])

    except Exception as exc:
        print(f"[server] WebSocket error: {exc}")
    finally:
        cap.release()
        print("[server] Camera released")
