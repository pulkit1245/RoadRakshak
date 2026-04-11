import os
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session, joinedload

from .database import SessionLocal
from .models import Incident


REPORTS_DIR = Path(__file__).resolve().parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def generate_report(incident_id: int) -> str:
    db: Session = SessionLocal()
    incident = db.query(Incident).options(joinedload(Incident.violations)).filter(Incident.id == incident_id).first()
    if not incident:
        db.close()
        raise FileNotFoundError(f"Incident {incident_id} not found")
    # Force-load relationship data before closing the session
    incident.violations = list(incident.violations)
    db.close()

    target_path = REPORTS_DIR / f"incident_{incident.id}.pdf"
    c = canvas.Canvas(str(target_path), pagesize=letter)
    width, height = letter
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 60, f"RoadGuard Incident Report #{incident.id}")
    c.setFont("Helvetica", 11)
    c.drawString(40, height - 90, f"Timestamp: {incident.timestamp}")
    c.drawString(40, height - 110, f"Location: {incident.location}")
    c.drawString(40, height - 130, f"Severity: {incident.severity}")
    c.drawString(40, height - 150, f"Vehicle count: {incident.vehicles}")
    c.drawString(40, height - 170, f"Accident: {'Yes' if incident.accident else 'No'}")

    c.drawString(40, height - 200, "Violations:")
    y = height - 220
    if incident.violations:
        for violation in incident.violations:
            c.drawString(50, y, f"- {violation.violation_type}: {violation.description or 'no description'}")
            y -= 16
            if y < 80:
                c.showPage()
                y = height - 40
    else:
        c.drawString(50, y, "None detected")
        y -= 20

    image_y = y - 20
    if incident.snapshot_path and os.path.exists(incident.snapshot_path):
        try:
            image = ImageReader(incident.snapshot_path)
            c.drawImage(image, 40, image_y - 220, width=520, height=220, preserveAspectRatio=True, mask='auto')
        except Exception:
            c.drawString(40, image_y, "Snapshot image exists but could not be rendered.")
    elif incident.annotated_frame:
        try:
            image = ImageReader(BytesIO(incident.annotated_frame))
            c.drawImage(image, 40, image_y - 220, width=520, height=220, preserveAspectRatio=True, mask='auto')
        except Exception:
            c.drawString(40, image_y, "Annotated frame is available but could not be rendered.")
    else:
        c.drawString(40, image_y, "No snapshot image available.")

    c.showPage()
    c.save()
    return str(target_path)
