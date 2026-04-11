import asyncio
import base64
import logging
import math
import os
import uuid
from pathlib import Path

logger = logging.getLogger("roadrakshak.ws")
logger.setLevel(logging.INFO)

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from .auth import create_admin_user, get_current_user, router as auth_router
from .database import SessionLocal, engine
from .models import Base, Hospital, HospitalAlert, Incident, User, Violation
from .alert import dispatch_alert
from .hospital_service import (
    build_emergency_bundle,
    build_route_response,
    hospitals_near_point,
    seed_hospitals_if_empty,
    select_best_hospital,
)
from .pdf_report import generate_report
from .process_frame import process_frame

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RoadGuard AI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)

SNAPSHOT_DIR = Path(__file__).resolve().parent / "snapshots"
SNAPSHOT_DIR.mkdir(exist_ok=True)
LIVE_DETECT_EVERY_N_FRAMES = 4
DEFAULT_CITY_CENTER = (28.7041, 77.1025)  # Delhi — also used when /map/hospitals has no lat/lon

# ── Hospital WebSocket connection manager ─────────────────────────
# hospital_connections[hospital_id] = set of active WebSocket objects
hospital_connections: dict[int, set] = {}


class RouteRequest(BaseModel):
    accident_lat: float
    accident_lon: float


class HospitalUpdate(BaseModel):
    beds_available: Optional[int] = None
    is_active: Optional[bool] = None


class HospitalAlertStatusUpdate(BaseModel):
    status: str  # accepted | rejected | arrived | completed


class HospitalLoginRequest(BaseModel):
    hospital_code: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _incident_coords(incident: Incident):
    # If location is "lat,lon", parse it.
    location = (incident.location or "").strip()
    if "," in location:
        parts = location.split(",", 1)
        try:
            lat = float(parts[0].strip())
            lon = float(parts[1].strip())
            return lat, lon
        except Exception:
            pass
    return None, None


def _iso_utc(dt):
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        create_admin_user(db)
        seed_hospitals_if_empty(db)
    finally:
        db.close()


