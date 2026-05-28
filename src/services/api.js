import axios from 'axios';

// Create axios instance with base URL pointing to FastAPI backend
// Use 127.0.0.1 (not "localhost") so we hit the same stack as uvicorn on 127.0.0.1:8000 — on many OSes
// "localhost" resolves to IPv6 ::1 first and nothing is listening there → WebSocket 1006.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/**
 * WebSocket URL for the FastAPI app (same host/port as REST).
 * Do NOT use `new WebSocket(\`${ws}://${window.location.host}/ws\`)` in dev: that hits Vite (5173),
 * and Vite's WebSocket proxy to the API is unreliable; you get 1006 / "closed before established".
 * Always connect straight to the API (default 127.0.0.1:8000).
 */
export function getWebSocketUrl() {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) {
    console.info('[RoadRakshak WS] using VITE_WS_URL', explicit);
    return explicit.trim();
  }
  const api = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  try {
    const u = new URL(api);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    const derived = `${wsProto}//${u.host}/ws`;
    console.info('[RoadRakshak WS] from VITE_API_URL', { VITE_API_URL: api, url: derived });
    return derived;
  } catch (e) {
    const fallback = 'ws://127.0.0.1:8000/ws';
    console.warn('[RoadRakshak WS] invalid VITE_API_URL, fallback', api, e);
    return fallback;
  }
}

