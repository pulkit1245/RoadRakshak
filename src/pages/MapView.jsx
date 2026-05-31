import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { mapAPI } from '../services/api';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const accidentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const olaHospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accidents, setAccidents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [olaHospitals, setOlaHospitals] = useState([]);
  const [selectedAccident, setSelectedAccident] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState([28.7041, 77.1025]);

  const defaultCenter = [28.7041, 77.1025];

  const fetchMapData = async () => {
    let refLat = defaultCenter[0];
    let refLon = defaultCenter[1];
    try {
      if (navigator.geolocation) {
        const coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p.coords),
            () => resolve(null),
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 6000 }
          );
        });
        if (coords) {
          refLat = coords.latitude;
          refLon = coords.longitude;
        }
      }
    } catch (_) {}
    try {
      const [accidentsData, hospitalsData] = await Promise.all([
        mapAPI.getAccidents(),
        mapAPI.getHospitals(refLat, refLon, 50),
      ]);
      setAccidents(Array.isArray(accidentsData) ? accidentsData : []);
      setHospitals(Array.isArray(hospitalsData) ? hospitalsData : []);
      setMapCenter([refLat, refLon]);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const intervalId = setInterval(fetchMapData, 8000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const alat = searchParams.get('accidentLat');
    const alon = searchParams.get('accidentLon');
    if (alat == null || alon == null) return;
    const lat = parseFloat(alat);
    const lon = parseFloat(alon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    setMapCenter([lat, lon]);
    const synthetic = {
      id: 'live-focus',
      type: 'Live accident',
      timestamp: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      location: `${lat},${lon}`,
      severity: 'HIGH',
      description: 'Opened from Live Feed',
    };
    setSelectedAccident(synthetic);

    try {
      const raw = searchParams.get('olaHospitals');
      if (raw) setOlaHospitals(JSON.parse(decodeURIComponent(raw)));
    } catch (_) {}

    try {
      const raw = searchParams.get('olaHospitals');
      const parsed = raw ? JSON.parse(decodeURIComponent(raw)) : [];
      if (!parsed.length) {
        mapAPI
          .getRouteToNearestHospital(lat, lon)
          .then(setRoute)
          .catch((err) => console.error('Route from URL:', err));
      }
    } catch (_) {
      mapAPI
        .getRouteToNearestHospital(lat, lon)
        .then(setRoute)
        .catch((err) => console.error('Route from URL:', err));
    }
  }, [searchParams]);

  const handleAccidentClick = async (accident) => {
    setSelectedAccident(accident);
    try {
      if (accident.latitude != null && accident.longitude != null) {
        const routeData = await mapAPI.getRouteToNearestHospital(
          accident.latitude,
          accident.longitude
        );
        setRoute(routeData);
        setMapCenter([accident.latitude, accident.longitude]);
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      {/* Header */}
      <nav className="glass-panel sticky top-0 z-[500] border-0 border-b border-brand-border/40" style={{ borderRadius: 0 }}>
        <div className="max-w-full px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center border border-purple-500/20">
              <span className="text-xl">🗺️</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Spatial <span className="text-purple-400">Map</span></h1>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Real-time accident locations & hospital routes</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="nav-link-3d"
          >
            <span>←</span> Dashboard
          </button>
        </div>
      </nav>

      {/* Error */}
      {error && (
        <div className="max-w-full px-6 py-3">
          <div className="glass-panel p-3.5 glow-border-danger flex items-center gap-3">
            <span className="text-brand-danger">⚠️</span>
            <p className="text-brand-danger text-xs font-semibold">{error} — Make sure backend is running</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-72px)]">
        {/* Map */}
        <div className="flex-1 relative z-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-brand-dark">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 border-2 border-brand-accent/10 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-t-brand-accent rounded-full animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-500 text-xs font-medium uppercase tracking-wider">Loading map...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              />

              {/* Accident Markers */}
              {accidents.map((accident) => (
                <Marker
                  key={accident.id}
                  position={[accident.latitude || defaultCenter[0], accident.longitude || defaultCenter[1]]}
                  icon={accidentIcon}
                  eventHandlers={{
                    click: () => handleAccidentClick(accident),
                  }}
                >
                  <Popup>
                    <div className="w-56">
                      <p className="font-bold text-red-600">🚨 {accident.type || 'Accident'}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(accident.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        📍 {accident.location || 'Unknown location'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Coordinates: {Number(accident.latitude).toFixed(6)}, {Number(accident.longitude).toFixed(6)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Severity: <span className="font-semibold">{accident.severity || 'UNKNOWN'}</span>
                      </p>
                      <p className="text-xs text-gray-700 mt-2">
                        {accident.description || 'No description available.'}
                      </p>
                      {accident.ambulance_dispatched && (
                        <p className="text-xs text-green-600 mt-1">✅ Ambulance Dispatched</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Hospital Markers */}
              {hospitals.map((hospital) => (
                <Marker
                  key={hospital.id}
                  position={[hospital.latitude, hospital.longitude]}
                  icon={hospitalIcon}
                >
                  <Popup>
                    <div className="w-48">
                      <p className="font-bold text-blue-600">🏥 {hospital.name}</p>
                      <p className="text-sm text-gray-600">Distance: {hospital.distance_km?.toFixed(2)} km</p>
                      {hospital.phone && (
                        <p className="text-xs text-gray-500 mt-2">📞 {hospital.phone}</p>
                      )}
                      {hospital.beds_available !== undefined && (
                        <p className="text-xs text-gray-500">🛏️ Beds: {hospital.beds_available}</p>
                      )}
                      {hospital.rank_score != null && (
                        <p className="text-xs text-gray-500">Score: {hospital.rank_score}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Ola Maps Hospitals */}
              {olaHospitals.filter((h) => h.lat != null && h.lon != null).map((h) => (
                <Marker
                  key={`ola-${h.placeId}`}
                  position={[h.lat, h.lon]}
                  icon={olaHospitalIcon}
                >
                  <Popup>
                    <div className="w-52">
                      <p className="font-bold text-green-700">🏥 #{h.rank} {h.name}</p>
                      {h.address && <p className="text-xs text-gray-600 mt-1">{h.address}</p>}
                      <p className="text-xs text-green-600 mt-1 font-medium">Ola Maps — nearest to accident</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Route Line */}
              {route?.route_coords && route.route_coords.length > 0 && (
                <Polyline
                  positions={route.route_coords.map((coord) => [coord[0], coord[1]])}
                  color="#10b981"
                  weight={3}
                  opacity={0.8}
                />
              )}
            </MapContainer>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-brand-card border-l border-brand-border/40 overflow-y-auto custom-scrollbar">
          <div className="p-5">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <span className="w-2 h-2 bg-brand-accent rounded-full"></span>
              Incident Details
            </h3>

            {selectedAccident ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Selected Accident */}
                <div className="card-3d p-4 glow-border-danger" style={{ background: 'rgba(239,68,68,0.06)' }}>
                  <p className="font-bold text-sm text-brand-danger mb-2">🚨 {selectedAccident.type || 'Accident'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(selectedAccident.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    📍 {selectedAccident.location || 'Unknown location'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {Number(selectedAccident.latitude).toFixed(6)}, {Number(selectedAccident.longitude).toFixed(6)}
                  </p>
                  <p className="text-xs text-brand-danger mt-2 font-semibold">
                    Severity: {selectedAccident.severity}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {selectedAccident.description || 'No description available.'}
                  </p>
                </div>

                {/* Nearest Hospital */}
                {olaHospitals.length > 0 ? (
                  <div className="card-3d p-4 glow-border-success" style={{ background: 'rgba(16,185,129,0.06)' }}>
                    <p className="font-bold text-sm text-brand-success mb-2">🏥 Nearest Hospital (Ola Maps)</p>
                    <p className="text-xs font-semibold text-white mt-1">{olaHospitals[0].name}</p>
                    {olaHospitals[0].address && (
                      <p className="text-xs text-gray-400 mt-1">{olaHospitals[0].address}</p>
                    )}
                    {olaHospitals[0].lat != null && selectedAccident?.latitude != null && (
                      <p className="text-xs text-brand-success mt-2 font-semibold">
                        ~{haversineKm(
                            selectedAccident.latitude, selectedAccident.longitude,
                            olaHospitals[0].lat, olaHospitals[0].lon
                          ).toFixed(2)} km (straight-line)
                      </p>
                    )}
                    <p className="text-[10px] text-brand-success mt-1 opacity-70">Ranked #1 by distance</p>
                  </div>
                ) : route ? (
                  <div className="card-3d p-4 glow-border-success" style={{ background: 'rgba(16,185,129,0.06)' }}>
                    <p className="font-bold text-sm text-brand-success mb-2">✅ Route to Hospital</p>
                    <p className="text-xs text-gray-300">Distance: {route.distance_km?.toFixed(2)} km</p>
                    <p className="text-xs text-gray-300">ETA: {route.eta_minutes} minutes</p>
                    <p className="text-xs text-brand-success mt-2 font-medium">
                      {route.hospital_name || route.hospital_id}
                    </p>
                    {route.route_source && (
                      <p className="text-[10px] text-gray-500 mt-1">Route: {route.route_source}</p>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <div className="text-center py-8 opacity-40">
                <p className="text-gray-400 text-xs">👈 Click on a red marker to view details</p>
              </div>
            )}

            {/* Accidents List */}
            <div className="mt-6 border-t border-brand-border/40 pt-5">
              <p className="text-xs font-bold text-white mb-3 uppercase tracking-wider">🚨 All Accidents ({accidents.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {accidents.length === 0 ? (
                  <p className="text-xs text-gray-500">No accidents reported</p>
                ) : (
                  accidents.map((accident) => (
                    <div
                      key={accident.id}
                      onClick={() => handleAccidentClick(accident)}
                      className={`p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedAccident?.id === accident.id
                          ? 'glow-border-danger'
                          : 'hover:bg-white/5'
                      }`}
                      style={selectedAccident?.id === accident.id ? { background: 'rgba(239,68,68,0.08)' } : {}}
                    >
                      <p className="text-xs font-semibold text-brand-danger">
                        {accident.type || 'Accident'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(accident.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Hospitals List */}
            <div className="mt-6 border-t border-brand-border/40 pt-5">
              <p className="text-xs font-bold text-white mb-3 uppercase tracking-wider">🏥 Hospitals ({hospitals.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {hospitals.length === 0 ? (
                  <p className="text-xs text-gray-500">No hospitals found</p>
                ) : (
                  hospitals.map((hospital) => (
                    <div key={hospital.id} className="p-2.5 rounded-xl glow-border-accent" style={{ background: 'rgba(59,130,246,0.04)' }}>
                      <p className="text-xs font-semibold text-brand-accent">{hospital.name}</p>
                      <p className="text-[10px] text-gray-500">{hospital.distance_km?.toFixed(2)} km away</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ola Maps Hospitals */}
            {olaHospitals.length > 0 && (
              <div className="mt-6 border-t border-brand-border/40 pt-5">
                <p className="text-xs font-bold text-white mb-1 uppercase tracking-wider">🗺️ Nearest Hospitals (Ola Maps)</p>
                <p className="text-[10px] text-gray-500 mb-3">Ranked by distance from accident</p>
                <div className="space-y-2">
                  {olaHospitals.map((h) => (
                    <div key={h.placeId} className="flex items-start gap-2.5 p-2.5 rounded-xl glow-border-success" style={{ background: 'rgba(16,185,129,0.04)' }}>
                      <span className="shrink-0 w-5 h-5 bg-brand-success/20 text-brand-success rounded-full flex items-center justify-center text-[10px] font-bold">{h.rank}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brand-success">{h.name}</p>
                        {h.address && <p className="text-[10px] text-gray-500 leading-tight truncate">{h.address}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
