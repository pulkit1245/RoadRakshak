import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, websocketAPI, apiUtils } from '../services/api';
import AlertBanner from '../components/AlertBanner';
import ViolationLog from '../components/ViolationLog';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    frames_processed: 0,
    total_violations: 0,
    total_accidents: 0,
    ambulances_dispatched: 0,
  });
  const [violations, setViolations] = useState([]);
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasAccident, setHasAccident] = useState(false);
  const wsRef = React.useRef(null);

  // Fetch initial stats
  useEffect(() => {
    fetchStats();
    fetchViolations();
    fetchAccidents();
  }, []);

  // Connect to WebSocket for live updates
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        websocketAPI.disconnect(wsRef.current);
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const data = await dashboardAPI.getStats();
      setStats(data);
      setError('');
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    }
  };

  const fetchViolations = async () => {
    try {
      const data = await dashboardAPI.getRecentViolations(15);
      setViolations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching violations:', err);
    }
  };

  const fetchAccidents = async () => {
    try {
      const data = await dashboardAPI.getRecentAccidents(10);
      setAccidents(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching accidents:', err);
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    wsRef.current = websocketAPI.connectDetectionStream({
      onMessage: (data) => {
        // Update stats from WebSocket data
        if (data.stats) {
          setStats((prev) => ({
            ...prev,
            frames_processed: data.stats.frames_processed ?? prev.frames_processed,
            total_violations: data.stats.total_violations ?? prev.total_violations,
            total_accidents: data.stats.total_accidents ?? prev.total_accidents,
            ambulances_dispatched: data.stats.ambulances_dispatched ?? prev.ambulances_dispatched,
          }));
        }

        // Add new violations to list
        if (data.violations && Array.isArray(data.violations) && data.violations.length > 0) {
          setViolations((prev) => [...data.violations, ...prev.slice(0, 14)]);
        }

        // Add new accident to list and show alert (if it has a DB ID)
        if (data.accident && data.id) {
          const accidentObj = {
            id: data.id,
            timestamp: new Date().toISOString(),
            location: data.location || 'Unknown',
            severity: data.severity || 'high',
            type: 'Collision'
          };
          setAccidents((prev) => [accidentObj, ...prev.slice(0, 9)]);
          setHasAccident(true);
          setTimeout(() => setHasAccident(false), 5000); // Hide alert after 5 seconds
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
      },
      onClose: () => {
        console.log('WebSocket disconnected');
      },
    });
  };

  const handleLogout = () => {
    apiUtils.clearAll();
    navigate('/login');
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
    fetchViolations();
    fetchAccidents();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleString();
    const dt = new Date(timestamp);
    return Number.isNaN(dt.getTime()) ? String(timestamp) : dt.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white selection:bg-brand-accent/30">
      {/* Alert Banner */}
      {hasAccident && accidents.length > 0 && (
        <AlertBanner accident={accidents[0]} />
      )}

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-xl border-b border-brand-border/50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">RoadRakshak <span className="text-brand-accent">2.0</span></h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-brand-success rounded-full animate-pulse"></span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Network Secure • System Live</p>
              </div>
            </div>
          </div>
          
          <div className="hidden xl:flex items-center gap-2">
            {[
              { label: 'Control Center', path: '/live-feed', icon: '📹', color: 'hover:bg-brand-accent/10 hover:text-brand-accent' },
              { label: 'Spatial Map',    path: '/map',       icon: '🗺️', color: 'hover:bg-purple-500/10 hover:text-purple-400' },
              { label: 'Intel Report',   path: '/analytics', icon: '📊', color: 'hover:bg-brand-success/10 hover:text-brand-success' },
              { label: 'Core Config',    path: '/advanced',  icon: '⚡', color: 'hover:bg-pink-500/10 hover:text-pink-400' },
            ].map((nav) => (
              <button
                key={nav.path}
                onClick={() => navigate(nav.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${nav.color}`}
              >
                <span>{nav.icon}</span>
                {nav.label}
              </button>
            ))}
            <div className="w-px h-6 bg-brand-border/50 mx-2"></div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-brand-danger hover:bg-brand-danger/10 rounded-xl transition-all"
            >
              Terminate Session
            </button>
          </div>
        </div>
      </nav>

      {/* Main Execution View */}
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-brand-accent/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-brand-accent rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-gray-400 font-medium tracking-wide animate-pulse uppercase text-xs">Synchronizing Neural Assets...</p>
          </div>
        ) : (
          <>
            {/* Mission Critical Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Throughput',    value: stats.frames_processed, icon: '⚡', desc: 'Frames Processed', color: 'text-brand-accent',  shadow: 'shadow-brand-accent/10' },
                { label: 'Anomalies',     value: stats.total_violations, icon: '⚠️', desc: 'Traffic Violations', color: 'text-brand-warning', shadow: 'shadow-brand-warning/10' },
                { label: 'Critical Hits', value: stats.total_accidents,  icon: '🚨', desc: 'Active Incidents',  color: 'text-brand-danger',  shadow: 'shadow-brand-danger/10', border: 'border-l-4 border-brand-danger' },
                { label: 'Deployments',   value: stats.ambulances_dispatched, icon: '🚑', desc: 'Medical Response', color: 'text-brand-success', shadow: 'shadow-brand-success/10' },
              ].map((stat) => (
                <div key={stat.label} className={`glass-card p-6 group hover:scale-[1.02] ${stat.border || ''} ${stat.shadow}`}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{stat.label}</p>
                    <span className="text-2xl grayscale group-hover:grayscale-0 transition-all duration-500">{stat.icon}</span>
                  </div>
                  <p className={`text-4xl font-black ${stat.color} tracking-tight`}>
                    {(stat.value || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>

            {/* Tactical Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Central Intelligence Log */}
              <div className="lg:col-span-2 glass-card overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-border/50 bg-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-brand-accent">Live Intelligence Feed</h3>
                  <button onClick={handleRefresh} className="text-[10px] font-bold uppercase tracking-tighter text-gray-500 hover:text-white transition">Sync Stream</button>
                </div>
                <div className="p-0">
                  <ViolationLog violations={violations} />
                </div>
              </div>

              {/* Emergency Response Stack */}
              <div className="glass-card flex flex-col">
                <div className="px-6 py-4 border-b border-brand-border/50 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-brand-danger">Priority Incident Stack</h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                  {accidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                      <p className="text-4xl mb-4">🛸</p>
                      <p className="text-xs font-bold uppercase tracking-widest">Airspace Clear</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {accidents.map((accident, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-2xl group hover:bg-brand-danger/20 transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-black text-brand-danger uppercase tracking-tighter">
                              {accident.type || 'Collision Detected'}
                            </p>
                            <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                              {formatTimestamp(accident.timestamp).split(', ')[1]}
                            </span>
                          </div>
                          {accident.location && (
                            <div className="flex items-center gap-2 mt-2 opacity-60">
                              <span className="text-[10px]">📍</span>
                              <p className="text-[10px] font-semibold truncate">{accident.location}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 mt-auto border-t border-brand-border/50">
                  <button 
                    onClick={() => navigate('/map')}
                    className="w-full py-3 bg-brand-danger/20 hover:bg-brand-danger/30 text-brand-danger text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all"
                  >
                    Deploy Field Units
                  </button>
                </div>
              </div>
            </div>

            {/* System Telemetry Footer */}
            <div className="mt-8 flex items-center justify-between px-6 py-4 glass-card border-none bg-brand-accent/5">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-success rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Core Engine: 2.1.0-PRO</span>
                </div>
                <div className="w-px h-4 bg-brand-border/50"></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Node Status:</span>
                  <span className="text-[10px] font-black text-brand-accent uppercase">Central Hub Online</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                Session ID: <span className="text-gray-400">{Math.random().toString(36).substring(7).toUpperCase()}</span>
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
