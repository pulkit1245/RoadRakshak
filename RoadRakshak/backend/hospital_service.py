"""
Hospital registry, ranking, routing (OSRM with fallback), and emergency bundle for live accidents.
"""
from __future__ import annotations

import json
import logging
import math
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from .models import EmergencyDispatch, Hospital

logger = logging.getLogger("roadrakshak.hospital")

# Pre-registration radius (km) around city center at first seed — hospitals outside are still stored but tagged
DEFAULT_SEED_CENTER = (28.7041, 77.1025)
PRE_REGISTER_RADIUS_KM = 45.0

# When ranking for an accident, only consider hospitals within this radius (km)
ACCIDENT_SEARCH_RADIUS_KM = 40.0

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"

# Expanded Delhi NCR seed — pre-registered at startup if DB empty
SEED_HOSPITALS: List[Dict[str, Any]] = [
    {
        "name": "AIIMS Trauma Center",
        "latitude": 28.5672,
        "longitude": 77.2100,
        "phone": "+91-11-26588500",
        "address": "Sri Aurobindo Marg, Ansari Nagar, New Delhi",
        "beds_available": 18,
        "capacity_total": 220,
        "response_capability": 94,
        "hospital_code": "HOSP-AIIMS",
    },
    {
        "name": "Safdarjung Hospital",
        "latitude": 28.5680,
        "longitude": 77.1967,
        "phone": "+91-11-26730000",
        "address": "Ansari Nagar West, New Delhi",
        "beds_available": 11,
        "capacity_total": 1531,
        "response_capability": 88,
        "hospital_code": "HOSP-SAFDAR",
    },
    {
        "name": "LNJP Hospital",
        "latitude": 28.6435,
        "longitude": 77.2390,
        "phone": "+91-11-23232400",
        "address": "Jawaharlal Nehru Marg, New Delhi",
        "beds_available": 9,
        "capacity_total": 2000,
        "response_capability": 85,
        "hospital_code": "HOSP-LNJP",
    },
    {
        "name": "RML Hospital",
        "latitude": 28.6243,
        "longitude": 77.2105,
        "phone": "+91-11-23404300",
        "address": "Baba Kharak Singh Marg, Connaught Place",
        "beds_available": 7,
        "capacity_total": 926,
        "response_capability": 90,
        "hospital_code": "HOSP-RML",
    },
    {
        "name": "Ram Manohar Lohia Hospital",
        "latitude": 28.6289,
        "longitude": 77.2065,
        "phone": "+91-11-23404300",
        "address": "Baba Kharak Singh Marg Area",
        "beds_available": 14,
        "capacity_total": 984,
        "response_capability": 87,
        "hospital_code": "HOSP-RMLH",
    },
    {
        "name": "Apollo Hospital Delhi",
        "latitude": 28.6023,
        "longitude": 77.1861,
        "phone": "+91-11-26925858",
        "address": "Sarita Vihar, Mathura Road",
        "beds_available": 22,
        "capacity_total": 700,
        "response_capability": 96,
        "hospital_code": "HOSP-APOLLO",
    },
    {
        "name": "Max Super Specialty Saket",
        "latitude": 28.5244,
        "longitude": 77.2165,
        "phone": "+91-11-26515050",
        "address": "Press Enclave Road, Saket",
        "beds_available": 16,
        "capacity_total": 500,
        "response_capability": 95,
        "hospital_code": "HOSP-MAX",
    },
    {
        "name": "Fortis Escorts Heart Institute",
        "latitude": 28.5607,
        "longitude": 77.2739,
        "phone": "+91-11-47135000",
        "address": "Okhla Road, Sukhdev Vihar",
        "beds_available": 12,
        "capacity_total": 310,
        "response_capability": 93,
        "hospital_code": "HOSP-FORTIS",
    },
]


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def rank_score(d_km: float, beds: int, capacity: int, response: int) -> float:
    """Higher is better: balances proximity, bed availability, and ER capability."""
    cap = max(int(capacity or 1), 1)
    bed_ratio = min(1.0, max(0.0, float(beds) / float(cap)))
    dist_factor = max(0.0, 1.0 - min(d_km / max(ACCIDENT_SEARCH_RADIUS_KM, 1.0), 1.0))
    resp = min(100, max(0, int(response or 50))) / 100.0
    return round(0.42 * dist_factor + 0.33 * bed_ratio + 0.25 * resp, 4)