@app.get("/")
def health_check():
    return {"status": "RoadGuard AI backend is running"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client = websocket.client
    chost = getattr(client, "host", None)
    cport = getattr(client, "port", None)
    print(f"[WS] connection attempt host={chost} port={cport}", flush=True)
    logger.info("WebSocket /ws connection attempt host=%s port=%s", chost, cport)
    await websocket.accept()
    print("[WS] accepted", flush=True)
    logger.info("WebSocket /ws accepted")
    db = SessionLocal()
    frame_index = 0
    last_live_payload = None
    last_lat = None
    last_lon = None
    try:
        while True:
            payload = await websocket.receive_json()
            frame_index += 1
            if frame_index == 1:
                fk = list(payload.keys())
                flen = (
                    len((payload.get("frame") or ""))
                    if isinstance(payload.get("frame"), str)
                    else "n/a"
                )
                print(f"[WS] first frame keys={fk} frame_field_len={flen}", flush=True)
                logger.info("WebSocket first frame keys=%s frame_len=%s", fk, flen)
            frame_base64 = payload.get("frame")
            latitude = payload.get("latitude")
            longitude = payload.get("longitude")

            normalized_location = payload.get("location", "unknown")
            if latitude is not None and longitude is not None:
                try:
                    last_lat = float(latitude)
                    last_lon = float(longitude)
                    normalized_location = f"{last_lat},{last_lon}"
                except Exception:
                    normalized_location = payload.get("location", "unknown")
            elif last_lat is not None and last_lon is not None:
                normalized_location = f"{last_lat},{last_lon}"
            if not frame_base64:
                await websocket.send_json({"error": "frame payload required"})
                continue

            if isinstance(frame_base64, str) and frame_base64.startswith("data:"):
                parts = frame_base64.split(",", 1)
                if len(parts) != 2:
                    await websocket.send_json({"error": "invalid data URL payload"})
                    continue
                frame_base64 = parts[1]

            try:
                frame_bytes = base64.b64decode(frame_base64)
            except Exception:
                await websocket.send_json({"error": "invalid base64 payload"})
                continue

            # Fast path for live feed: reuse latest detection on intermediate frames.
            if frame_index % LIVE_DETECT_EVERY_N_FRAMES != 0 and last_live_payload is not None:
                await websocket.send_json(last_live_payload)
                continue

            try:
                result = process_frame(frame_bytes)
            except Exception as exc:
                await websocket.send_json({"error": f"frame processing failed: {str(exc)}"})
                continue
            annotated_frame = result.get("annotated_frame") or frame_bytes
            if isinstance(annotated_frame, str):
                annotated_frame = annotated_frame.encode("utf-8")

            incident = Incident(
                location=normalized_location,
                severity=result.get("severity", "low"),
                vehicles=int(result.get("vehicles", 0)),
                accident=bool(result.get("accident", False)),
                annotated_frame=annotated_frame,
                snapshot_path=None,
            )

            violations = result.get("violations") or []
            for violation_data in violations:
                violation = Violation(
                    violation_type=violation_data.get("type", "unknown"),
                    description=violation_data.get("description", ""),
                )
                incident.violations.append(violation)

            # Avoid DB writes for every live frame; persist only meaningful events.
            if incident.accident or violations:
                snapshot_path = result.get("snapshot_path")
                if not snapshot_path:
                    snapshot_path = str(SNAPSHOT_DIR / f"{uuid.uuid4().hex}.png")
                    try:
                        with open(snapshot_path, "wb") as f:
                            f.write(annotated_frame)
                    except Exception:
                        snapshot_path = None
                incident.snapshot_path = snapshot_path
                db.add(incident)
                db.commit()
                db.refresh(incident)
                incident_id = incident.id
                incident_snapshot_path = incident.snapshot_path
                incident_annotated = incident.annotated_frame
            else:
                incident_id = None
                incident_snapshot_path = None
                incident_annotated = annotated_frame

            incident_payload = {
                "id": incident_id,
                "vehicles": incident.vehicles,
                "violations": [
                    {"type": v.violation_type, "description": v.description}
                    for v in incident.violations
                ],
                "accident": incident.accident,
                "severity": incident.severity,
                "location": normalized_location,
                "snapshot_path": incident_snapshot_path,
                "annotated_frame": base64.b64encode(incident_annotated).decode("utf-8") if incident_annotated else None,
            }

            if incident.accident:
                if last_lat is not None and last_lon is not None:
                    try:
                        em = build_emergency_bundle(db, last_lat, last_lon, incident_id)
                        incident_payload["emergency"] = em
                        sel = em.get("selected_hospital")

                        # Create a HospitalAlert record and push live to that hospital's WS
                        if sel and incident_id:
                            try:
                                hosp_id = sel.get("id")
                                if hosp_id:
                                    ha = HospitalAlert(
                                        incident_id=incident_id,
                                        hospital_id=hosp_id,
                                        status="pending",
                                        severity=incident.severity,
                                        location=normalized_location,
                                        vehicles=incident.vehicles,
                                        distance_km=sel.get("distance_km"),
                                        eta_minutes=sel.get("eta_minutes"),
                                    )
                                    db.add(ha)
                                    db.commit()
                                    db.refresh(ha)
                                    # Broadcast alert to all connected hospital dashboard WS clients
                                    alert_msg = {
                                        "type": "new_alert",
                                        "alert": {
                                            "id": ha.id,
                                            "incident_id": incident_id,
                                            "status": ha.status,
                                            "severity": ha.severity,
                                            "location": ha.location,
                                            "vehicles": ha.vehicles,
                                            "distance_km": ha.distance_km,
                                            "eta_minutes": ha.eta_minutes,
                                            "created_at": ha.created_at.isoformat() + "Z",
                                            "hospital_name": sel.get("name"),
                                        },
                                    }
                                    sockets = hospital_connections.get(hosp_id, set())
                                    dead = set()
                                    for ws_conn in list(sockets):
                                        try:
                                            await ws_conn.send_json(alert_msg)
                                        except Exception:
                                            dead.add(ws_conn)
                                    sockets -= dead
                            except Exception as ha_exc:
                                logger.warning("HospitalAlert creation failed: %s", ha_exc)

                        dispatch_alert(
                            {
                                "id": incident_id,
                                "timestamp": str(incident.timestamp) if incident_id else "",
                                "severity": incident.severity,
                                "location": incident.location,
                            },
                            hospital_meta=sel,
                            route_meta=em.get("route"),
                        )
                    except Exception as em_exc:
                        logger.exception("Emergency routing failed: %s", em_exc)
                        incident_payload["emergency"] = {"error": str(em_exc)}
                        dispatch_alert(
                            {
                                "id": incident_id,
                                "timestamp": str(incident.timestamp) if incident_id else "",
                                "severity": incident.severity,
                                "location": incident.location,
                            }
                        )
                else:
                    incident_payload["emergency"] = {
                        "message": "Accident detected but latitude/longitude unknown — enable location for hospital routing.",
                    }
                    dispatch_alert(
                        {
                            "id": incident_id,
                            "timestamp": str(incident.timestamp) if incident_id else "",
                            "severity": incident.severity,
                            "location": incident.location,
                        }
                    )

            last_live_payload = incident_payload

            await websocket.send_json(incident_payload)
    except WebSocketDisconnect as disc:
        print(f"[WS] client disconnected: {disc!r}", flush=True)
        logger.info("WebSocket /ws client disconnected: %s", disc)
        return
    except Exception as exc:
        print(f"[WS] runtime error: {exc!r}", flush=True)
        logger.exception("WebSocket /ws runtime error: %s", exc)
        return
    finally:
        print("[WS] closing DB session", flush=True)
        logger.info("WebSocket /ws closing DB session")
        db.close()


@app.get("/report/{incident_id}")
def get_report(incident_id: int):
    try:
        report_path = generate_report(incident_id)
        return FileResponse(report_path, media_type="application/pdf", filename=os.path.basename(report_path))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Incident not found")


@app.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "is_admin": current_user.is_admin}


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_incidents = db.query(func.count(Incident.id)).scalar() or 0
    total_violations = db.query(func.count(Violation.id)).scalar() or 0
    total_accidents = db.query(func.count(Incident.id)).filter(Incident.accident.is_(True)).scalar() or 0

    return {
        "frames_processed": int(total_incidents),
        "total_violations": int(total_violations),
        "total_accidents": int(total_accidents),
        "ambulances_dispatched": 0,
    }


