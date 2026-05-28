import cv2
import numpy as np
import os
import sys
from agents.coordinator import AgentCoordinator

def test_coordinator():
    print("Initializing AgentCoordinator...")
    # skip_frames=1 to ensure we process the first frame
    coord = AgentCoordinator(skip_frames=1)
    
    # Create a dummy image (black background with some white rectangles to simulate objects)
    print("Creating synthetic frame...")
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw a rectangle to simulate a "vehicle" (though YOLO might not see it as one)
    cv2.rectangle(frame, (100, 100), (200, 200), (255, 255, 255), -1)
    
    print("Processing frame...")
    try:
        result = coord.process(frame)
        
        print("\n--- Test Results ---")
        payload = result["payload"]
        print(f"FPS: {payload.get('fps')}")
        print(f"Night Mode: {payload.get('night_mode')}")
        print(f"Alert Fired: {payload.get('alert_fired')}")
        print(f"Vehicles found: {len(payload.get('vehicles', []))}")
        print(f"Violations found: {len(payload.get('violations', []))}")
        
        if "frame" in payload:
            print("Frame encoded successfully in payload.")
        
        print("\nCoordinator test PASSED (logic check).")
        return True
    except Exception as e:
        print(f"\nCoordinator test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Ensure yolov8n.pt is available
    if not os.path.exists("yolov8n.pt"):
        print("Error: yolov8n.pt not found in current directory.")
        sys.exit(1)
        
    success = test_coordinator()
    sys.exit(0 if success else 1)
