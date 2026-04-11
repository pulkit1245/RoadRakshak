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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
            <p className="text-sm text-gray-600">Historical traffic violations & accidents</p>
          </div>
          <div className="flex gap-3">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              ℹ️ {error} - Showing mock data for demonstration
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Violations Over Time */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Violations Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartViolationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#F59E0B" name="Violations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Accidents Over Time */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🚨 Accidents Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartAccidentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#EF4444"
                      name="Accidents"
                      strokeWidth={2}
                      dot={{ fill: '#EF4444', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hotspots Pie Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Violation Hotspots (Top 5)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={chartHotspotsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartHotspotsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Violations */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Total Violations</p>
                <p className="text-4xl font-bold text-yellow-600 mt-2">
                  {chartViolationData.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="text-xs text-gray-500 mt-4">Over last {days} days</p>
              </div>

              {/* Total Accidents */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Total Accidents</p>
                <p className="text-4xl font-bold text-red-600 mt-2">
                  {chartAccidentData.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="text-xs text-gray-500 mt-4">Over last {days} days</p>
              </div>

              {/* Average Daily Violations */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Avg Daily Violations</p>
                <p className="text-4xl font-bold text-blue-600 mt-2">
                  {chartViolationData.length > 0
                    ? Math.round(chartViolationData.reduce((sum, item) => sum + item.count, 0) / chartViolationData.length)
                    : 0}
                </p>
                <p className="text-xs text-gray-500 mt-4">Average per day</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💡 <strong>Insights:</strong> This dashboard shows historical trends to help identify peak violation times and high-risk locations. Use this data to optimize patrol schedules and traffic management strategies.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
