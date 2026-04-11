import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM")
EMERGENCY_TO = os.getenv("EMERGENCY_TO")


def dispatch_alert(
    incident: dict,
    hospital_meta: Optional[Dict[str, Any]] = None,
    route_meta: Optional[Dict[str, Any]] = None,
):
    if not all([TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, EMERGENCY_TO]):
        print("Twilio is not configured. Alert skipped.")
        if hospital_meta:
            print(
                f"[Alert] Selected hospital: {hospital_meta.get('name')} "
                f"~{hospital_meta.get('distance_km')} km ETA {hospital_meta.get('eta_minutes')} min"
            )
        return

    client = Client(TWILIO_SID, TWILIO_TOKEN)
    body = (
        f"ACCIDENT detected - severity {incident.get('severity', 'unknown')}"
        f" at {incident.get('timestamp', 'unknown')}"
    )
    if incident.get("location"):
        body += f" | Location: {incident['location']}"
    if hospital_meta:
        body += (
            f" | ER: {hospital_meta.get('name', '?')} "
            f"~{float(hospital_meta.get('distance_km', 0)):.1f} km"
        )
        if hospital_meta.get("phone"):
            body += f" | {hospital_meta['phone']}"
        if hospital_meta.get("eta_minutes") is not None:
            body += f" | ETA ~{hospital_meta['eta_minutes']} min"
    if route_meta and route_meta.get("route_source"):
        body += f" | Route: {route_meta['route_source']}"

    client.messages.create(
        body=body,
        from_=TWILIO_FROM,
        to=EMERGENCY_TO,
    )
    print("Alert dispatched to emergency contact.")