def seed_hospitals_if_empty(db: Session) -> int:
    """Insert seed hospitals once (startup / first use). Returns rows inserted."""
    n = db.query(Hospital).count()
    if n > 0:
        # Backfill hospital_code for existing rows that don't have one
        for row in SEED_HOSPITALS:
            h = db.query(Hospital).filter(Hospital.name == row["name"]).first()
            if h and not h.hospital_code:
                h.hospital_code = row["hospital_code"]
        db.commit()
        return 0
    clat, clon = DEFAULT_SEED_CENTER
    inserted = 0
    for row in SEED_HOSPITALS:
        d = distance_km(clat, clon, row["latitude"], row["longitude"])
        if d > PRE_REGISTER_RADIUS_KM:
            continue
        h = Hospital(
            name=row["name"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            phone=row.get("phone"),
            address=row.get("address"),
            beds_available=int(row.get("beds_available", 0)),
            capacity_total=int(row.get("capacity_total", 100)),
            response_capability=int(row.get("response_capability", 80)),
            hospital_code=row.get("hospital_code"),
            is_active=True,
        )
        db.add(h)
        inserted += 1
    db.commit()
    logger.info("Seeded %s hospitals within %.0f km of city center", inserted, PRE_REGISTER_RADIUS_KM)
    return inserted


def hospitals_near_point(
    db: Session,
    lat: float,
    lon: float,
    radius_km: float = ACCIDENT_SEARCH_RADIUS_KM,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    """Active hospitals within radius, sorted by rank_score descending."""
    rows = db.query(Hospital).filter(Hospital.is_active.is_(True)).all()
    ranked: List[Tuple[float, Hospital]] = []
    for h in rows:
        d = distance_km(lat, lon, float(h.latitude), float(h.longitude))
        if d > radius_km:
            continue
        sc = rank_score(d, h.beds_available or 0, h.capacity_total or 1, h.response_capability or 50)
        ranked.append((sc, h))
    ranked.sort(key=lambda x: -x[0])
    out: List[Dict[str, Any]] = []
    for sc, h in ranked[:limit]:
        d = distance_km(lat, lon, float(h.latitude), float(h.longitude))
        out.append(
            {
                "id": h.id,
                "name": h.name,
                "latitude": float(h.latitude),
                "longitude": float(h.longitude),
                "phone": h.phone,
                "address": h.address,
                "beds_available": h.beds_available,
                "capacity_total": h.capacity_total,
                "response_capability": h.response_capability,
                "distance_km": round(d, 3),
                "rank_score": sc,
            }
        )
    return out


def fallback_route_coords(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> List[List[float]]:
    mid_lat = (lat1 + lat2) / 2.0
    mid_lon = (lon1 + lon2) / 2.0
    return [[lat1, lon1], [mid_lat, mid_lon], [lat2, lon2]]


def fetch_driving_route_osrm(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> Optional[Tuple[List[List[float]], float]]:
    """
    Returns (coords [[lat,lon],...], distance_m) or None on failure.
    OSRM uses lon,lat order in URL.
    """
    url = f"{OSRM_BASE}/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RoadRakshak/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        logger.warning("OSRM route failed: %s", e)
        return None
    try:
        routes = data.get("routes") or []
        if not routes:
            return None
        geom = routes[0].get("geometry") or {}
        coords = geom.get("coordinates") or []
        dist_m = float(routes[0].get("distance") or 0)
        # GeoJSON is [lon, lat] → Leaflet wants [lat, lon]
        path = [[float(c[1]), float(c[0])] for c in coords]
        if len(path) < 2:
            return None
        return path, dist_m
    except (KeyError, IndexError, TypeError, ValueError) as e:
        logger.warning("OSRM parse error: %s", e)
        return None


def build_route_response(
    accident_lat: float,
    accident_lon: float,
    hospital_lat: float,
    hospital_lon: float,
) -> Dict[str, Any]:
    osrm = fetch_driving_route_osrm(accident_lat, accident_lon, hospital_lat, hospital_lon)
    if osrm:
        path, dist_m = osrm
        dist_km = dist_m / 1000.0
        eta_minutes = max(2, int(round((dist_km / 28.0) * 60)))
        return {
            "route_coords": path,
            "distance_km": round(dist_km, 3),
            "eta_minutes": eta_minutes,
            "route_source": "osrm",
        }
    dist_km = distance_km(accident_lat, accident_lon, hospital_lat, hospital_lon)
    eta_minutes = max(2, int(round((dist_km / 25.0) * 60)))
    return {
        "route_coords": fallback_route_coords(accident_lat, accident_lon, hospital_lat, hospital_lon),
        "distance_km": round(dist_km, 3),
        "eta_minutes": eta_minutes,
        "route_source": "straight_line",
    }


def select_best_hospital(
    db: Session, lat: float, lon: float
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    ranked = hospitals_near_point(db, lat, lon, ACCIDENT_SEARCH_RADIUS_KM, limit=8)
    if not ranked:
        return None, []
    return ranked[0], ranked


def build_emergency_bundle(
    db: Session,
    accident_lat: float,
    accident_lon: float,
    incident_id: Optional[int],
) -> Dict[str, Any]:
    best, ranked = select_best_hospital(db, accident_lat, accident_lon)
    if not best:
        return {
            "accident_lat": accident_lat,
            "accident_lon": accident_lon,
            "nearby_hospitals": [],
            "selected_hospital": None,
            "route": None,
            "message": "No hospitals in database within search radius — run server startup seed.",
        }

    route = build_route_response(
        accident_lat,
        accident_lon,
        best["latitude"],
        best["longitude"],
    )
    selected = {
        **best,
        "distance_km": route["distance_km"],
        "eta_minutes": route["eta_minutes"],
        "notified": True,
    }

    if incident_id is not None:
        try:
            ed = EmergencyDispatch(
                incident_id=incident_id,
                hospital_id=best["id"],
                distance_km=route["distance_km"],
                eta_minutes=route["eta_minutes"],
                route_json=json.dumps(route.get("route_coords") or []),
                route_source=route.get("route_source", ""),
                created_at=datetime.utcnow(),
            )
            db.add(ed)
            db.commit()
        except Exception as e:
            logger.warning("Could not persist EmergencyDispatch: %s", e)
            db.rollback()

    return {
        "accident_lat": accident_lat,
        "accident_lon": accident_lon,
        "nearby_hospitals": ranked,
        "selected_hospital": selected,
        "route": route,
    }
