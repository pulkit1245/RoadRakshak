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

        // Add new violation to list
        if (data.violation) {
          setViolations((prev) => [data.violation, ...prev.slice(0, 14)]);
        }

        // Add new accident to list and show alert
        if (data.accident) {
          setAccidents((prev) => [data.accident, ...prev.slice(0, 9)]);
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
    <div className="min-h-screen bg-gray-50">
      {/* Alert Banner */}
      {hasAccident && accidents.length > 0 && (
        <AlertBanner accident={accidents[0]} />
      )}

      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🚦 RoadRakshak Dashboard</h1>
            <p className="text-sm text-gray-600">Real-time Traffic Management System</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/live-feed')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              📹 Live Feed
            </button>
            <button
              onClick={() => navigate('/map')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
            >
              🗺️ Map View
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
            >
              📊 Analytics
            </button>
            <button
              onClick={() => navigate('/advanced')}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition text-sm font-medium"
            >
              ⚡ Advanced
            </button>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">
              ⚠️ {error} - Make sure backend is running on http://localhost:8000
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Frames Processed Card */}
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Frames Processed</p>
                    <p className="text-4xl font-bold text-blue-600 mt-2">
                      {stats.frames_processed?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-5xl">📹</div>
                </div>
                <p className="text-xs text-gray-500 mt-4">Real-time processing active</p>
              </div>

              {/* Violations Card */}
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Violations</p>
                    <p className="text-4xl font-bold text-yellow-600 mt-2">
                      {stats.total_violations?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-5xl">⚠️</div>
                </div>
                <p className="text-xs text-gray-500 mt-4">Traffic rule violations detected</p>
              </div>

              {/* Accidents Card */}
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition border-l-4 border-red-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Accidents</p>
                    <p className="text-4xl font-bold text-red-600 mt-2">
                      {stats.total_accidents?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-5xl">🚨</div>
                </div>
                <p className="text-xs text-gray-500 mt-4">Critical incidents reported</p>
              </div>

              {/* Ambulances Dispatched Card */}
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Ambulances Dispatched</p>
                    <p className="text-4xl font-bold text-green-600 mt-2">
                      {stats.ambulances_dispatched?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-5xl">🚑</div>
                </div>
                <p className="text-xs text-gray-500 mt-4">Emergency response active</p>
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Violation Log */}
              <div className="lg:col-span-2">
                <ViolationLog violations={violations} />
              </div>

              {/* Recent Accidents */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🚨 Recent Accidents</h3>
                {accidents.length === 0 ? (
                  <p className="text-gray-600 text-sm">No accidents reported</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {accidents.map((accident, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <p className="text-sm font-medium text-red-900">
                          {accident.type || 'Accident Detected'}
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          {formatTimestamp(accident.timestamp)}
                        </p>
                        {accident.location && (
                          <p className="text-xs text-red-600 mt-1">
                            📍 {accident.location}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* System Status */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ✅ System Status: <span className="font-semibold">Live Detection Active</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Backend: http://localhost:8000 | Frontend: Connected | WebSocket: {wsRef.current?.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
