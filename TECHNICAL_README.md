# 🛠️ RoadRakshak Technical Documentation: Deep-Dive

This document provides an exhaustive technical breakdown of the RoadRakshak-2 architecture, including data models, AI agent logic, and backend services.

---

## 🏗️ System Architecture: The Multi-Agent Pipeline

RoadRakshak uses a modular **AgentCoordinator** to orchestrate five specialized AI agents. This design allows for parallel execution, high FPS, and easy model swapping.

### 1. Agent 1: Vehicle Detection (`vehicle_agent.py`)
- **Core Model:** YOLOv8 (Nano) for real-time inference.
- **Tracking:** **ByteTrack** for persistent object ID assignment.
- **Preprocessing:** **CLAHE** (Contrast Limited Adaptive Histogram Equalization) is automatically applied when average frame brightness drops below a threshold (Night Vision mode).
- **Features:**
  - Per-class confidence thresholds (Cars: 0.42, Trucks: 0.40, Motorcycles: 0.35).
  - Motion analysis: Computes per-track speed, sudden stop flags, and bounding-box deformation (indicative of impact).

### 2. Agent 2: Scene Analysis (`scene_agent.py`)
Operates independently of object detection to provide environmental context.
- **Optical Flow Chaos:** Detects sudden, violent motion patterns using `calcOpticalFlowFarneback`.
- **Pixel Delta:** Measures frame-to-frame change to identify large-scale movement.
- **Edge Density:** Scans the road ROI for shattered glass or debris (high edge frequency).
- **Background Subtraction:** Uses **MOG2** to identify stationary foreign objects in the traffic flow.
- **Hazard Detection:** Specialized hue-based masks for **Fire** (orange/red) and **Smoke** (gray/low-saturation).

### 3. Agent 3: Collision Reasoning (`collision_agent.py`)
The logic engine that fuses data from Agent 1 and Agent 2.
- **Pairwise IoU:** Checks for overlaps between all detected vehicle tracks.
- **Confidence Scoring:** A multi-parameter weighted algorithm:
  - `s += 0.40` for direct IoU overlap.
  - `s += 0.20` for sudden stops.
  - `s += 0.18` for detected fire.
  - `s += 0.15` for nearby pedestrians (victims).
- **Spatial Deduplication:** Prevents duplicate alerts for the same physical crash by maintaining a spatio-temporal history.

### 4. Agent 4: Wrong-Way & Overspeeding (`wrongway_agent.py`)
- **Direction Vectors:** Computes the unit vector of movement over the last 10-40 frames.
- **Dominant Flow Analysis:** Dynamically calculates the "normal" direction of traffic; vehicles deviating by >120° are flagged as **Wrong-Way**.
- **Speed Estimation:** Calculates pixel-velocity; values exceeding 22 px/frame (calibrated to lane width) trigger an **Overspeeding** violation.

### 5. Agent 5: Alert Dispatch (`alert_agent.py`)
- **Evidence Gathering:** Saves annotated JPEG snapshots of critical incidents.
- **External Integration:** Connects to **Twilio API** for WhatsApp/SMS dispatch.
- **Payload Construction:** Formats the final JSON bundle sent to the frontend via WebSockets.

---

## 📊 Data Models (SQLAlchemy)

### 👤 User Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key |
| `email` | String | Unique login identifier |
| `is_admin` | Boolean | Grants access to role management |

### 🚨 Incident Model
The primary record for every detected event.
| Field | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | DateTime | UTC time of detection |
| `severity` | String | Low, Medium, High, Critical |
| `accident` | Boolean | True if a collision was confirmed |
| `snapshot_path` | String | File path to the evidence JPEG |

### 🏥 Hospital Model
Pre-registered trauma centers with real-time capability tracking.
| Field | Type | Description |
| :--- | :--- | :--- |
| `latitude/longitude` | Float | GPS coordinates |
| `beds_available` | Integer | Current ER capacity |
| `response_capability`| Integer | Triage readiness score (0-100) |
| `hospital_code` | String | Unique identifier for hospital-specific views |

### 🚑 Emergency Dispatch Model
Links an incident to a specific hospital and route.
| Field | Type | Description |
| :--- | :--- | :--- |
| `distance_km` | Float | Driving distance calculated via OSRM |
| `eta_minutes` | Integer | Estimated time of arrival for ambulance |
| `route_json` | Text | Full polyline coordinates for map display |

---

## ⚙️ Backend Services

### 🏥 Hospital Service (`hospital_service.py`)
- **Ranking Engine:** A weighted formula `(0.42 * distance + 0.33 * beds + 0.25 * response)` determines the best hospital for any given accident.
- **Routing:** Integrates with the **OSRM Public API** to fetch real-world driving paths, with a straight-line fallback.

### 📄 PDF Report Generator (`pdf_report.py`)
- Uses **ReportLab** to generate formal incident reports.
- Includes embedded incident snapshots, violation tables, and hospital dispatch details.

### 🔐 Auth Service (`auth.py`)
- Implements **JWT (JSON Web Token)** based authentication.
- Password hashing using `passlib[bcrypt]`.

---

## 💻 Frontend Components

- **MultiCameraManager:** Orchestrates multiple WebSocket streams for city-wide monitoring.
- **RiskZoneHeatmap:** Uses `react-leaflet-heatmap-layer` to visualize incident density.
- **ViolationLog:** A real-time scrolling list of detections with severity color-coding.
- **RoleManager:** Admin panel for managing system users and access levels.