@app.get("/recent-violations")
def get_recent_violations(limit: int = 10, db: Session = Depends(get_db)):
    rows = (
        db.query(Violation, Incident)
        .join(Incident, Violation.incident_id == Incident.id)
        .order_by(Incident.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": violation.id,
            "timestamp": _iso_utc(incident.timestamp),
            "type": violation.violation_type,
            "location": incident.location,
            "severity": incident.severity,
            "description": violation.description,
        }
        for violation, incident in rows
    ]


@app.get("/recent-accidents")
def get_recent_accidents(limit: int = 10, db: Session = Depends(get_db)):
    rows = (
        db.query(Incident)
        .filter(Incident.accident.is_(True))
        .order_by(Incident.timestamp.desc())
        .limit(limit * 5)
        .all()
    )

    results = []
    for incident in rows:
        location = (incident.location or "").strip()
        if not location or location.lower() == "unknown":
            continue
        results.append(
            {
                "id": incident.id,
                "timestamp": _iso_utc(incident.timestamp),
                "location": location,
                "severity": incident.severity,
                "type": "Collision",
                "ambulance_dispatched": False,
            }
        )
        if len(results) >= limit:
            break
    return results


@app.get("/analytics/violations")
def analytics_violations(days: int = 30, db: Session = Depends(get_db)):
    rows = (
        db.query(func.date(Incident.timestamp).label("date"), func.count(Violation.id).label("violations_count"))
        .join(Incident, Violation.incident_id == Incident.id)
        .group_by(func.date(Incident.timestamp))
        .order_by(func.date(Incident.timestamp).desc())
        .limit(max(1, days))
        .all()
    )
    return [{"date": str(r.date), "violations_count": int(r.violations_count)} for r in rows]


