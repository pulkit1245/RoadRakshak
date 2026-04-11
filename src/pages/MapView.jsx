import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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

// Green icon for Ola Maps hospitals (nearest to accident)
const olaHospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Haversine distance in km between two lat/lon points. */
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
  const [olaHospitals, setOlaHospitals] = useState([]);   // from Live Feed via URL
  const [selectedAccident, setSelectedAccident] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState([28.7041, 77.1025]);

  // Default center (can be updated based on your city)
  const defaultCenter = [28.7041, 77.1025]; // Delhi, India

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
    } catch (_) {
      /* use defaultCenter */
    }
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

  // Deep link from Live Feed: ?accidentLat=&accidentLon=&olaHospitals=[...]
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

    // Parse Ola hospitals from URL
    try {
      const raw = searchParams.get('olaHospitals');
      if (raw) setOlaHospitals(JSON.parse(decodeURIComponent(raw)));
    } catch (_) {}

    // Only call backend route if Ola didn't provide hospitals;
    // Ola is ranked by real distance so its #1 is already the nearest.
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-full px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗺️ Traffic Incident Map</h1>
            <p className="text-sm text-gray-600">Real-time accident locations & hospital routes</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-full px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">⚠️ {error} - Make sure backend is running</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Map */}
        <div className="flex-1 relative z-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading map...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Accident Markers (Red) */}
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

              {/* Hospital Markers (Blue) — DB-backed */}
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

              {/* Ola Maps Hospitals (Green) — nearest to accident */}
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
                  color="green"
                  weight={3}
                  opacity={0.7}
                />
              )}
            </MapContainer>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Incident Details</h3>

            {selectedAccident ? (
              <div className="space-y-4">
                {/* Selected Accident */}
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-bold text-red-900">🚨 {selectedAccident.type || 'Accident'}</p>
                  <p className="text-sm text-red-700 mt-2">
                    {new Date(selectedAccident.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    📍 {selectedAccident.location || 'Unknown location'}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Coordinates: {Number(selectedAccident.latitude).toFixed(6)}, {Number(selectedAccident.longitude).toFixed(6)}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Severity: <span className="font-semibold">{selectedAccident.severity}</span>
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    Description: {selectedAccident.description || 'No description available.'}
                  </p>
                </div>

                {/* Nearest Hospital — prefer Ola #1, fallback to backend route */}
                {olaHospitals.length > 0 ? (
                  <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                    <p className="font-bold text-green-800">🏥 Nearest Hospital (Ola Maps)</p>
                    <p className="text-sm font-semibold text-green-900 mt-2">{olaHospitals[0].name}</p>
                    {olaHospitals[0].address && (
                      <p className="text-xs text-gray-600 mt-1">{olaHospitals[0].address}</p>
                    )}
                    {olaHospitals[0].lat != null && selectedAccident?.latitude != null && (
                      <p className="text-sm text-green-700 mt-2">
                        ~{haversineKm(
                            selectedAccident.latitude, selectedAccident.longitude,
                            olaHospitals[0].lat, olaHospitals[0].lon
                          ).toFixed(2)} km (straight-line)
                      </p>
                    )}
                    <p className="text-xs text-green-600 mt-1">Ranked #1 by distance</p>
                  </div>
                ) : route ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-bold text-green-900">✅ Route to Hospital</p>
                    <p className="text-sm text-green-700 mt-2">Distance: {route.distance_km?.toFixed(2)} km</p>
                    <p className="text-sm text-green-700">ETA: {route.eta_minutes} minutes</p>
                    <p className="text-xs text-green-600 mt-2">
                      Hospital: {route.hospital_name || route.hospital_id}
                    </p>
                    {route.route_source && (
                      <p className="text-xs text-gray-500 mt-1">Route: {route.route_source}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">👈 Click on a red marker to view accident details</p>
              </div>
            )}

            {/* Accidents List */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <p className="font-semibold text-gray-900 mb-3">🚨 All Accidents ({accidents.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {accidents.length === 0 ? (
                  <p className="text-sm text-gray-500">No accidents reported</p>
                ) : (
                  accidents.map((accident) => (
                    <div
                      key={accident.id}
                      onClick={() => handleAccidentClick(accident)}
                      className={`p-2 rounded cursor-pointer transition ${
                        selectedAccident?.id === accident.id
                          ? 'bg-red-100 border border-red-300'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <p className="text-xs font-semibold text-red-600">
                        {accident.type || 'Accident'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(accident.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Hospitals List — DB */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <p className="font-semibold text-gray-900 mb-3">🏥 Hospitals ({hospitals.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hospitals.length === 0 ? (
                  <p className="text-sm text-gray-500">No hospitals found</p>
                ) : (
                  hospitals.map((hospital) => (
                    <div key={hospital.id} className="p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-600">{hospital.name}</p>
                      <p className="text-xs text-gray-600">{hospital.distance_km?.toFixed(2)} km away</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ola Maps Hospitals — shown when linked from Live Feed */}
            {olaHospitals.length > 0 && (
              <div className="mt-6 border-t border-green-200 pt-6">
                <p className="font-semibold text-gray-900 mb-1">🗺️ Nearest Hospitals (Ola Maps)</p>
                <p className="text-xs text-gray-500 mb-3">Ranked by distance from accident</p>
                <ol className="space-y-2">
                  {olaHospitals.map((h) => (
                    <li key={h.placeId} className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                      <span className="shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{h.rank}</span>
                      <div>
                        <p className="text-xs font-semibold text-green-800">{h.name}</p>
                        {h.address && <p className="text-xs text-gray-500 leading-tight">{h.address}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
