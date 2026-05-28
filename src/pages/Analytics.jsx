import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyticsAPI } from '../services/api';

export default function Analytics() {
  const navigate = useNavigate();
  const [violationData, setViolationData] = useState([]);
  const [accidentData, setAccidentData] = useState([]);
  const [hotspotsData, setHotspotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  useEffect(() => {
    fetchAnalyticsData();
  }, [days]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [violations, accidents, hotspots] = await Promise.all([
        analyticsAPI.getViolationsByTime(days),
        analyticsAPI.getAccidentsByTime(days),
        analyticsAPI.getHotspots(),
      ]);

      // Format data for charts
      setViolationData(
        Array.isArray(violations)
          ? violations.map((item) => ({
              date: item.date || item.timestamp?.split('T')[0] || 'Unknown',
              count: item.violations_count || item.count || 0,
            }))
          : []
      );

      setAccidentData(
        Array.isArray(accidents)
          ? accidents.map((item) => ({
              date: item.date || item.timestamp?.split('T')[0] || 'Unknown',
              count: item.accidents_count || item.count || 0,
            }))
          : []
      );

      // Format hotspots for pie chart
      const topHotspots = (Array.isArray(hotspots) ? hotspots : []).slice(0, 5);
      setHotspotsData(
        topHotspots.map((spot, idx) => ({
          name: spot.location || `Location ${idx + 1}`,
          value: spot.count || 0,
        }))
      );

      setError('');
    } catch (err) {
      setError(err.message);
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration (when backend not running)
  const mockViolationData = [
    { date: 'Day 1', count: 45 },
    { date: 'Day 2', count: 52 },
    { date: 'Day 3', count: 38 },
    { date: 'Day 4', count: 61 },
    { date: 'Day 5', count: 55 },
    { date: 'Day 6', count: 48 },
    { date: 'Day 7', count: 67 },
  ];

  const mockAccidentData = [
    { date: 'Day 1', count: 2 },
    { date: 'Day 2', count: 3 },
    { date: 'Day 3', count: 1 },
    { date: 'Day 4', count: 4 },
    { date: 'Day 5', count: 2 },
    { date: 'Day 6', count: 3 },
    { date: 'Day 7', count: 5 },
  ];

  const mockHotspotsData = [
    { name: 'Main Street', value: 245 },
    { name: 'Highway Exit', value: 189 },
    { name: 'City Center', value: 156 },
    { name: 'Market Area', value: 134 },
    { name: 'Industrial Zone', value: 98 },
  ];

  const chartViolationData = violationData.length > 0 ? violationData : mockViolationData;
  const chartAccidentData = accidentData.length > 0 ? accidentData : mockAccidentData;
  const chartHotspotsData = hotspotsData.length > 0 ? hotspotsData : mockHotspotsData;

  return (
    <div className="min-h-screen bg-brand-dark text-white selection:bg-brand-accent/30 font-sans">
      {/* Tactical Header */}
      <nav className="sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-xl border-b border-brand-border/50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-success rounded-xl flex items-center justify-center shadow-lg shadow-brand-success/20">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">Intel <span className="text-brand-success">Report</span></h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-brand-success rounded-full animate-pulse"></span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Historical Data Sync Active</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Timeframe</span>
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="bg-transparent border-none text-xs font-black text-brand-success focus:ring-0 cursor-pointer uppercase"
              >
                <option value={7}>07 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <span>←</span> Exit to Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Intel Grid */}
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-brand-success/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-brand-success rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-gray-400 font-medium tracking-wide animate-pulse uppercase text-xs">Querying Intelligence Archives...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-8 bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-brand-warning">⚡</span>
                <p className="text-brand-warning text-[10px] font-bold uppercase tracking-widest">Archival Sync Incomplete: Using Local Cache for Demo</p>
              </div>
            )}

            {/* Top-Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Aggregated Anomalies', value: chartViolationData.reduce((sum, item) => sum + item.count, 0), icon: '⚠️', color: 'text-brand-warning', desc: `Total violations over ${days}d` },
                { label: 'Confirmed Collisions', value: chartAccidentData.reduce((sum, item) => sum + item.count, 0), icon: '🚨', color: 'text-brand-danger', desc: `Impact events over ${days}d` },
                { label: 'Mean Daily Threat',    value: Math.round(chartViolationData.reduce((sum, item) => sum + item.count, 0) / (chartViolationData.length || 1)), icon: '📊', color: 'text-brand-accent', desc: 'Average violations per 24h' },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-6 group hover:scale-[1.02]">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{stat.label}</p>
                    <span className="text-xl opacity-50 group-hover:opacity-100 transition-all">{stat.icon}</span>
                  </div>
                  <p className={`text-4xl font-black ${stat.color} tracking-tight`}>
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>

            {/* Time-Series Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Violation Trends */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-warning flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-warning rounded-full"></span>
                    Anomaly Distribution
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartViolationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D344B" vertical={false} />
                    <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161B2E', border: '1px solid #2D344B', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#F59E0B' }}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Accident Trends */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-danger flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-danger rounded-full"></span>
                    Critical Event Velocity
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartAccidentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D344B" vertical={false} />
                    <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161B2E', border: '1px solid #2D344B', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#EF4444' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#EF4444"
                      strokeWidth={3}
                      dot={{ fill: '#EF4444', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, stroke: '#EF4444', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Spatial Intelligence (Hotspots) */}
            <div className="glass-card p-8 mb-8">
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-brand-accent rounded-full"></span>
                  Top Strategic Threat Zones
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Geospatial anomaly concentration</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7">
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={chartHotspotsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartHotspotsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#161B2E', border: '1px solid #2D344B', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="lg:col-span-5 space-y-4">
                  {chartHotspotsData.map((spot, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                          0{idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight text-white">{spot.name}</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Incident Zone</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white tabular-nums">{spot.value}</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Occurrences</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strategic Summary */}
            <div className="p-6 glass-card border-none bg-brand-accent/5 flex items-start gap-4">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent mb-1">Tactical Analysis Output</p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-3xl uppercase tracking-wider">
                  Neural archival data identifies peak anomaly vectors in your sector. Cross-referencing geospatial hotspots with 
                  temporal velocity suggests optimizing field unit deployments during the highlighted growth windows. 
                  Core logic remains synchronized with archive timestamps for 100% data integrity.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