@app.get("/analytics/accidents")
def analytics_accidents(days: int = 30, db: Session = Depends(get_db)):
    rows = (
        db.query(func.date(Incident.timestamp).label("date"), func.count(Incident.id).label("accidents_count"))
        .filter(Incident.accident.is_(True))
        .group_by(func.date(Incident.timestamp))
        .order_by(func.date(Incident.timestamp).desc())
        .limit(max(1, days))
        .all()
    )
    return [{"date": str(r.date), "accidents_count": int(r.accidents_count)} for r in rows]


@app.get("/analytics/heatmap")
def analytics_heatmap(db: Session = Depends(get_db)):
    rows = (
        db.query(Incident.location, func.count(Incident.id).label("count"))
        .filter(Incident.accident.is_(True))
        .group_by(Incident.location)
        .order_by(func.count(Incident.id).desc())
        .limit(20)
        .all()
    )
    return [{"location": (r.location or "unknown"), "count": int(r.count)} for r in rows]


@app.get("/map/accidents")
def get_map_accidents(db: Session = Depends(get_db)):
    incidents = (
        db.query(Incident)
        .filter(Incident.accident.is_(True))
        .order_by(Incident.timestamp.desc())
        .limit(100)
        .all()
    )

    payload = []
    for incident in incidents:
        lat, lon = _incident_coords(incident)
        if lat is None or lon is None:
            continue
        description = "No additional description available."
        if incident.violations:
            description = incident.violations[0].description or incident.violations[0].violation_type

        payload.append(
            {
                "id": incident.id,
                "type": "Collision",
                "timestamp": _iso_utc(incident.timestamp),
                "severity": incident.severity,
                "ambulance_dispatched": False,
                "location": incident.location,
                "description": description,
                "latitude": lat,
                "longitude": lon,
            }
        )
    return payload


@app.get("/map/hospitals")
def get_map_hospitals(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = 50.0,
    db: Session = Depends(get_db),
):
    """Hospitals near a point (defaults to city center). Sorted by response ranking."""
    if lat is None or lon is None:
        lat, lon = DEFAULT_CITY_CENTER
    return hospitals_near_point(db, float(lat), float(lon), radius_km=radius_km, limit=24)


@app.patch("/hospitals/{hospital_id}")
def patch_hospital_availability(
    hospital_id: int,
    body: HospitalUpdate,
    db: Session = Depends(get_db),
):
    """Update bed count or active flag (e.g. hospital dashboard / admin)."""
    h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if body.beds_available is not None:
        h.beds_available = max(0, int(body.beds_available))
    if body.is_active is not None:
        h.is_active = bool(body.is_active)
    db.commit()
    db.refresh(h)
    return {
        "id": h.id,
        "name": h.name,
        "beds_available": h.beds_available,
        "is_active": h.is_active,
    }


@app.post("/map/route")
def get_map_route(req: RouteRequest, db: Session = Depends(get_db)):
    """Best hospital by distance + capacity + response score; route via OSRM when available."""
    best, ranked = select_best_hospital(db, req.accident_lat, req.accident_lon)
    if not best:
        raise HTTPException(status_code=404, detail="No hospital available in search radius")
    route = build_route_response(
        req.accident_lat,
        req.accident_lon,
        best["latitude"],
        best["longitude"],
    )
    return {
        "hospital_id": best["id"],
        "hospital_name": best["name"],
        "distance_km": route["distance_km"],
        "eta_minutes": route["eta_minutes"],
        "route_coords": route["route_coords"],
        "rank_score": best.get("rank_score"),
        "nearby_hospitals": ranked,
        "route_source": route.get("route_source"),
    }


# ══════════════════════════════════════════════════════════════════
# HOSPITAL AUTH — simple code-based login (no JWT needed)
# ══════════════════════════════════════════════════════════════════

@app.post("/hospital/login")
def hospital_login(req: HospitalLoginRequest, db: Session = Depends(get_db)):
    """Validate a hospital_code and return the hospital record."""
    h = db.query(Hospital).filter(Hospital.hospital_code == req.hospital_code, Hospital.is_active == True).first()
    if not h:
        raise HTTPException(status_code=401, detail="Invalid hospital code")
    return {
        "id": h.id,
        "name": h.name,
        "address": h.address or "",
        "beds_available": h.beds_available,
        "capacity_total": h.capacity_total,
        "hospital_code": h.hospital_code,
    }


