# RoadRakshak

RoadRakshak is a FastAPI backend for a computer vision incident detection project. It receives base64 frames over WebSocket, stores incident data in SQLite, generates PDF reports, and dispatches alerts via Twilio.

## Project structure

- `backend/main.py` — FastAPI app and WebSocket endpoint
- `backend/auth.py` — JWT login/register with a default admin user
- `backend/models.py` — SQLAlchemy models for `User`, `Incident`, and `Violation`
- `backend/process_frame.py` — stub `process_frame()` for Person 1 to replace later
- `backend/alert.py` — Twilio alert dispatch
- `backend/pdf_report.py` — PDF generation using ReportLab
- `docker-compose.yml` — backend service definition

## Setup

1. Copy the example env file:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

2. Install dependencies for local development:

```bash
cd backend
pip install -r requirements.txt
```

3. Run the app locally:

```bash
uvicorn backend.main:app --reload
```

## Testing the pipeline

1. Start the backend.
2. Open browser console or a WebSocket client.
3. Connect to `ws://localhost:8000/ws`.
4. Send JSON:

```json
{ "frame": "<base64-image-data>", "location": "test intersection" }
```

5. Confirm the response includes `vehicles`, `violations`, `accident`, `severity`, and `annotated_frame`.

## Integration handoff with Person 1

- Person 1 should replace `backend/process_frame.py` with the real computer vision function.
- The contract is:
  - returns `vehicles: int`
  - returns `violations: list[dict]`
  - returns `accident: bool`
  - returns `severity: "low"|"medium"|"high"`
  - returns `annotated_frame: bytes`
  - returns `snapshot_path: str|None`

## Generate a report

Call:

```http
GET /report/{incident_id}
```

This returns a PDF built from incident details and the saved snapshot image.
