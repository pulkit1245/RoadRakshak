<![CDATA[<div align="center">

# 🚦 RoadRakshak

### AI-Powered Traffic Management & Incident Detection System

A sophisticated, multi-agent computer vision platform designed to enhance road safety through **real-time traffic monitoring**, **intelligent incident detection**, and **automated emergency response**.

![Version](https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/react-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/fastapi-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-ultralytics-FF6F00?style=for-the-badge)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=for-the-badge)

---

[Features](#-key-features) · [Architecture](#-system-architecture) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [The Multi-Agent AI Pipeline](#-the-multi-agent-ai-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup)
  - [Environment Variables](#3-environment-variables)
- [API Reference](#-api-reference)
  - [REST Endpoints](#rest-endpoints)
  - [WebSocket Endpoints](#websocket-endpoints)
- [Data Models](#-data-models)
- [Frontend Pages & Components](#-frontend-pages--components)
- [Hospital Portal](#-hospital-portal)
- [External Service Dependencies](#-external-service-dependencies)
- [Configuration](#-configuration)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Key Features

### 🧠 Intelligent Incident Detection (Multi-Agent AI)

Using a coordinated multi-agent architecture powered by **YOLOv8** and **ByteTrack**, RoadRakshak detects and responds to a wide range of traffic incidents:

| Category | Capability | How It Works |
|:---|:---|:---|
| 🚗 **Vehicle Collisions** | Real-time accident detection | Multi-parameter confidence scoring (IoU overlap, sudden stops, bbox deformation, scene chaos, fire, victim proximity) |
| 🚫 **Wrong-Way Driving** | Directional violation detection | Trajectory analysis via cosine similarity against dominant traffic flow; flags deviations >120° |
| ⚡ **Overspeeding** | Speed violation monitoring | Pixel-velocity estimation calibrated to lane width (threshold: 22 px/frame) |
| 🚶 **Pedestrian Safety** | Jaywalking & crowd density | Restricted zone monitoring and crowd density analysis |
| 🔥 **Environmental Hazards** | Fire & smoke detection | HSV color-space masks — fire (orange-red hue) and smoke (low-saturation gray) |
| 🌙 **Night Vision** | Low-light enhancement | Automatic CLAHE preprocessing when mean frame brightness drops below 80 |

### 🚑 Emergency Response & Hospital Integration

- **Smart Hospital Ranking** — Weighted algorithm (`0.42 × distance + 0.33 × bed_ratio + 0.25 × response_capability`) selects the best-suited hospital for each incident.
- **Dynamic Routing** — Real-time driving routes from accident sites to hospitals via **OSRM** (Open Source Routing Machine), with Haversine straight-line fallback.
- **Ola Maps Integration** — Frontend queries the **Ola Maps Nearby Search API** to discover hospitals near accident sites; backend auto-registers them with generated login codes.
- **Automated Dispatch** — Instant emergency bundles with hospital assignment, route, ETA, and snapshot evidence.
- **Twilio Alerts** — WhatsApp/SMS notifications with severity, confidence, victim count, and hospital assignment. Rate-limited to 12s cooldown, minimum 0.45 confidence threshold.

### 🏥 Dedicated Hospital Dashboard

A separate hospital-facing portal with code-based authentication:

- **Real-time WebSocket alerts** — Live accident push notifications with siren audio.
- **Alert lifecycle management** — Pending → Accepted → Arrived Scene → Patient Loaded → Completed (or Rejected).
- **Bed availability management** — Real-time capacity tracking with visual progress bars.
- **Accident snapshots** — View reference images from the incident scene.
- **Demo codes:** `HOSP-AIIMS`, `HOSP-APOLLO`, `HOSP-FORTIS`, `HOSP-MAX`.

### 📊 Analytics & Reporting

- **Live Dashboard** — Military/tactical dark UI with KPI cards, violation tables, accident lists, auto-refreshing every 5 seconds.
- **Rich Analytics** — Bar charts (violations over time), line charts (accidents over time), pie charts (hotspot locations) with 7/30/90-day timeframe filters. Falls back to mock data when the backend is offline.
- **PDF Incident Reports** — One-click generation via **jsPDF** + **html2canvas** (frontend) and **ReportLab** (backend), including timestamps, severity scores, vehicle/pedestrian counts, hospital dispatch info, and annotated snapshots.
- **Risk Heatmaps** — Geographic visualization of accident-prone zones using `leaflet.heat` with green → yellow → red gradient.

### 🔐 Dual Authentication System

| Portal | Auth Method | Details |
|:---|:---|:---|
| **Admin Dashboard** | JWT (HS256) | Email/password login, 60-min token expiry, `passlib[pbkdf2_sha256]` hashing |
| **Hospital Dashboard** | Hospital Code | Simple code-based auth (e.g., `HOSP-AIIMS`), stored in localStorage |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│                                                                     │
│   Admin Portal                          Hospital Portal             │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────────┐      │
│  │Dashboard │ │Live Feed │ │Map View │ │Hospital Dashboard │      │
│  │Analytics │ │Advanced  │ │         │ │(Code-based auth)  │      │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └────────┬──────────┘      │
│       │ HTTP/Axios  │ WebSocket  │               │ WebSocket       │
└───────┼─────────────┼────────────┼───────────────┼──────────────────┘
        │             │            │               │
┌───────┼─────────────┼────────────┼───────────────┼──────────────────┐
│                     FastAPI Server (port 8000)                       │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────────────────────┐ │
│  │  REST API    │  │ Auth       │  │  WebSocket Endpoints        │ │
│  │  20+ routes  │  │ JWT + Code │  │  /ws (detection pipeline)   │ │
│  └──────┬───────┘  └────────────┘  │  /ws/hospital/{id} (alerts) │ │
│         │                          └──────────┬──────────────────┘ │
│  ┌──────┴──────────────────────────────────────┴───────────────┐   │
│  │              Agent Coordinator (process_frame)               │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────────────┐ │   │
│  │  │ Vehicle    │ │  Scene     │ │   Collision               │ │   │
│  │  │ Agent      │ │  Agent     │ │   Agent                   │ │   │
│  │  │ (YOLOv8 +  │ │ (OpenCV   │ │ (Multi-param fusion)      │ │   │
│  │  │ ByteTrack) │ │  5 signals)│ │                           │ │   │
│  │  └────────────┘ └────────────┘ └──────────────────────────┘ │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │ Wrong-Way /          │  │     Alert Agent              │ │   │
│  │  │ Overspeed Agent      │  │  (Twilio + Snapshots + WS)   │ │   │
│  │  └──────────────────────┘  └──────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│  ┌──────┴──────┐  ┌─────────────┐  ┌──────────────┐               │
│  │  SQLite DB  │  │  OSRM API   │  │ Ola Maps API │               │
│  │ (SQLAlchemy)│  │  (Routing)  │  │ (Hospitals)  │               │
│  └─────────────┘  └─────────────┘  └──────────────┘               │
│         │              │                    │                        │
│  ┌──────┴──────┐  ┌───┴──────┐  ┌─────────┴────────┐              │
│  │  Twilio     │  │ ReportLab│  │ OpenStreetMap    │              │
│  │  (SMS/WA)   │  │ (PDF)    │  │ (Map tiles)     │              │
│  └─────────────┘  └──────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 The Multi-Agent AI Pipeline

RoadRakshak uses a modular **AgentCoordinator** that orchestrates five specialized AI agents. Each video frame flows through this pipeline sequentially, with frame-skipping optimization (heavy agents run every Nth frame, reusing the previous payload in between) to maintain high FPS:

### Agent 1 → Vehicle Detection (`vehicle_agent.py`)

| Aspect | Detail |
|:---|:---|
| **Model** | YOLOv8 Nano for real-time inference |
| **Tracking** | ByteTrack for persistent object ID assignment |
| **Preprocessing** | CLAHE auto-applied when mean brightness < 80 (night vision) |
| **Confidence Thresholds** | Cars: 0.42 · Trucks: 0.40 · Motorcycles: 0.35 · Persons: 0.38 |
| **Motion Analysis** | Per-track speed, sudden stop flags, bbox aspect-ratio deformation |
| **History** | 30-frame position history per track, auto-prune after 10s unseen |

### Agent 2 → Scene Analysis (`scene_agent.py`)

Five independent, YOLO-independent environmental signals:

| Signal | Method | Detects |
|:---|:---|:---|
| **Optical Flow Chaos** | Farneback optical flow → angular std deviation | Violent, erratic motion patterns |
| **Pixel Delta** | Frame-to-frame pixel change count | Large-scale sudden events |
| **Edge Density** | Canny edge density on road ROI | Shattered glass, scattered debris |
| **Background Blob** | MOG2 background subtraction | Stopped/crashed vehicles, foreign objects |
| **Fire / Smoke** | HSV color analysis | Fire (orange-red hue), smoke (low-saturation gray) |

### Agent 3 → Collision Reasoning (`collision_agent.py`)

The fusion engine that combines data from Agent 1 and Agent 2:

```
Multi-Parameter Confidence Score:
  +0.40  Direct IoU overlap between vehicle tracks
  +0.20  Sudden stop detected
  +0.18  Fire detected in scene
  +0.15  Nearby pedestrians (potential victims)
  +0.07  Optical flow chaos level
  + ...  Near-miss, deformation, pixel delta, background blob, edge density
```

| Severity Level | Score Threshold |
|:---|:---|
| 🔴 **CRITICAL** | ≥ 0.75 |
| 🟠 **HIGH** | ≥ 0.55 |
| 🟡 **MEDIUM** | ≥ 0.35 |
| 🟢 **LOW** | ≥ 0.20 |

- **Collision Lock Registry** — Confirms collision after 0.5s sustained overlap, 60s cooldown per pair.
- **Spatial Deduplication** — Prevents duplicate alerts within 150px / 30s of the same crash site.

### Agent 4 → Wrong-Way & Overspeeding (`wrongway_agent.py`)

- **Direction Vectors** — Unit vector of movement computed over last 10–40 frames of position history.
- **Dominant Flow** — Dynamically calculates the "normal" traffic direction from all tracked vehicles via cosine similarity.
- **Wrong-Way** — Vehicles deviating >120° from dominant flow (requires ≥ 8 frames history + ≥ 2 tracked vehicles).
- **Overspeeding** — Pixel-velocity exceeding 22 px/frame (calibrated to lane width).

### Agent 5 → Alert Dispatch (`alert_agent.py`)

- **Evidence Gathering** — Saves annotated JPEG snapshots to `snapshots/` directory.
- **Twilio Integration** — WhatsApp/SMS with severity, confidence, and victim count (12s cooldown, ≥0.45 confidence threshold).
- **WebSocket Payload** — Constructs `{ collision, collisions, violations, alert_fired }` for live streaming.
- **Rate Limiting** — Prevents alert flooding for repeated detections of the same event.

### Legacy Fallback (`detection.py`)

A monolithic fallback module (587 lines) that provides equivalent functionality when the multi-agent system is unavailable. Includes YOLOv8n + ByteTrack, IoU collision detection, helmet/hat/cap classification, night vision, and optical flow chaos — all in a single file.

---

## 🛠️ Tech Stack

### Backend (Python / FastAPI)

| Technology | Purpose |
|:---|:---|
| [FastAPI](https://fastapi.tiangolo.com/) | High-performance async API & WebSocket framework |
| [YOLOv8 (Ultralytics)](https://docs.ultralytics.com/) | State-of-the-art object detection |
| [OpenCV](https://opencv.org/) | Real-time image processing & frame annotation |
| [ByteTrack](https://github.com/ifzhang/ByteTrack) (`supervision` + `lap`) | Multi-object tracking with persistent IDs |
| [SQLAlchemy](https://www.sqlalchemy.org/) | ORM for SQLite database management |
| [Twilio](https://www.twilio.com/) | Real-time SMS/WhatsApp alert dispatching |
| [ReportLab](https://www.reportlab.com/) | Server-side PDF report generation |
| [OSRM](http://project-osrm.org/) | Open-source routing engine for emergency navigation |
| [python-jose](https://github.com/mpdavis/python-jose) | JWT token creation & verification (HS256) |
| [passlib](https://passlib.readthedocs.io/) | Password hashing (`pbkdf2_sha256`) |
| [python-dotenv](https://github.com/theskumar/python-dotenv) | Environment variable management |

### Frontend (React / Vite)

| Technology | Purpose |
|:---|:---|
| [React 18](https://react.dev/) | Component-based UI library |
| [Vite 5](https://vitejs.dev/) | Lightning-fast build tool with HMR |
| [Tailwind CSS 3.4](https://tailwindcss.com/) | Utility-first CSS framework |
| [React Router v6](https://reactrouter.com/) | Client-side routing |
| [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) | Interactive map visualizations |
| [Recharts](https://recharts.org/) | Dynamic data visualization & charts |
| [React-Webcam](https://github.com/mozmorris/react-webcam) | Client-side camera integration for live detection |
| [Axios](https://axios-http.com/) | HTTP client with JWT interceptor |
| [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) | Client-side PDF report generation |

---

## 📂 Project Structure

```
RoadRakshak-2/
│
├── RoadRakshak/                    # 🐍 Backend (Python/FastAPI)
│   ├── agents/                     #    Multi-agent AI pipeline
│   │   ├── coordinator.py          #    AgentCoordinator — orchestrates all 5 agents
│   │   ├── vehicle_agent.py        #    Agent 1: YOLOv8 + ByteTrack detection & tracking
│   │   ├── scene_agent.py          #    Agent 2: Environmental analysis (5 signals)
│   │   ├── collision_agent.py      #    Agent 3: Collision reasoning & confidence scoring
│   │   ├── wrongway_agent.py       #    Agent 4: Wrong-way & overspeeding detection
│   │   └── alert_agent.py          #    Agent 5: Alert dispatch (Twilio + snapshots)
│   │
│   ├── backend/                    #    FastAPI core application
│   │   ├── main.py                 #    App entry — 20+ routes, WebSockets, CORS, startup
│   │   ├── auth.py                 #    JWT authentication & password hashing
│   │   ├── database.py             #    SQLAlchemy + SQLite configuration
│   │   ├── models.py               #    ORM models (User, Incident, Violation, Hospital, etc.)
│   │   ├── schemas.py              #    Pydantic v2 request/response schemas
│   │   ├── hospital_service.py     #    Hospital ranking, OSRM routing, seed data
│   │   ├── process_frame.py        #    Bridge module — routes to agents or legacy fallback
│   │   ├── detection.py            #    Legacy monolithic detection (fallback)
│   │   ├── alert.py                #    Twilio WhatsApp/SMS dispatcher
│   │   ├── pdf_report.py           #    ReportLab PDF generation
│   │   ├── requirements.txt        #    Python dependencies
│   │   └── .env.example            #    Backend environment variable template
│   │
│   ├── snapshots/                  #    Evidence images (populated at runtime)
│   └── yolov8n.pt                  #    Pre-trained YOLOv8 Nano weights
│
├── src/                            # ⚛️ Frontend (React)
│   ├── main.jsx                    #    React entry point (BrowserRouter + StrictMode)
│   ├── App.jsx                     #    Root component — 9 routes, dual auth portals
│   ├── App.css                     #    Component-specific styles
│   ├── index.css                   #    Global styles + Tailwind + custom animations
│   │
│   ├── pages/                      #    Application views
│   │   ├── Login.jsx               #    Admin JWT login page
│   │   ├── Dashboard.jsx           #    Command center — KPIs, violations, accidents
│   │   ├── LiveFeed.jsx            #    Real-time webcam detection + emergency dispatch
│   │   ├── MapView.jsx             #    Leaflet map with accidents, hospitals, routes
│   │   ├── Analytics.jsx           #    Charts & analytics with timeframe filters
│   │   ├── AdvancedFeatures.jsx    #    Feature showcase (PDF, severity, multi-cam, heatmap)
│   │   ├── HospitalLogin.jsx       #    Hospital code-based login
│   │   └── HospitalDashboard.jsx   #    Hospital real-time alert management portal
│   │
│   ├── components/                 #    Reusable UI components
│   │   ├── ProtectedRoute.jsx      #    Auth guard — checks localStorage JWT
│   │   ├── MultiCameraManager.jsx  #    6-camera grid with status indicators
│   │   ├── RoleManager.jsx         #    RBAC permission matrix display
│   │   ├── RiskZoneHeatmap.jsx     #    Leaflet heatmap overlay for incident density
│   │   └── SeverityBadge.jsx       #    Severity score calculator + color-coded badge
│   │
│   ├── services/                   #    API integration layer
│   │   ├── api.js                  #    Axios instance, JWT interceptor, all API functions
│   │   └── websocket.js            #    WebSocket manager with auto-reconnect
│   │
│   ├── context/                    #    React Context providers
│   │   └── AuthContext.jsx         #    Authentication state (user, token, login, logout)
│   │
│   ├── hooks/                      #    Custom React hooks
│   │   └── useWebSocket.js         #    WebSocket hook with auto-cleanup on unmount
│   │
│   └── utils/                      #    Helper utilities
│       ├── formatters.js           #    Date, severity, duration, distance, number formatters
│       └── pdfGenerator.js         #    Client-side PDF report generation (jsPDF + html2canvas)
│
├── public/                         #    Static assets (vite.svg favicon)
├── dist/                           #    Production build output
│
├── .env.example                    #    Frontend environment variable template
├── package.json                    #    Frontend dependencies & scripts
├── vite.config.js                  #    Vite config (proxy, port 5173)
├── tailwind.config.js              #    Tailwind theme (brand colors, animations)
├── postcss.config.js               #    PostCSS plugin configuration
├── setup.sh                        #    Automated project setup script
├── SETUP-GUIDE.md                  #    Step-by-step setup instructions
├── TECHNICAL_README.md             #    Deep-dive technical documentation
└── README.md                       #    This file
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|:---|:---|
| **Python** | 3.9 or higher |
| **Node.js** | 18.x or higher |
| **npm** | 9.x or higher |
| **Git** | Latest |
| **Webcam** | Required for live detection (or use video file input) |

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/pulkit1245/RoadRakshak.git
cd RoadRakshak

# Navigate to the backend directory
cd RoadRakshak/backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your Twilio credentials, secret key, etc.

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`.
- **Interactive API docs:** `http://localhost:8000/docs`
- **On startup:** Automatically creates admin user + seeds 8 Delhi NCR hospitals (AIIMS, Safdarjung, LNJP, RML, Apollo, Max, Fortis, etc.)

### 2. Frontend Setup

```bash
# From the project root directory
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. The Vite dev server proxies `/api` requests to the backend at `http://127.0.0.1:8000`.

### 3. Environment Variables

#### Frontend (`.env`)

Copy the example file and configure your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|:---|:---|:---|
| `VITE_API_URL` | Backend API base URL (no trailing slash) | `http://127.0.0.1:8000` |
| `VITE_WS_URL` | WebSocket URL (auto-derived if blank) | — |
| `VITE_OLA_API_KEY` | Ola Maps API key ([get one here](https://maps.olakrutrim.com/)) | — |

#### Backend (`RoadRakshak/backend/.env`)

| Variable | Description | Default |
|:---|:---|:---|
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./roadguard.db` |
| `SECRET_KEY` | JWT signing secret | — |
| `TWILIO_SID` | Twilio Account SID (optional) | — |
| `TWILIO_TOKEN` | Twilio Auth Token (optional) | — |
| `TWILIO_FROM` | Twilio sender number (optional) | — |
| `EMERGENCY_TO` | Emergency alert recipient number | — |
| `ADMIN_EMAIL` | Default admin email | — |
| `ADMIN_PASSWORD` | Default admin password | — |

> **Note:** Twilio is optional. If not configured, the system will skip SMS/WhatsApp alerts and continue functioning normally.

### Available NPM Scripts

| Script | Command | Description |
|:---|:---|:---|
| `dev` | `npm run dev` | Start development server with hot reload |
| `build` | `npm run build` | Build for production (outputs to `dist/`) |
| `preview` | `npm run preview` | Preview production build locally |
| `lint` | `npm run lint` | Run ESLint on `.js` and `.jsx` files |

---

## 📡 API Reference

### REST Endpoints

#### Authentication

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `POST` | `/auth/login` | Login with email/password (OAuth2PasswordRequestForm), returns JWT | ❌ |
| `POST` | `/auth/register` | Register new user | ❌ |
| `GET` | `/auth/me` | Get current user info | ✅ JWT |

#### Dashboard & Monitoring

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/stats` | Aggregate dashboard KPIs | ✅ |
| `GET` | `/recent-violations` | Latest violations with incident join | ✅ |
| `GET` | `/recent-accidents` | Latest accidents with location filter | ✅ |

#### Map & Geolocation

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/map/accidents` | Geo-located accident data for map markers | ✅ |
| `GET` | `/map/hospitals` | Hospitals ranked by proximity + capability | ✅ |
| `POST` | `/map/route` | Best hospital selection + OSRM/fallback route | ✅ |

#### Analytics

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/analytics/violations` | Time-series violations grouped by date | ✅ |
| `GET` | `/analytics/accidents` | Time-series accidents grouped by date | ✅ |
| `GET` | `/analytics/heatmap` | Location-based accident hotspots | ✅ |

#### Reports

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/report/{id}` | Generate & serve PDF incident report | ✅ |

#### Hospital Portal

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `POST` | `/hospital/login` | Hospital code-based authentication | ❌ |
| `POST` | `/hospital/dispatch-ola` | Auto-register Ola hospital + create alert + WS broadcast | ✅ |
| `GET` | `/hospital/{id}/alerts` | Recent alerts for specific hospital | ✅ |
| `PATCH` | `/hospital/alerts/{id}/status` | Update alert lifecycle status + WS broadcast | ✅ |
| `GET` | `/hospital/alerts/{id}/snapshot` | Serve accident reference image | ✅ |
| `PATCH` | `/hospitals/{id}` | Update bed count / active status | ✅ |

#### System

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/` | Health check | ❌ |

### WebSocket Endpoints

| Endpoint | Description | Data Flow |
|:---|:---|:---|
| `/ws` | **Primary detection pipeline** — receives base64 frames + geolocation from frontend webcam, runs multi-agent AI system, returns annotated frames + detection results + emergency routing | Bidirectional |
| `/ws/hospital/{id}` | **Hospital live alerts** — sends `init` (hospital info + recent alerts), `new_alert` (accident push), `alert_update`, `beds_updated` | Server → Client |

#### WebSocket `/ws` Pipeline Detail

```
1. Frontend captures webcam frame (react-webcam)
2. Sends base64 frame + lat/lon to /ws
3. Backend decodes frame, applies frame-skipping (every 4th frame)
4. Runs AgentCoordinator.process_frame() → multi-agent pipeline
5. Creates Incident + Violation DB records (only for new events)
6. On accident detection:
   a. build_emergency_bundle() → selects best hospital
   b. Creates HospitalAlert record
   c. Broadcasts to hospital WebSocket
   d. Dispatches Twilio alert (if configured)
7. Returns annotated frame + detection JSON to frontend
```

---

## 🗄️ Data Models

### User

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `email` | String (unique) | Login identifier |
| `hashed_password` | String | Hashed password (pbkdf2_sha256) |
| `is_admin` | Boolean | Grants admin access |

### Incident

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `timestamp` | DateTime | UTC time of detection |
| `location` | String | Location description |
| `severity` | String | Low, Medium, High, or Critical |
| `vehicles` | Integer | Number of vehicles involved |
| `accident` | Boolean | True if a collision was confirmed |
| `annotated_frame` | LargeBinary | Annotated JPEG frame (BLOB) |
| `snapshot_path` | String | Path to evidence JPEG on disk |

### Violation

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `incident_id` | Integer | FK → Incident |
| `violation_type` | String | Type (wrong-way, overspeed, jaywalking, etc.) |
| `description` | String | Human-readable description |

### Hospital

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `name` | String | Hospital name |
| `latitude` / `longitude` | Float | GPS coordinates |
| `phone` | String | Contact number |
| `address` | String | Physical address |
| `beds_available` | Integer | Current ER capacity |
| `capacity_total` | Integer | Total bed capacity |
| `response_capability` | Integer | Triage readiness score (0–100) |
| `is_active` | Boolean | Whether hospital is currently active |
| `hospital_code` | String | Unique login code (e.g., `HOSP-AIIMS`) |

### Hospital Alert

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `incident_id` | Integer | FK → Incident |
| `hospital_id` | Integer | FK → Hospital |
| `status` | String | Pending → Accepted → Arrived → Loaded → Completed / Rejected |
| `severity` | String | Alert severity level |
| `location` | String | Accident location |
| `vehicles` | Integer | Vehicles involved |
| `distance_km` | Float | Driving distance to hospital |
| `eta_minutes` | Integer | Estimated ambulance arrival time |
| `snapshot_path` | String | Path to accident snapshot |
| `created_at` / `updated_at` | DateTime | Timestamps |

### Emergency Dispatch

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `incident_id` | Integer | FK → Incident |
| `hospital_id` | Integer | FK → Hospital |
| `distance_km` | Float | Driving distance via OSRM |
| `eta_minutes` | Integer | Estimated ambulance arrival time |
| `route_json` | Text | Full polyline coordinates for map display |
| `route_source` | String | `osrm` or `fallback` (straight-line Haversine) |

---

## 💻 Frontend Pages & Components

### Pages

| Page | Route | Description |
|:---|:---|:---|
| **Login** | `/login` | Admin JWT authentication with animated gradient background |
| **Dashboard** | `/dashboard` (default) | Military/tactical dark UI — KPI cards, violation table, accident list, auto-refresh every 5s |
| **Live Feed** | `/live-feed` | Core detection page — webcam capture via `react-webcam`, sends frames over WebSocket, displays annotated results with bounding boxes. On accident: queries Ola Maps for hospitals, dispatches emergency, deep-links to Map |
| **Map View** | `/map` | Leaflet map — red markers (accidents), blue markers (DB hospitals), green markers (Ola hospitals), blue polylines (routes). Supports deep-linking with `?accidentLat=&accidentLon=&olaHospitals=`. Auto-refreshes every 8s |
| **Analytics** | `/analytics` | Recharts — bar charts (violations/time), line charts (accidents/time), pie charts (hotspots). 7/30/90-day filters. Falls back to mock data offline |
| **Advanced Features** | `/advanced` | 6-tab showcase: Overview, PDF Reports, Severity Scoring, Role Access, Multi-Camera, Risk Heatmap |

### 🏥 Hospital Portal

| Page | Route | Description |
|:---|:---|:---|
| **Hospital Login** | `/hospital-login` | Code-based auth (e.g., `HOSP-AIIMS`). Demo codes: AIIMS, APOLLO, FORTIS, MAX |
| **Hospital Dashboard** | `/hospital-dashboard` | Real-time emergency dashboard — WebSocket alerts with siren audio, alert lifecycle management (Pending → Completed), bed management, accident snapshots |

### Key Components

| Component | Description |
|:---|:---|
| `ProtectedRoute` | Auth guard — checks `localStorage.access_token`, redirects to `/login` |
| `MultiCameraManager` | 6-camera grid/list view with online/offline/alert status indicators |
| `RoleManager` | RBAC permission matrix for Admin/Supervisor/Operator roles |
| `RiskZoneHeatmap` | Leaflet heatmap overlay — green → yellow → red incident density gradient |
| `SeverityBadge` | Calculates severity score (0–10) from vehicles + pedestrians + speed; renders color-coded badge |

### Services

| Service | Description |
|:---|:---|
| `api.js` | Axios instance with JWT interceptor. Exports: `authAPI`, `dashboardAPI`, `analyticsAPI`, `mapAPI`, `hospitalAPI`, `wsConnect()` |
| `websocket.js` | `WebSocketManager` class with exponential backoff auto-reconnect (max 5 retries) |

---

## 🌐 External Service Dependencies

| Service | Purpose | Auth Required | Fallback |
|:---|:---|:---|:---|
| [Ola Maps API](https://maps.olakrutrim.com/) | Nearby hospital search | API key (`VITE_OLA_API_KEY`) | Manual hospital DB |
| [OSRM](http://project-osrm.org/) | Driving route calculation | None (public API) | Straight-line Haversine with midpoint |
| [Twilio](https://www.twilio.com/) | WhatsApp/SMS emergency alerts | SID + Token (optional) | Alerts skip silently |
| [OpenStreetMap](https://www.openstreetmap.org/) | Leaflet map tiles | None | — |
| [YOLOv8n](https://docs.ultralytics.com/) | Object detection weights | None (auto-downloaded) | — |

---

## ⚙️ Configuration

### Vite (`vite.config.js`)

- **Dev Server Port:** `5173`
- **API Proxy:** `/api/*` → `http://127.0.0.1:8000`
- **WebSocket:** Frontend connects directly to `127.0.0.1:8000/ws` (bypasses Vite proxy to avoid 1006 errors)
- **React Fast Refresh** enabled for instant HMR

### Tailwind CSS (`tailwind.config.js`)

Custom brand color palette and design system:

| Token | Usage |
|:---|:---|
| `brand-dark` | Dark theme backgrounds |
| `brand-accent` | Accent/highlight color |
| `brand-success` | Positive states, hospital availability |
| `brand-*` | Full brand color system |

Custom utilities:
- `glass-card` — Glassmorphism card effect
- `glow` animation — Attention-grabbing glow pulse
- `scan-line` animation — Tactical/military UI scan effect
- `pulse-alert` — Alert animation keyframes

### Seeded Hospital Data

On backend startup, **8 Delhi NCR hospitals** are auto-seeded:

| Hospital | Code | Beds |
|:---|:---|:---|
| AIIMS Trauma Centre | `HOSP-AIIMS` | — |
| Safdarjung Hospital | — | — |
| LNJP Hospital | — | — |
| RML Hospital | — | — |
| Apollo Hospital | `HOSP-APOLLO` | — |
| Max Hospital | `HOSP-MAX` | — |
| Fortis Hospital | `HOSP-FORTIS` | — |
| + 1 more | — | — |

Each hospital includes real GPS coordinates, phone numbers, and bed capacities.

---

## 🏗️ Key Architectural Patterns

| Pattern | Description |
|:---|:---|
| **Multi-Agent AI** | 5 specialized agents orchestrated by a coordinator, each responsible for one domain |
| **Dual Auth System** | JWT for admin portal, simple code-based auth for hospital dashboard |
| **Frame Skipping** | Both coordinator-level (agent-level) and `main.py` (every 4th frame) for FPS optimization |
| **Direct WebSocket** | Frontend connects directly to backend WS (not through Vite proxy) to avoid connection issues |
| **Ola Maps Auto-Registration** | Hospitals discovered via Ola Maps API are auto-registered in DB with generated login codes |
| **Mock Data Fallback** | Analytics and Advanced Features pages work with mock data when backend is offline |
| **Legacy Fallback** | `process_frame.py` routes to multi-agent system, falls back to monolithic `detection.py` |
| **Evidence Pipeline** | Every confirmed incident saves annotated JPEG snapshots for audit trail and PDF reports |

---

## 🤝 Contributing

We welcome contributions to RoadRakshak! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code structure and naming conventions
- Write meaningful commit messages
- Test your changes with both backend and frontend running
- Update documentation for any new features or API changes
- Run `npm run lint` before submitting PRs

---

## 🛡️ License

This project is developed for **road safety and traffic management research**. All rights reserved.

---

<div align="center">

**Built with ❤️ for safer roads**

🚦 *RoadRakshak — Protecting Every Journey* 🚦

</div>
]]>