# ══════════════════════════════════════════════════════════════════
# HOSPITAL ALERTS ENDPOINTS
# ══════════════════════════════════════════════════════════════════

class OlaDispatchRequest(BaseModel):
    """Sent by frontend after Ola Maps search to register + dispatch to the nearest Ola hospital."""
    incident_id: Optional[int] = None
    severity: str = "high"
    location: str = "unknown"
    vehicles: int = 0
    hospital_name: str
    hospital_address: Optional[str] = ""
    hospital_lat: Optional[float] = None
    hospital_lon: Optional[float] = None
    accident_lat: Optional[float] = None
    accident_lon: Optional[float] = None


@app.post("/hospital/dispatch-ola")
async def dispatch_ola_hospital(req: OlaDispatchRequest, db: Session = Depends(get_db)):
    """
    Auto-register an Ola Maps hospital (if new), create a HospitalAlert,
    and broadcast live to the hospital portal via WebSocket.
    Returns the hospital record including its login code.
    """
    import random, string

    # Try to find an existing hospital with the same name (exact match)
    existing = db.query(Hospital).filter(
        Hospital.name == req.hospital_name,
        Hospital.is_active == True,
    ).first()

    if existing:
        hosp = existing
        # Ensure it has a hospital_code
        if not hosp.hospital_code:
            code = "HOSP-OLA-" + ''.join(random.choices(string.digits, k=4))
            hosp.hospital_code = code
            db.commit()
            db.refresh(hosp)
    else:
        # Auto-register this Ola hospital
        code = "HOSP-OLA-" + ''.join(random.choices(string.digits, k=4))
        hosp = Hospital(
            name=req.hospital_name,
            latitude=float(req.hospital_lat) if req.hospital_lat else 0.0,
            longitude=float(req.hospital_lon) if req.hospital_lon else 0.0,
            address=req.hospital_address or "",
            beds_available=10,
            capacity_total=50,
            response_capability=70,
            hospital_code=code,
            is_active=True,
        )
        db.add(hosp)
        db.commit()
        db.refresh(hosp)
        logger.info("Auto-registered Ola hospital: %s (code=%s)", hosp.name, hosp.hospital_code)

    # Calculate distance if we have coordinates
    dist_km = None
    eta_min = None
    if req.accident_lat and req.accident_lon and hosp.latitude and hosp.longitude:
        dist_km = round(_distance_km(req.accident_lat, req.accident_lon, hosp.latitude, hosp.longitude), 2)
        eta_min = max(2, int(round((dist_km / 25.0) * 60)))

    # Create the HospitalAlert
    ha = HospitalAlert(
        incident_id=req.incident_id or 0,
        hospital_id=hosp.id,
        status="pending",
        severity=req.severity,
        location=req.location,
        vehicles=req.vehicles,
        distance_km=dist_km,
        eta_minutes=eta_min,
    )
    db.add(ha)
    db.commit()
    db.refresh(ha)

    # Broadcast to connected hospital WS clients
    alert_msg = {
        "type": "new_alert",
        "alert": {
            "id": ha.id,
            "incident_id": ha.incident_id,
            "status": ha.status,
            "severity": ha.severity,
            "location": ha.location,
            "vehicles": ha.vehicles,
            "distance_km": ha.distance_km,
            "eta_minutes": ha.eta_minutes,
            "created_at": ha.created_at.isoformat() + "Z",
            "hospital_name": hosp.name,
        },
    }
    sockets = hospital_connections.get(hosp.id, set())
    dead = set()
    for ws_conn in list(sockets):
        try:
            await ws_conn.send_json(alert_msg)
        except Exception:
            dead.add(ws_conn)
    sockets -= dead

    return {
        "hospital_id": hosp.id,
        "hospital_name": hosp.name,
        "hospital_code": hosp.hospital_code,
        "hospital_address": hosp.address,
        "alert_id": ha.id,
        "distance_km": dist_km,
        "eta_minutes": eta_min,
    }