function describeWebSocketClose(code) {
  const known = {
    1000: 'normal closure',
    1001: 'going away',
    1002: 'protocol error',
    1003: 'unsupported data',
    1006: 'abnormal (no close frame — often wrong host/port, TLS, or server down)',
    1007: 'invalid payload',
    1008: 'policy violation',
    1011: 'server error',
    1012: 'service restart',
    1013: 'try again later',
    1015: 'TLS handshake failure',
  };
  return known[code] ?? `code ${code}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to every request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH ENDPOINTS
// ============================================

export const authAPI = {
  // POST /auth/login - Get JWT token
  login: async (email, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      // Save token to localStorage
      if (response.data.access_token) {
        localStorage.setItem('authToken', response.data.access_token);
      }
      return response.data;
    } catch (error) {
      const detail = error.response?.data?.detail;
      let message = 'Login failed';

      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((d) => d?.msg || d?.message || JSON.stringify(d))
          .join(', ');
      } else if (detail && typeof detail === 'object') {
        message = detail.msg || detail.message || JSON.stringify(detail);
      }

      throw new Error(message);
    }
  },

  // POST /auth/logout - Clear session
  logout: async () => {
    try {
      localStorage.removeItem('authToken');
      await api.post('/auth/logout');
    } catch (error) {
      localStorage.removeItem('authToken');
    }
  },

  // GET /auth/me - Get current user
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get user');
    }
  },
};

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

export const dashboardAPI = {
  // GET /stats - Get current statistics
  // Returns: { frames_processed, total_violations, total_accidents, ambulances_dispatched }
  getStats: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch stats');
    }
  },

  // GET /recent-violations - Get recent violations for display
  // Returns: Array of { id, timestamp, type, location, severity }
  getRecentViolations: async (limit = 10) => {
    try {
      const response = await api.get('/recent-violations', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violations');
    }
  },

  // GET /recent-accidents - Get recent accidents
  // Returns: Array of { id, timestamp, location, severity, ambulance_dispatched }
  getRecentAccidents: async (limit = 10) => {
    try {
      const response = await api.get('/recent-accidents', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch accidents');
    }
  },
};

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

export const analyticsAPI = {
  // GET /analytics/violations - Get violations over time for charts
  // Returns: Array of { date, violations_count }
  getViolationsByTime: async (days = 30) => {
    try {
      const response = await api.get('/analytics/violations', {
        params: { days },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch analytics');
    }
  },

  // GET /analytics/accidents - Get accidents over time
  // Returns: Array of { date, accidents_count }
  getAccidentsByTime: async (days = 30) => {
    try {
      const response = await api.get('/analytics/accidents', {
        params: { days },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch accident data');
    }
  },

  // GET /analytics/heatmap - Get violation hotspots
  // Returns: Array of { latitude, longitude, count }
  getHotspots: async () => {
    try {
      const response = await api.get('/analytics/heatmap');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch hotspots');
    }
  },
};

// ============================================
// MAP ENDPOINTS
// ============================================

export const mapAPI = {
  // GET /map/accidents - Get accident locations
  // Returns: Array of { id, latitude, longitude, timestamp, type }
  getAccidents: async () => {
    try {
      const response = await api.get('/map/accidents');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch accidents');
    }
  },

  // GET /map/hospitals - DB-backed, ranked by distance + beds + response (optional lat/lon + radius_km)
  getHospitals: async (lat, lon, radiusKm = 50) => {
    try {
      const params = {};
      if (lat != null && lon != null) {
        params.lat = lat;
        params.lon = lon;
        params.radius_km = radiusKm;
      }
      const response = await api.get('/map/hospitals', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch hospitals');
    }
  },

  patchHospital: async (hospitalId, payload) => {
    try {
      const response = await api.patch(`/hospitals/${hospitalId}`, payload);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update hospital');
    }
  },

  // POST /map/route - Get route to nearest hospital
  // Body: { accident_lat, accident_lon }
  // Returns: { route_coords: [[lat, lon], ...], hospital_id, distance_km, eta_minutes }
  getRouteToNearestHospital: async (accidentLat, accidentLon) => {
    try {
      const response = await api.post('/map/route', {
        accident_lat: accidentLat,
        accident_lon: accidentLon,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to calculate route');
    }
  },
};

// ============================================
// LIVE FEED / DETECTION ENDPOINTS
// ============================================

export const detectionAPI = {
  // POST /detect/frame - Send frame for detection
  // Body: { frame: base64_string }
  // Returns: { vehicles: [...], violations: [...], accidents: [...] }
  detectFrame: async (frameBase64) => {
    try {
      const response = await api.post('/detect/frame', {
        frame: frameBase64,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Detection failed');
    }
  },

  // GET /detect/status - Get detection system status
  getStatus: async () => {
    try {
      const response = await api.get('/detect/status');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get status');
    }
  },
};

// ============================================
// WEBSOCKET HELPER
// ============================================

export const websocketAPI = {
  // Connect to WebSocket for live detection stream
  // Returns: WebSocket instance
  // Usage:
  //   const ws = websocketAPI.connectDetectionStream(handlers)
  //   handlers.onMessage(data) - Called when detection results arrive
  //   handlers.onError(error) - Called on error
  //   handlers.onClose() - Called when connection closes
  connectDetectionStream: (handlers = {}) => {
    const wsURL = getWebSocketUrl();
    const meta = {
      href: typeof window !== 'undefined' ? window.location.href : '(ssr)',
      api: API_BASE_URL,
      wsURL,
    };
    console.info('[RoadRakshak WS] connecting', meta);

    const ws = new WebSocket(wsURL);

    ws.onopen = () => {
      console.info('[RoadRakshak WS] open', { url: wsURL, protocol: ws.protocol, extensions: ws.extensions });
      if (handlers.onOpen) handlers.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (handlers.onMessage) handlers.onMessage(data);
      } catch (error) {
        console.error('[RoadRakshak WS] parse error', error, 'raw length', event.data?.length);
      }
    };

    ws.onerror = (event) => {
      // Browser gives almost no details on error; use onclose code.
      console.error('[RoadRakshak WS] error event (see close code)', { url: wsURL, event });
      if (handlers.onError) handlers.onError({ type: 'error', url: wsURL, event });
    };

    ws.onclose = (event) => {
      const detail = {
        code: event.code,
        reason: event.reason || '(empty)',
        wasClean: event.wasClean,
        meaning: describeWebSocketClose(event.code),
        url: wsURL,
      };
      console.warn('[RoadRakshak WS] closed', detail);
      if (handlers.onClose) handlers.onClose(event, detail);
    };

    return ws;
  },

  // Send frame data through WebSocket
  sendFrame: (ws, frameBase64, metadata = {}) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const normalizedFrame = typeof frameBase64 === 'string' && frameBase64.includes(',')
        ? frameBase64.split(',', 2)[1]
        : frameBase64;
      ws.send(JSON.stringify({
        frame: normalizedFrame,
        ...metadata,
      }));
    }
  },

  // Close WebSocket connection
  disconnect: (ws) => {
    if (ws) {
      ws.close();
    }
  },
};

// ============================================
// AMBULANCE ENDPOINTS
// ============================================

export const ambulanceAPI = {
  // GET /ambulance/nearest - Get nearest ambulance
  // Returns: { id, location: [lat, lon], eta_minutes, status }
  getNearestAmbulance: async (lat, lon) => {
    try {
      const response = await api.get('/ambulance/nearest', {
        params: { lat, lon },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to find ambulance');
    }
  },

  // GET /ambulance/status - Get ambulance status
  // Returns: { id, location, eta_minutes, status }
  getStatus: async (ambulanceId) => {
    try {
      const response = await api.get(`/ambulance/${ambulanceId}/status`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get ambulance status');
    }
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const apiUtils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  // Get stored auth token
  getAuthToken: () => {
    return localStorage.getItem('authToken');
  },

  // Clear all stored data
  clearAll: () => {
    localStorage.removeItem('authToken');
  },
};

// ============================================
// OLA MAPS — nearby hospital search
// ============================================
// API key is read from VITE_OLA_API_KEY in your .env file at the repo root.
// Docs: https://maps.olakrutrim.com/docs/nearby-search

export const olaMapsAPI = {
  /**
   * Fetch top-5 hospitals near (lat, lon) using Ola Maps nearby-search.
   * withCentroid=true makes the API return real lat/lng for each place so we
   * can pin them on the map without a separate place-details call.
   *
   * Returns an array of normalised hospital objects:
   *   { name, lat, lon, address, placeId, rank }
   */
  getNearbyHospitals: async (lat, lon) => {
    const apiKey = import.meta.env.VITE_OLA_API_KEY;
    if (!apiKey || apiKey === 'YOUR_OLA_API_KEY_HERE') {
      console.warn('[OlaMaps] VITE_OLA_API_KEY not set — skipping nearby hospital fetch');
      return [];
    }

    const url = new URL('https://api.olamaps.io/places/v1/nearbysearch');
    url.searchParams.set('location', `${lat},${lon}`);
    url.searchParams.set('types', 'hospital');
    url.searchParams.set('radius', '5000');
    url.searchParams.set('rankBy', 'distance');
    url.searchParams.set('limit', '5');
    url.searchParams.set('withCentroid', 'true');   // ← returns coordinates per place
    url.searchParams.set('api_key', apiKey);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Ola Maps HTTP ${res.status}`);
      const json = await res.json();
      console.debug('[OlaMaps] nearbysearch response:', json);

      const places = json.predictions ?? json.results ?? [];
      return places.slice(0, 5).map((p, idx) => {
        // withCentroid=true adds a `centroid` object: { lat, lng }
        // Fall back to geometry.location for other API versions.
        const centroid = p.centroid ?? p.geometry?.location ?? null;
        return {
          name:    p.structured_formatting?.main_text ?? p.description ?? p.name ?? 'Hospital',
          address: p.structured_formatting?.secondary_text ?? p.vicinity ?? '',
          lat:     centroid?.lat ?? null,
          lon:     centroid?.lng ?? null,
          placeId: p.place_id ?? p.reference ?? idx,
          rank:    idx + 1,
        };
      });
    } catch (err) {
      console.error('[OlaMaps] getNearbyHospitals failed:', err);
      return [];
    }
  },

  /**
   * Dispatch an Ola Maps hospital to the backend — auto-registers it if new,
   * creates a HospitalAlert, and broadcasts via WebSocket to the hospital portal.
   * Returns { hospital_id, hospital_name, hospital_code, alert_id, distance_km, eta_minutes }
   */
  dispatchOlaHospital: async ({ incidentId, severity, location, vehicles, hospital, accidentLat, accidentLon, snapshotBase64 }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/hospital/dispatch-ola`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId || null,
          severity: severity || 'high',
          location: location || 'unknown',
          vehicles: vehicles || 0,
          hospital_name: hospital.name,
          hospital_address: hospital.address || '',
          hospital_lat: hospital.lat,
          hospital_lon: hospital.lon,
          accident_lat: accidentLat,
          accident_lon: accidentLon,
          snapshot_base64: snapshotBase64 || null,
        }),
      });
      if (!res.ok) throw new Error(`dispatch-ola HTTP ${res.status}`);
      const data = await res.json();
      console.info('[OlaMaps] dispatched to hospital portal:', data);
      return data;
    } catch (err) {
      console.error('[OlaMaps] dispatchOlaHospital failed:', err);
      return null;
    }
  },
};

export default api;
