from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, LargeBinary, Text, Float
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    incidents = relationship("Incident", back_populates="owner")

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    location = Column(String(256), default="unknown", nullable=False)
    severity = Column(String(16), nullable=False)
    vehicles = Column(Integer, nullable=False, default=0)
    accident = Column(Boolean, default=False, nullable=False)
    annotated_frame = Column(LargeBinary, nullable=True)
    snapshot_path = Column(String(512), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    violations = relationship("Violation", back_populates="incident", cascade="all, delete-orphan")
    owner = relationship("User", back_populates="incidents")

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    violation_type = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    incident = relationship("Incident", back_populates="violations")


class Hospital(Base):
    """Pre-registered ER / trauma centers (seeded at startup if empty)."""

    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String(64), nullable=True)
    address = Column(String(512), nullable=True)
    beds_available = Column(Integer, default=0, nullable=False)
    capacity_total = Column(Integer, default=100, nullable=False)
    response_capability = Column(Integer, default=80, nullable=False)  # 0–100 triage / ER readiness score
    is_active = Column(Boolean, default=True, nullable=False)
    hospital_code = Column(String(64), nullable=True, unique=True)  # login code for hospital dashboard
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class HospitalAlert(Base):
    """Per-hospital alert record created whenever an accident is routed to that hospital."""

    __tablename__ = "hospital_alerts"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    status = Column(String(32), default="pending", nullable=False)  # pending|accepted|rejected|arrived|completed
    severity = Column(String(16), nullable=False)
    location = Column(String(256), nullable=False)
    vehicles = Column(Integer, default=0, nullable=False)
    distance_km = Column(Float, nullable=True)
    eta_minutes = Column(Integer, nullable=True)
    snapshot_path = Column(String(512), nullable=True)  # path to accident reference image
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    incident = relationship("Incident")
    hospital = relationship("Hospital")


class EmergencyDispatch(Base):
    """Record when an accident is linked to a selected hospital and route."""

    __tablename__ = "emergency_dispatches"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    eta_minutes = Column(Integer, nullable=False)
    route_json = Column(Text, nullable=True)
    route_source = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident")
    hospital = relationship("Hospital")