@app.get("/hospital/{hospital_id}/alerts")
def get_hospital_alerts(hospital_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Return recent alerts for a specific hospital."""
    db.query(Hospital).filter(Hospital.id == hospital_id).first() or \
        (_ for _ in ()).throw(HTTPException(status_code=404, detail="Hospital not found"))
    alerts = (
        db.query(HospitalAlert)
        .filter(HospitalAlert.hospital_id == hospital_id)
        .order_by(HospitalAlert.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "incident_id": a.incident_id,
            "status": a.status,
            "severity": a.severity,
            "location": a.location,
            "vehicles": a.vehicles,
            "distance_km": a.distance_km,
            "eta_minutes": a.eta_minutes,
            "created_at": a.created_at.isoformat() + "Z",
            "updated_at": a.updated_at.isoformat() + "Z",
        }
        for a in alerts
    ]


@app.patch("/hospital/alerts/{alert_id}/status")
async def update_alert_status(alert_id: int, body: HospitalAlertStatusUpdate, db: Session = Depends(get_db)):
    """Hospital dashboard updates mission status (accepted/rejected/arrived/completed)."""
    valid = {"accepted", "rejected", "arrived_scene", "patient_loaded", "completed"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid}")
    alert = db.query(HospitalAlert).filter(HospitalAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = body.status
    db.commit()
    db.refresh(alert)

    # Broadcast status update to all connected clients of that hospital
    update_msg = {
        "type": "alert_update",
        "alert_id": alert.id,
        "status": alert.status,
        "updated_at": alert.updated_at.isoformat() + "Z",
    }
    sockets = hospital_connections.get(alert.hospital_id, set())
    dead = set()
    for ws_conn in list(sockets):
        try:
            await ws_conn.send_json(update_msg)
        except Exception:
            dead.add(ws_conn)
    sockets -= dead

    return {"id": alert.id, "status": alert.status}


# ══════════════════════════════════════════════════════════════════
# HOSPITAL WEBSOCKET — live alert push to hospital dashboard
# ══════════════════════════════════════════════════════════════════

@app.websocket("/ws/hospital/{hospital_id}")
async def hospital_ws(hospital_id: int, websocket: WebSocket, db: Session = Depends(get_db)):
    """Hospital dashboard connects here to receive real-time accident alerts."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active == True).first()
    if not hospital:
        await websocket.close(code=4004)
        return
    await websocket.accept()
    if hospital_id not in hospital_connections:
        hospital_connections[hospital_id] = set()
    hospital_connections[hospital_id].add(websocket)
    logger.info("Hospital WS connected: hospital_id=%s", hospital_id)
    try:
        # Send initial state: last 5 alerts
        recent = (
            db.query(HospitalAlert)
            .filter(HospitalAlert.hospital_id == hospital_id)
            .order_by(HospitalAlert.created_at.desc())
            .limit(5)
            .all()
        )
        await websocket.send_json({
            "type": "init",
            "hospital": {"id": hospital.id, "name": hospital.name, "beds_available": hospital.beds_available},
            "alerts": [
                {
                    "id": a.id,
                    "incident_id": a.incident_id,
                    "status": a.status,
                    "severity": a.severity,
                    "location": a.location,
                    "vehicles": a.vehicles,
                    "distance_km": a.distance_km,
                    "eta_minutes": a.eta_minutes,
                    "created_at": a.created_at.isoformat() + "Z",
                }
                for a in recent
            ],
        })
        # Keep connection alive; hospital sends pings or we simply wait
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                # Handle bed count updates from dashboard
                if msg.get("type") == "update_beds":
                    beds = int(msg.get("beds", hospital.beds_available))
                    hospital.beds_available = max(0, beds)
                    db.commit()
                    db.refresh(hospital)
                    await websocket.send_json({"type": "beds_updated", "beds_available": hospital.beds_available})
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        hospital_connections.get(hospital_id, set()).discard(websocket)
        logger.info("Hospital WS disconnected: hospital_id=%s", hospital_id)

