import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const SEV_STYLE = {
  high: { badge: 'bg-red-600', ring: 'ring-red-500', text: 'text-red-400', bg: 'bg-red-950/40', label: 'HIGH' },
  medium: { badge: 'bg-orange-500', ring: 'ring-orange-500', text: 'text-orange-400', bg: 'bg-orange-950/30', label: 'MEDIUM' },
  low: { badge: 'bg-yellow-500', ring: 'ring-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-950/20', label: 'LOW' },
  unknown: { badge: 'bg-gray-600', ring: 'ring-gray-500', text: 'text-gray-400', bg: 'bg-gray-800/40', label: '?' },
};

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-yellow-500', icon: '⏳' },
  accepted: { label: 'Accepted', color: 'bg-green-500', icon: '✅' },
  rejected: { label: 'Rejected', color: 'bg-red-600', icon: '❌' },
  arrived_scene: { label: 'Arrived Scene', color: 'bg-blue-500', icon: '🚑' },
  patient_loaded: { label: 'Patient Loaded', color: 'bg-purple-500', icon: '🛏️' },
  completed: { label: 'Completed', color: 'bg-gray-500', icon: '🏁' },
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function AlertCard({ alert, hospitalId, onStatusUpdate }) {
  const sev = SEV_STYLE[(alert.severity || '').toLowerCase()] || SEV_STYLE.unknown;
  const sm = STATUS_META[alert.status] || { label: alert.status, color: 'bg-gray-500', icon: '?' };
  const isActive = ['pending', 'accepted', 'arrived_scene', 'patient_loaded'].includes(alert.status);

  const updateStatus = async (newStatus) => {
    await fetch(`${API_BASE}/hospital/alerts/${alert.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    onStatusUpdate(alert.id, newStatus);
  };

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden
      ${alert.status === 'pending' ? `ring-2 ${sev.ring} animate-pulse-slow` : 'ring-0'}
      ${sev.bg} border-white/10`}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {alert.status === 'pending' && (
            <span className="text-xs font-bold text-red-300 bg-red-900/70 px-2 py-0.5 rounded-full animate-pulse">
              🔴 NEW ALERT
            </span>
          )}
          <span className={`text-xs font-bold text-white uppercase px-2 py-0.5 rounded ${sev.badge}`}>
            {sev.label}
          </span>
          <span className={`text-xs font-semibold text-white px-2 py-0.5 rounded ${sm.color}`}>
            {sm.icon} {sm.label}
          </span>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{formatTime(alert.created_at)}</span>
      </div>

      {/* Info */}
      <div className="px-5 pb-4 space-y-1">
        <p className="text-sm text-slate-200 flex items-start gap-1">
          <span className="text-slate-500">📍</span>
          <span className="break-all">{alert.location}</span>
        </p>
        <p className="text-xs text-slate-400">🚗 {alert.vehicles} vehicle{alert.vehicles !== 1 ? 's' : ''} involved</p>
        {alert.distance_km != null && (
          <p className="text-xs text-slate-400">
            📏 ~{Number(alert.distance_km).toFixed(2)} km away
            {alert.eta_minutes != null && ` · ETA ~${alert.eta_minutes} min`}
          </p>
        )}
        <p className="text-xs text-slate-600">Incident #{alert.incident_id}</p>
      </div>

      {/* Accident Reference Image */}
      {alert.snapshot_url && (
        <div className="px-5 pb-4">
          <p className="text-[11px] text-slate-500 mb-1.5 uppercase tracking-wide font-semibold">📸 Accident Reference Image</p>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <img
              src={`${API_BASE}${alert.snapshot_url}`}
              alt="Accident snapshot"
              className="w-full h-auto object-contain max-h-64"
              loading="lazy"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-2">
            {alert.status === 'pending' && (
              <>
                <button
                  onClick={() => updateStatus('accepted')}
                  className="flex-1 min-w-[100px] bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition"
                >
                  ✅ ACCEPT
                </button>
                <button
                  onClick={() => updateStatus('rejected')}
                  className="flex-1 min-w-[100px] bg-red-700 hover:bg-red-600 text-white text-xs font-bold py-2 px-3 rounded-xl transition"
                >
                  ❌ REJECT (Full)
                </button>
              </>
            )}
            {alert.status === 'accepted' && (
              <button
                onClick={() => updateStatus('arrived_scene')}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition"
              >
                🚑 Arrived at Scene
              </button>
            )}
            {alert.status === 'arrived_scene' && (
              <button
                onClick={() => updateStatus('patient_loaded')}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition"
              >
                🛏️ Patient Loaded
              </button>
            )}
            {alert.status === 'patient_loaded' && (
              <button
                onClick={() => updateStatus('completed')}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition"
              >
                🏁 Mission Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const wsRef = useRef(null);

  const [hospital, setHospital] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [beds, setBeds] = useState('');
  const [bedsEditing, setBedsEditing] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type }

  // Load hospital from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('hospitalAuth');
    if (!stored) {
      navigate('/hospital-login');
      return;
    }
    const h = JSON.parse(stored);
    setHospital(h);
    setBeds(String(h.beds_available ?? ''));
  }, []);

  const showNotif = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Connect WebSocket once hospital is loaded
  useEffect(() => {
    if (!hospital) return;
    const wsBase = API_BASE.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/hospital/${hospital.id}`;
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus('connecting');

      ws.onopen = () => {
        setWsStatus('connected');
        console.info('[HospitalWS] connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ping') return;

          if (msg.type === 'init') {
            // Initial load: hospital info + recent alerts
            setHospital((prev) => ({ ...prev, ...msg.hospital }));
            setBeds(String(msg.hospital.beds_available ?? ''));
            setAlerts(msg.alerts || []);
          } else if (msg.type === 'new_alert') {
            // New accident alert pushed from backend
            setAlerts((prev) => [msg.alert, ...prev].slice(0, 30));
            showNotif(`🚨 New ${(msg.alert.severity || '').toUpperCase()} accident alert! ${Number(msg.alert.distance_km || 0).toFixed(1)} km away`, 'alert');
            // Play a siren (best-effort)
            try {
              const audioEl = document.getElementById('siren-audio');
              if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.play().catch(e => console.error("Audio play blocked by browser:", e));
              }
            } catch (e) { console.error(e); }
          } else if (msg.type === 'alert_update') {
            // Status update (could come from another tab)
            setAlerts((prev) =>
              prev.map((a) => a.id === msg.alert_id ? { ...a, status: msg.status } : a)
            );
          } else if (msg.type === 'beds_updated') {
            setHospital((prev) => ({ ...prev, beds_available: msg.beds_available }));
            setBeds(String(msg.beds_available));
            showNotif(`Bed count updated: ${msg.beds_available} available`);
          }
        } catch (err) {
          console.error('[HospitalWS] parse error', err);
        }
      };

      ws.onerror = () => setWsStatus('error');

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Auto-reconnect after 4s
        reconnectTimer = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [hospital?.id]);

  const handleStatusUpdate = useCallback((alertId, newStatus) => {
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: newStatus } : a));
    const sm = STATUS_META[newStatus];
    showNotif(`${sm?.icon || ''} Alert #${alertId} → ${sm?.label || newStatus}`);
  }, [showNotif]);

  const handleBedsSave = () => {
    const n = parseInt(beds, 10);
    if (isNaN(n) || n < 0) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_beds', beds: n }));
    }
    setBedsEditing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('hospitalAuth');
    navigate('/hospital-login');
  };

  const pending = alerts.filter((a) => a.status === 'pending');
  const active = alerts.filter((a) => ['accepted', 'arrived_scene', 'patient_loaded'].includes(a.status));
  const history = alerts.filter((a) => ['rejected', 'completed'].includes(a.status));

  if (!hospital) return null;

  const bedPct = hospital.beds_available != null && hospital.capacity_total
    ? Math.round((hospital.beds_available / hospital.capacity_total) * 100)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <audio id="siren-audio" src="/preview1.mp3" preload="auto" />

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all
          ${notification.type === 'alert' ? 'bg-red-600 text-white' : 'bg-green-700 text-white'}`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{hospital.name}</h1>
              <p className="text-xs text-slate-400">{hospital.address || 'Emergency Response Dashboard'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* WS indicator */}
            <span className={`text-xs px-2 py-1 rounded-full font-semibold
              ${wsStatus === 'connected' ? 'bg-green-800 text-green-200' :
                wsStatus === 'connecting' ? 'bg-yellow-800 text-yellow-200' : 'bg-red-900 text-red-200'}`}
            >
              {wsStatus === 'connected' ? '🟢 Live' : wsStatus === 'connecting' ? '🟡 Connecting…' : '🔴 Offline'}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/30"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pending Alerts', value: pending.length, color: 'text-red-400', icon: '🚨' },
            { label: 'Active Missions', value: active.length, color: 'text-blue-400', icon: '🚑' },
            { label: 'Beds Available', value: hospital.beds_available ?? '—', color: 'text-green-400', icon: '🛏️' },
            { label: 'Total Capacity', value: hospital.capacity_total ?? '—', color: 'text-slate-400', icon: '🏥' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{icon} {label}</p>
              <p className={`text-3xl font-extrabold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Bed management */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">🛏️ Bed Availability</h2>
            {!bedsEditing ? (
              <button
                onClick={() => setBedsEditing(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition border border-blue-500/30 px-3 py-1 rounded-lg"
              >
                Update
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  className="w-20 bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1 text-sm text-center"
                  min="0"
                />
                <button onClick={handleBedsSave} className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition">Save</button>
                <button onClick={() => setBedsEditing(false)} className="text-xs text-slate-400 hover:text-white transition">Cancel</button>
              </div>
            )}
          </div>
          {bedPct != null && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{hospital.beds_available} available</span>
                <span>{bedPct}% capacity</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bedPct > 50 ? 'bg-green-500' : bedPct > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${bedPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pending alerts */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-white">🚨 Incoming Alerts</h2>
            {pending.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pending.length} new
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl py-12 text-center">
              <p className="text-3xl mb-2">🛡️</p>
              <p className="text-slate-400 text-sm">No pending alerts — all clear</p>
              <p className="text-slate-600 text-xs mt-1">New accident alerts will appear here instantly via live WebSocket</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((a) => (
                <AlertCard key={a.id} alert={a} hospitalId={hospital.id} onStatusUpdate={handleStatusUpdate} />
              ))}
            </div>
          )}
        </section>

        {/* Active missions */}
        {active.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4">🚑 Active Missions</h2>
            <div className="space-y-4">
              {active.map((a) => (
                <AlertCard key={a.id} alert={a} hospitalId={hospital.id} onStatusUpdate={handleStatusUpdate} />
              ))}
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-400 mb-4">📋 Mission History</h2>
            <div className="space-y-3">
              {history.map((a) => (
                <div key={a.id} className="bg-white/3 border border-white/8 rounded-xl px-5 py-3 flex items-center gap-4 opacity-70">
                  <span className="text-lg">{STATUS_META[a.status]?.icon || '?'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{a.location}</p>
                    <p className="text-xs text-slate-500">{formatTime(a.created_at)} · {a.vehicles} vehicles · {STATUS_META[a.status]?.label}</p>
                  </div>
                  <span className={`text-xs font-bold text-white uppercase px-2 py-0.5 rounded ${SEV_STYLE[(a.severity || '').toLowerCase()]?.badge || 'bg-gray-600'}`}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
