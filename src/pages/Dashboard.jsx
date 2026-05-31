import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, animate } from 'framer-motion';
import { dashboardAPI, websocketAPI, apiUtils } from '../services/api';
import AlertBanner from '../components/AlertBanner';
import ViolationLog from '../components/ViolationLog';

/* ── Animated Counter ── */
function AnimatedCounter({ value, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value || 0, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) { node.textContent = Math.round(v).toLocaleString(); },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref} className={className}>0</span>;
}

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

  useEffect(() => {
    fetchStats();
    fetchViolations();
    fetchAccidents();
  }, []);

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
        if (data.stats) {
          setStats((prev) => ({
            ...prev,
            frames_processed: data.stats.frames_processed ?? prev.frames_processed,
            total_violations: data.stats.total_violations ?? prev.total_violations,
            total_accidents: data.stats.total_accidents ?? prev.total_accidents,
            ambulances_dispatched: data.stats.ambulances_dispatched ?? prev.ambulances_dispatched,
          }));
        }
        if (data.violations && Array.isArray(data.violations) && data.violations.length > 0) {
          setViolations((prev) => [...data.violations, ...prev.slice(0, 14)]);
        }
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
          setTimeout(() => setHasAccident(false), 5000);
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

  const statCards = [
    { label: 'Throughput',    value: stats.frames_processed,    icon: '⚡', desc: 'Frames Processed', color: 'text-brand-accent',  glow: 'glow-border-accent' },
    { label: 'Anomalies',    value: stats.total_violations,    icon: '⚠️', desc: 'Traffic Violations', color: 'text-brand-warning', glow: 'glow-border-warning' },
    { label: 'Critical Hits',value: stats.total_accidents,     icon: '🚨', desc: 'Active Incidents',  color: 'text-brand-danger',  glow: 'glow-border-danger' },
    { label: 'Deployments',  value: stats.ambulances_dispatched, icon: '🚑', desc: 'Medical Response', color: 'text-brand-success', glow: 'glow-border-success' },
  ];

  const navItems = [
    { label: 'Control Center', path: '/live-feed', icon: '📹' },
    { label: 'Spatial Map',    path: '/map',       icon: '🗺️' },
    { label: 'Intel Report',   path: '/analytics', icon: '📊' },
    { label: 'Core Config',    path: '/advanced',  icon: '⚡' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-white relative">
      {/* Background Orbs */}
      <div className="bg-orb bg-orb-blue"></div>
      <div className="bg-orb bg-orb-purple"></div>

      {/* Alert Banner */}
      {hasAccident && accidents.length > 0 && (
        <AlertBanner accident={accidents[0]} />
      )}

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 glass-panel border-0 border-b border-brand-border/40" style={{ borderRadius: 0 }}>
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-accent/15 rounded-xl flex items-center justify-center shadow-glow-blue border border-brand-accent/20">
              <span className="text-xl">🛡️</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">RoadRakshak <span className="text-brand-accent">2.0</span></h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-brand-success rounded-full animate-pulse-glow"></span>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">System Live • Network Secure</p>
              </div>
            </div>
          </div>
          
          <div className="hidden xl:flex items-center gap-1">
            {navItems.map((nav) => (
              <button
                key={nav.path}
                onClick={() => navigate(nav.path)}
                className="nav-link-3d"
              >
                <span>{nav.icon}</span>
                {nav.label}
              </button>
            ))}
            <div className="w-px h-6 bg-brand-border/50 mx-2"></div>
            <button
              onClick={handleLogout}
              className="nav-link-3d text-brand-danger hover:text-brand-danger"
            >
              Terminate Session
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-2 border-brand-accent/10 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-t-brand-accent rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-2 border-t-brand-accent/40 rounded-full animate-spin-slow" style={{ animationDirection: 'reverse' }}></div>
            </div>
            <p className="mt-6 text-gray-500 font-medium tracking-wide animate-pulse uppercase text-xs">Synchronizing Assets...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {statCards.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={`stat-3d ${stat.glow}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">{stat.label}</p>
                    <span className="text-xl opacity-40 group-hover:opacity-80 transition-opacity duration-500">{stat.icon}</span>
                  </div>
                  <AnimatedCounter value={stat.value || 0} className={`text-3xl font-bold ${stat.color} tracking-tight`} />
                  <p className="text-[11px] text-gray-500 font-medium mt-2">{stat.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Tactical Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Intelligence Log */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="lg:col-span-2 card-3d overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-brand-border/40 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-accent rounded-full animate-pulse"></span>
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-brand-accent">Live Intelligence Feed</h3>
                  </div>
                  <button onClick={handleRefresh} className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-white transition-colors">Sync Stream</button>
                </div>
                <ViolationLog violations={violations} />
              </motion.div>

              {/* Incident Stack */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="card-3d flex flex-col"
              >
                <div className="px-6 py-4 border-b border-brand-border/40" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-danger rounded-full animate-pulse"></span>
                    <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-brand-danger">Priority Incident Stack</h3>
                  </div>
                </div>
                <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                  {accidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                      <motion.p animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-4xl mb-4">🛸</motion.p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em]">All Clear</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {accidents.map((accident, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="p-4 rounded-xl glow-border-danger transition-all duration-200 hover:translate-x-1 cursor-pointer"
                          style={{ background: 'rgba(239,68,68,0.06)' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-brand-danger uppercase tracking-tight">
                              {accident.type || 'Collision Detected'}
                            </p>
                            <span className="text-[10px] font-semibold text-gray-500 tabular-nums">
                              {formatTimestamp(accident.timestamp).split(', ')[1]}
                            </span>
                          </div>
                          {accident.location && (
                            <div className="flex items-center gap-2 mt-2 opacity-60">
                              <span className="text-[10px]">📍</span>
                              <p className="text-[10px] font-medium truncate">{accident.location}</p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 mt-auto border-t border-brand-border/40">
                  <button 
                    onClick={() => navigate('/map')}
                    className="w-full btn-3d-danger py-3 text-[10px] font-bold uppercase tracking-[0.15em]"
                  >
                    Deploy Field Units
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Telemetry Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex items-center justify-between px-6 py-4 card-3d glow-border-accent"
              style={{ background: 'rgba(59,130,246,0.03)' }}
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-brand-success rounded-full shadow-glow-green"></div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Core Engine: 2.1.0-PRO</span>
                </div>
                <div className="w-px h-4 bg-brand-border/50"></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Node Status:</span>
                  <span className="text-[10px] font-bold text-brand-accent uppercase">Central Hub Online</span>
                </div>
              </div>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-tight">
                Session: <span className="text-gray-400">{Math.random().toString(36).substring(7).toUpperCase()}</span>
              </p>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
