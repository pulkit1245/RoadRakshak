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
- [Configuration](#-configuration)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Key Features

### 🧠 Intelligent Incident Detection (Multi-Agent AI)

Using a coordinated multi-agent architecture powered by **YOLOv8** and **ByteTrack**, RoadRakshak detects and responds to a wide range of traffic incidents:

| Category | Capability | How It Works |
|:---|:---|:---|
| 🚗 **Vehicle Collisions** | Real-time accident detection | Multi-parameter confidence scoring (IoU overlap, sudden stops, deformation, scene chaos) |
| 🚫 **Wrong-Way Driving** | Directional violation detection | Trajectory analysis against dominant traffic flow; flags deviations >120° |
| ⚡ **Overspeeding** | Speed violation monitoring | Pixel-velocity estimation calibrated to lane width (threshold: 22 px/frame) |
| 🚶 **Pedestrian Safety** | Jaywalking & crowd density | Restricted zone monitoring and crowd density analysis |
| 🔥 **Environmental Hazards** | Fire & smoke detection | HSV color-space masks with hue-based filtering |
| 🌙 **Night Vision** | Low-light enhancement | Automatic CLAHE preprocessing when brightness drops below threshold |

### 🚑 Emergency Response & Hospital Integration

- **Smart Hospital Ranking** — Weighted algorithm (`0.42 × distance + 0.33 × beds + 0.25 × response`) ranks the best-suited hospital for each incident.
- **Dynamic Routing** — Real-time driving routes from accident sites to hospitals via **OSRM** (Open Source Routing Machine), with straight-line fallback.
- **Automated Dispatch** — Instant emergency bundles sent to responders with precise coordinates and ETA.
- **Ola Maps Integration** — Discovers nearby hospitals using the **Ola Maps API**.

### 📊 Analytics & Reporting

- **Live Dashboard** — Real-time annotated video feed with interactive incident overlays and KPI cards.
- **Automated Alerts** — Instant notifications via **Twilio** (SMS/WhatsApp) for critical incidents with rate-limiting to prevent alert flooding.
- **PDF Incident Reports** — One-click generation of comprehensive, evidence-backed reports (powered by **jsPDF** + **html2canvas** on frontend, **ReportLab** on backend).
- **Risk Heatmaps** — Geographic visualization of accident-prone zones using `leaflet.heat`.
- **Rich Analytics** — Line charts, bar charts, area charts, and pie charts for violations, severity trends, and incident timelines (powered by **Recharts**).

### 🔐 Role-Based Access Control

- **JWT Authentication** — Secure token-based auth with `passlib[bcrypt]` password hashing.
- **Admin Panel** — User management with admin/operator role assignment.
- **Protected Routes** — Frontend route guards with `adminOnly` support.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐            │
│  │ Dashboard │  │ Live Feed│  │ Map View│  │ Analytics│            │
│  └────┬─────┘  └────┬─────┘  └────┬────┘  └────┬─────┘            │
│       │              │             │             │                   │
│       └──────────────┴─────────────┴─────────────┘                  │
│                          │ HTTP (Axios)  │ WebSocket                │
└──────────────────────────┼──────────────┼───────────────────────────┘
                           │              │
┌──────────────────────────┼──────────────┼───────────────────────────┐
│                     FastAPI Server      │                           │
│  ┌─────────────┐  ┌─────────────┐  ┌───┴──────────┐               │
│  │  REST API   │  │   Auth      │  │  WebSocket   │               │
│  │  Endpoints  │  │  (JWT)      │  │  Streams     │               │
│  └──────┬──────┘  └─────────────┘  └──────┬───────┘               │
│         │                                  │                        │
│  ┌──────┴──────────────────────────────────┴───────┐               │
│  │            Agent Coordinator                     │               │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │               │
│  │  │ Vehicle  │ │  Scene   │ │   Collision       │ │               │
│  │  │ Agent    │ │  Agent   │ │   Agent           │ │               │
│  │  │ (YOLOv8) │ │ (OpenCV) │ │ (Fusion Logic)   │ │               │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │               │
│  │  ┌──────────────────┐  ┌──────────────────────┐ │               │
│  │  │ Wrong-Way /      │  │     Alert            │ │               │
│  │  │ Overspeed Agent  │  │     Agent (Twilio)   │ │               │
│  │  └──────────────────┘  └──────────────────────┘ │               │
│  └─────────────────────────────────────────────────┘               │
│         │                                                           │
│  ┌──────┴──────┐  ┌─────────────┐  ┌──────────────┐               │
│  │  SQLite DB  │  │  OSRM API   │  │ Ola Maps API │               │
│  │  (SQLAlchemy)│  │  (Routing)  │  │ (Hospitals)  │               │
│  └─────────────┘  └─────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 The Multi-Agent AI Pipeline

RoadRakshak uses a modular **AgentCoordinator** that orchestrates five specialized AI agents. Each frame from the video feed is processed through this pipeline:

### Agent 1 → Vehicle Detection (`vehicle_agent.py`)

| Aspect | Detail |
|:---|:---|
| **Model** | YOLOv8 Nano for real-time inference |
| **Tracking** | ByteTrack for persistent object ID assignment |
| **Preprocessing** | CLAHE auto-applied when avg. brightness drops (night vision) |
| **Confidence Thresholds** | Cars: 0.42, Trucks: 0.40, Motorcycles: 0.35 |
| **Motion Analysis** | Per-track speed, sudden stop flags, bounding-box deformation |

### Agent 2 → Scene Analysis (`scene_agent.py`)

Operates independently of object detection to provide environmental context:

- **Optical Flow Chaos** — Detects violent motion patterns via `calcOpticalFlowFarneback`
- **Pixel Delta** — Measures frame-to-frame change for large-scale movement
- **Edge Density** — Scans road ROI for shattered glass or debris (high edge frequency)
- **Background Subtraction** — MOG2 for identifying stationary foreign objects
- **Hazard Detection** — HSV hue-based masks for **Fire** (orange/red) and **Smoke** (gray/low-saturation)

### Agent 3 → Collision Reasoning (`collision_agent.py`)

The logic engine that **fuses data** from Agent 1 and Agent 2:

```
Confidence Score Breakdown:
  +0.40  Direct IoU overlap between vehicle tracks
  +0.20  Sudden stop detected
  +0.18  Fire detected in scene
  +0.15  Nearby pedestrians (potential victims)
  +0.07  Optical flow chaos level
```

- **Pairwise IoU** — Checks overlaps between all detected vehicle tracks
- **Spatial Deduplication** — Prevents duplicate alerts via spatio-temporal history

### Agent 4 → Wrong-Way & Overspeeding (`wrongway_agent.py`)

- **Direction Vectors** — Unit vector of movement over last 10–40 frames
- **Dominant Flow** — Dynamically calculates "normal" traffic direction
- **Wrong-Way** — Vehicles deviating >120° from dominant flow
- **Overspeeding** — Pixel-velocity exceeding 22 px/frame (calibrated to lane width)

### Agent 5 → Alert Dispatch (`alert_agent.py`)

- **Evidence Gathering** — Saves annotated JPEG snapshots to `snapshots/`
- **External Integration** — Twilio API for WhatsApp/SMS dispatch
- **Payload Construction** — Formats JSON bundles for WebSocket streaming
- **Rate Limiting** — Prevents alert flooding for repeated detections

---

## 🛠️ Tech Stack

### Backend (Python / FastAPI)

| Technology | Purpose |
|:---|:---|
| [FastAPI](https://fastapi.tiangolo.com/) | High-performance async API & WebSocket framework |
| [YOLOv8 (Ultralytics)](https://docs.ultralytics.com/) | State-of-the-art object detection |
| [OpenCV](https://opencv.org/) | Real-time image processing & frame annotation |
| [ByteTrack](https://github.com/ifzhang/ByteTrack) | Multi-object tracking with persistent IDs |
| [SQLAlchemy](https://www.sqlalchemy.org/) | ORM for incident, hospital & user management |
| [Twilio](https://www.twilio.com/) | Real-time SMS/WhatsApp alert dispatching |
| [ReportLab](https://www.reportlab.com/) | Automated PDF report generation |
| [OSRM](http://project-osrm.org/) | Open-source routing engine for emergency navigation |
| [python-jose](https://github.com/mpdavis/python-jose) | JWT token creation & verification |
| [passlib](https://passlib.readthedocs.io/) | Bcrypt password hashing |

### Frontend (React / Vite)

| Technology | Purpose |
|:---|:---|
| [React 18](https://react.dev/) | Component-based UI library |
| [Vite 5](https://vitejs.dev/) | Lightning-fast build tool with HMR |
| [Tailwind CSS 3.4](https://tailwindcss.com/) | Utility-first CSS framework |
| [React Router v6](https://reactrouter.com/) | Client-side routing |
| [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) | Interactive map visualizations |
| [Recharts](https://recharts.org/) | Dynamic data visualization & charts |
| [React-Webcam](https://github.com/mozmorris/react-webcam) | Client-side camera integration |
| [Axios](https://axios-http.com/) | HTTP client for API communication |
| [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) | Client-side PDF report generation |

---

## 📂 Project Structure

```
RoadRakshak-2/
│
├── RoadRakshak/                    # 🐍 Backend (Python/FastAPI)
│   ├── agents/                     #    Multi-agent AI pipeline
│   │   ├── agent_coordinator.py    #    Orchestrates all 5 agents
│   │   ├── vehicle_agent.py        #    YOLOv8 + ByteTrack detection
│   │   ├── scene_agent.py          #    Environmental analysis (fire, smoke, chaos)
│   │   ├── collision_agent.py      #    Collision reasoning & confidence scoring
│   │   ├── wrongway_agent.py       #    Wrong-way & overspeeding detection
│   │   └── alert_agent.py          #    Alert dispatch (Twilio + snapshots)
│   │
│   ├── backend/                    #    FastAPI core application
│   │   ├── main.py                 #    App entry, routes, WebSockets, CORS
│   │   ├── auth.py                 #    JWT authentication & password hashing
│   │   ├── database.py             #    SQLAlchemy + SQLite setup
│   │   ├── models.py               #    ORM models (User, Incident, Hospital, Dispatch)
│   │   ├── schemas.py              #    Pydantic v2 request/response schemas
│   │   ├── hospital_service.py     #    Hospital ranking, OSRM routing, Ola Maps
│   │   ├── pdf_report.py           #    ReportLab PDF generation
│   │   └── requirements.txt        #    Python dependencies
│   │
│   ├── snapshots/                  #    Evidence images (populated at runtime)
│   └── yolov8n.pt                  #    Pre-trained YOLOv8 Nano weights
│
├── src/                            # ⚛️ Frontend (React)
│   ├── main.jsx                    #    React entry point
│   ├── App.jsx                     #    Root component with routing
│   ├── App.css                     #    Component-specific styles
│   ├── index.css                   #    Global styles + Tailwind directives
│   │
│   ├── pages/                      #    Application views
│   │   ├── Login.jsx               #    Authentication page
│   │   ├── Dashboard.jsx           #    Main dashboard with KPIs & charts
│   │   ├── LiveFeed.jsx            #    Real-time annotated video stream
│   │   ├── MapView.jsx             #    Geographic incident visualization
│   │   └── AnalyticsPage.jsx       #    Data analytics with multiple chart types
│   │
│   ├── components/                 #    Reusable UI components
│   │   ├── AlertBanner.jsx         #    Severity-coded incident alerts
│   │   ├── CameraFeed.jsx          #    Single camera WebSocket stream
│   │   ├── DashboardLayout.jsx     #    Main layout (sidebar + topbar)
│   │   ├── EmergencyPanel.jsx      #    Hospital dispatch info panel
│   │   ├── HospitalCard.jsx        #    Hospital info display card
│   │   ├── IncidentTimeline.jsx    #    Chronological incident list
│   │   ├── MultiCameraManager.jsx  #    Multi-camera grid manager
│   │   ├── ProtectedRoute.jsx      #    Auth guard (supports adminOnly)
│   │   ├── RiskZoneHeatmap.jsx     #    Leaflet heat map overlay
│   │   ├── RoleManager.jsx         #    Admin user management panel
│   │   ├── Sidebar.jsx             #    Navigation sidebar
│   │   ├── StatsCard.jsx           #    KPI metric card with trends
│   │   └── ViolationLog.jsx        #    Real-time violations feed
│   │
│   ├── services/                   #    API integration layer
│   │   ├── api.js                  #    Axios instance + all API functions
│   │   └── websocket.js            #    WebSocket manager with auto-reconnect
│   │
│   ├── context/                    #    React Context providers
│   │   └── AuthContext.jsx         #    Authentication state management
│   │
│   ├── hooks/                      #    Custom React hooks
│   │   └── useWebSocket.js         #    WebSocket hook with auto-cleanup
│   │
│   └── utils/                      #    Helper utilities
│       ├── formatters.js           #    Data formatting functions
│       └── pdfGenerator.js         #    Client-side PDF report generation
│
├── public/                         #    Static assets
├── dist/                           #    Production build output
│
├── .env.example                    #    Environment variable template
├── package.json                    #    Frontend dependencies & scripts
├── vite.config.js                  #    Vite configuration (proxy, port)
├── tailwind.config.js              #    Tailwind theme customization
├── postcss.config.js               #    PostCSS plugin configuration
├── setup.sh                        #    Automated setup script
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

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`. You can view the interactive API docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
# From the project root directory
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. The Vite dev server automatically proxies API requests to the backend.

### 3. Environment Variables

Copy the example file and configure your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|:---|:---|:---|
| `VITE_API_URL` | Backend API base URL (no trailing slash) | `http://127.0.0.1:8000` |
| `VITE_WS_URL` | WebSocket URL (auto-derived if blank) | — |
| `VITE_OLA_API_KEY` | Ola Maps API key ([get one here](https://maps.olakrutrim.com/)) | — |

> **Note:** The backend also requires its own `.env` for Twilio credentials and database configuration. Refer to `RoadRakshak/backend/` for details.

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
| `POST` | `/api/auth/login` | Login with email/password, returns JWT | ❌ |

#### Dashboard & Monitoring

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/api/stats` | Dashboard KPIs (frames, violations, accidents, ambulances) | ✅ |
| `GET` | `/api/violations` | List of all detected violations | ✅ |
| `GET` | `/api/incidents` | Filtered incident list (supports query params) | ✅ |

#### Map & Geolocation

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/api/map/accidents` | Accident locations with coordinates | ✅ |
| `GET` | `/api/map/hospitals` | Hospital locations with coordinates | ✅ |
| `GET` | `/api/hospitals/nearby` | Ranked nearby hospitals (query: `lat`, `lng`) | ✅ |

#### Analytics & Reports

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/api/analytics/{type}` | Analytics data (violations, severity, timeline) | ✅ |
| `GET` | `/api/reports/{incident_id}` | Download PDF incident report | ✅ |

#### Admin

| Method | Endpoint | Description | Auth |
|:---|:---|:---|:---|
| `GET` | `/api/admin/users` | List all system users | ✅ Admin |
| `PUT` | `/api/admin/users/{user_id}` | Update user role | ✅ Admin |

### WebSocket Endpoints

| Endpoint | Description | Data Format |
|:---|:---|:---|
| `/ws/detection` | Real-time annotated frames + detection results from AgentCoordinator | Base64 JPEG + JSON metadata |
| `/ws/camera/{camera_id}` | Individual camera stream | Base64 MJPEG frames |

---

## 🗄️ Data Models

### User

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `email` | String (unique) | Login identifier |
| `hashed_password` | String | Bcrypt-hashed password |
| `is_admin` | Boolean | Grants admin panel access |
| `created_at` | DateTime | Account creation timestamp |

### Incident

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `timestamp` | DateTime | UTC time of detection |
| `type` | String | Incident type (collision, wrong-way, overspeed, etc.) |
| `severity` | String | Low, Medium, High, or Critical |
| `latitude` / `longitude` | Float | GPS coordinates of the incident |
| `accident` | Boolean | True if a collision was confirmed |
| `snapshot_path` | String | Path to evidence JPEG |
| `resolved` | Boolean | Whether the incident has been resolved |
| `camera_id` | String | Source camera identifier |

### Hospital

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `name` | String | Hospital name |
| `latitude` / `longitude` | Float | GPS coordinates |
| `beds_available` | Integer | Current ER capacity |
| `response_capability` | Integer | Triage readiness score (0–100) |
| `hospital_code` | String | Unique identifier |
| `phone` | String | Contact number |
| `address` | String | Physical address |

### Emergency Dispatch

| Field | Type | Description |
|:---|:---|:---|
| `id` | Integer | Primary Key |
| `incident_id` | Integer | FK → Incident |
| `hospital_id` | Integer | FK → Hospital |
| `distance_km` | Float | Driving distance via OSRM |
| `eta_minutes` | Integer | Estimated ambulance arrival time |
| `route_json` | Text | Full polyline coordinates for map display |
| `dispatched_at` | DateTime | Dispatch timestamp |
| `status` | String | Dispatch status |

---

## 💻 Frontend Pages & Components

### Pages

| Page | Route | Description |
|:---|:---|:---|
| **Login** | `/` | Email/password authentication with animated gradient background |
| **Dashboard** | `/dashboard` | KPI cards (frames, violations, accidents, ambulances), recent alerts, live camera preview, violation breakdown pie chart |
| **Live Feed** | `/live-feed` | Real-time WebSocket video with detection overlays, incident alert panel, camera selector |
| **Map View** | `/map` | Leaflet map with accident markers (red), hospital markers (green), ambulance route polylines (blue); click accident → show nearest hospitals + route |
| **Analytics** | `/analytics` | Line chart (incidents over time), bar chart (violations by type), area chart (severity distribution), pie chart (incident categories); date range filter |
| **Hospitals** | `/hospitals` | Hospital dashboard with HospitalCards showing availability |
| **Role Manager** | `/role-manager` | Admin-only user management panel |

### Key Components

| Component | Description |
|:---|:---|
| `AlertBanner` | Color-coded incident alerts with auto-dismiss (8s), audio beep on critical |
| `CameraFeed` | Single camera WebSocket stream with connection status badge |
| `DashboardLayout` | Main layout with responsive sidebar + topbar |
| `EmergencyPanel` | Collapsible hospital dispatch info (ranking, ETA, distance) |
| `MultiCameraManager` | 2×2 grid of camera feeds with add/remove support |
| `RiskZoneHeatmap` | Leaflet heatmap overlay (green → yellow → red gradient) |
| `ViolationLog` | Auto-scrolling real-time violations feed with severity badges |
| `StatsCard` | KPI card with icon, value, label, and trend indicator |
| `ProtectedRoute` | Auth guard with `adminOnly` prop support |

---

## ⚙️ Configuration

### Vite (`vite.config.js`)

- **Dev Server Port:** `5173`
- **API Proxy:** `/api/*` → `http://localhost:8000`
- **WebSocket Proxy:** `/ws/*` → `ws://localhost:8000`
- **React Fast Refresh** enabled for instant HMR

### Tailwind CSS (`tailwind.config.js`)

Custom color palette designed for traffic management:

| Token | Usage |
|:---|:---|
| `primary` | Blue shades for primary UI elements |
| `danger` | Red for critical alerts and accidents |
| `success` | Green for positive states and hospitals |
| `warning` | Yellow for caution states |
| `accident` | Orange for accident-specific highlighting |
| `sidebar` | Dark gray for navigation sidebar |

Custom animation: `pulse-slow` for attention-grabbing UI elements.

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

---

## 🛡️ License

This project is developed for **road safety and traffic management research**. All rights reserved.

---

<div align="center">

**Built with ❤️ for safer roads**

🚦 *RoadRakshak — Protecting Every Journey* 🚦

</div>
]]>
