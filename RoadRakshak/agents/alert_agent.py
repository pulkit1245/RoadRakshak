"""
agents/alert_agent.py — Agent 5: Alert Dispatch Agent
======================================================
Responsibility:
  • Receives confirmed collision events from coordinator
  • Deduplicates across the alert pipeline
  • Saves snapshot to disk
  • Logs incident to SQLite via server.py DB handle
  • Dispatches Twilio WhatsApp/SMS (if credentials present)
  • Returns final alert payload for WebSocket send

Why separate?
  Alert logic is entirely I/O-bound (disk write, HTTP call).
  Keeping it isolated means we can make it async or queue-based
  without touching any CV code.
"""

import os
import time
import sqlite3
import cv2
from datetime import datetime
from typing import List, Dict, Optional

# ── Config ────────────────────────────────────────────────────────────────────
SNAPSHOT_DIR     = "snapshots"
DB_PATH          = "roadguard.db"
ALERT_COOLDOWN   = 12   # seconds — minimum gap between Twilio calls
MIN_CONF_ALERT   = 0.45  # only send external alert above this confidence

os.makedirs(SNAPSHOT_DIR, exist_ok=True)

# Twilio (optional — only fires if env vars are set)
_twilio_client   = None
_twilio_from     = os.getenv("TWILIO_FROM",     "")
_emergency_to    = os.getenv("EMERGENCY_TO",    "")
_last_alert_time = 0.0


def _init_twilio():
    global _twilio_client
    sid   = os.getenv("TWILIO_SID",   "")
    token = os.getenv("TWILIO_TOKEN", "")
    if sid and token:
        try:
            from twilio.rest import Client
            _twilio_client = Client(sid, token)
            print("[AlertAgent] Twilio client initialised")
        except ImportError:
            print("[AlertAgent] Twilio not installed — SMS disabled")
    else:
        print("[AlertAgent] No Twilio credentials — SMS/WA disabled")

_init_twilio()


# ── Snapshot ──────────────────────────────────────────────────────────────────
def _save_snapshot(frame, event: dict) -> str:
    """Save annotated frame as JPEG. Returns file path."""
    ts     = int(time.time())
    sev    = event.get("severity", "UNK")
    fname  = os.path.join(SNAPSHOT_DIR, f"collision_{sev}_{ts}.jpg")
    cv2.imwrite(fname, frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(f"[AlertAgent] Snapshot → {fname}")
    return fname


# ── DB log ────────────────────────────────────────────────────────────────────
def _log_to_db(event: dict, snapshot_path: str):
    """
    Write incident to SQLite.
    Table is created if it doesn't exist (safe for first run).
    """
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp     TEXT,
                severity      TEXT,
                confidence    REAL,
                evidence      TEXT,
                victim_count  INTEGER,
                snapshot_path TEXT
            )
        """)
        cur.execute("""
            INSERT INTO incidents
            (timestamp, severity, confidence, evidence, victim_count, snapshot_path)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            event.get("severity",     "UNK"),
            event.get("confidence",   0.0),
            ", ".join(event.get("evidence", [])),
            event.get("victim_count", 0),
            snapshot_path,
        ))
        con.commit()
        con.close()
    except Exception as exc:
        print(f"[AlertAgent] DB log failed: {exc}")


# ── Twilio dispatch ───────────────────────────────────────────────────────────
def _send_twilio(event: dict):
    global _last_alert_time
    now = time.time()

    if now - _last_alert_time < ALERT_COOLDOWN:
        return   # cooldown — don't spam
    if event.get("confidence", 0) < MIN_CONF_ALERT:
        return
    if not (_twilio_client and _twilio_from and _emergency_to):
        return

    sev     = event.get("severity",     "UNK")
    conf    = int(event.get("confidence", 0) * 100)
    victims = event.get("victim_count", 0)
    ev_str  = ", ".join(event.get("evidence", []))

    body = (
        f"🚨 RoadGuard COLLISION ALERT\n"
        f"Severity : {sev}\n"
        f"Confidence: {conf}%\n"
        f"Victims nearby: {victims}\n"
        f"Signals: {ev_str}\n"
        f"Time: {datetime.now().strftime('%H:%M:%S')}"
    )

    try:
        _twilio_client.messages.create(
            from_=f"whatsapp:{_twilio_from}",
            to=f"whatsapp:{_emergency_to}",
            body=body,
        )
        print(f"[AlertAgent] WhatsApp sent → {_emergency_to}")
        _last_alert_time = now
    except Exception as exc:
        print(f"[AlertAgent] Twilio send failed: {exc}")


# ── Main run function ─────────────────────────────────────────────────────────
def run(collision_events: List[dict],
        violations:       List[dict],
        frame,
        save_snapshot:    bool = True) -> dict:
    """
    Main entry called by coordinator after every frame.

    Returns alert_payload dict for WebSocket send:
    {
      "collision":    bool,
      "collisions":   [ {confidence, severity, evidence, victims, new_alert} ],
      "violations":   [ {track_id, violation, speed_px, angle_deg} ],
      "alert_fired":  bool,
    }
    """
    alert_fired = False

    for event in collision_events:
        if event.get("new_alert"):
            # Save snapshot
            snapshot = _save_snapshot(frame, event) if save_snapshot else ""

            # Log to DB (DISABLED: Handled by SQLAlchemy backend in main.py)
            # _log_to_db(event, snapshot)

            # Send external alert
            _send_twilio(event)

            alert_fired = True

    # Build clean payload for WebSocket
    collision_payload = [
        {
            "confidence": e["confidence"],
            "severity":   e["severity"],
            "evidence":   e["evidence"],
            "victims":    e["victim_count"],
            "new_alert":  e["new_alert"],
        }
        for e in collision_events
    ]

    violation_payload = [
        {
            "track_id":  v["track_id"],
            "class":     v["class"],
            "violation": v["violation"],
            "speed_px":  v.get("speed_px",  0),
            "angle_deg": v.get("angle_deg", 0),
        }
        for v in violations
    ]

    return {
        "collision":   bool(collision_events),
        "collisions":  collision_payload,
        "violations":  violation_payload,
        "alert_fired": alert_fired,
    }
