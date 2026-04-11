import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

export default function RiskZoneHeatmap({ incidents = [] }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [statistics, setStatistics] = useState({
    highRiskZones: 0,
    mediumRiskZones: 0,
    totalIncidents: 0,
    incidentsNeeded: 30,
  });

  const defaultCenter = [28.7041, 77.1025]; // Delhi, India

  useEffect(() => {
    if (incidents.length > 0) {
      // Transform incidents into heatmap data points
      // Format: [[lat, lon, intensity (0-1)], ...]
      const heatData = incidents.map((incident) => {
        const intensity = Math.min(
          incident.severity === 'HIGH' ? 0.9 : incident.severity === 'MEDIUM' ? 0.5 : 0.2,
          1
        );
        return [
          incident.latitude || defaultCenter[0] + Math.random() * 0.1,
          incident.longitude || defaultCenter[1] + Math.random() * 0.1,
          intensity,
        ];
      });

      setHeatmapData(heatData);

      // Calculate statistics
      const highRisk = incidents.filter((i) => i.severity === 'HIGH').length;
      const mediumRisk = incidents.filter((i) => i.severity === 'MEDIUM').length;

      setStatistics({
        highRiskZones: Math.ceil(highRisk / 5),
        mediumRiskZones: Math.ceil(mediumRisk / 5),
        totalIncidents: incidents.length,
        incidentsNeeded: Math.max(0, 30 - incidents.length),
      });
    }
  }, [incidents]);

  // Mock heatmap data if no real incidents
  const mockHeatmapData = [
    [28.7041, 77.1025, 0.9],
    [28.7052, 77.1045, 0.8],
    [28.7030, 77.1015, 0.7],
    [28.7060, 77.1055, 0.6],
    [28.6950, 77.0950, 0.5],
    [28.7100, 77.1100, 0.4],
  ];

  const displayData = heatmapData.length > 0 ? heatmapData : mockHeatmapData;

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">High Risk Zones</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{statistics.highRiskZones}</p>
          <p className="text-xs text-red-600 mt-1">Immediate attention needed</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Medium Risk Zones</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{statistics.mediumRiskZones}</p>
          <p className="text-xs text-yellow-600 mt-1">Monitor closely</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total Incidents Logged</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{statistics.totalIncidents}</p>
          <p className="text-xs text-blue-600 mt-1">Used for prediction</p>
        </div>

        <div className={`border rounded-lg p-4 ${statistics.incidentsNeeded > 0 ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-sm ${statistics.incidentsNeeded > 0 ? 'text-gray-600' : 'text-green-600'}`}>
            {statistics.incidentsNeeded > 0 ? 'Incidents Until Prediction' : 'Prediction Active'}
          </p>
          <p className={`text-3xl font-bold mt-2 ${statistics.incidentsNeeded > 0 ? 'text-gray-700' : 'text-green-600'}`}>
            {statistics.incidentsNeeded > 0 ? statistics.incidentsNeeded : '✓'}
          </p>
          <p className={`text-xs mt-1 ${statistics.incidentsNeeded > 0 ? 'text-gray-500' : 'text-green-600'}`}>
            {statistics.incidentsNeeded > 0 ? 'Log 30+ for AI prediction' : 'AI actively learning'}
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="h-96 relative">
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Heat Map Visualization using Circle Markers */}
            {displayData.map((point, idx) => {
              const intensity = point[2];
              const color = intensity > 0.8 ? '#ff0000' : intensity > 0.5 ? '#ffaa00' : '#00ff00';
              const radius = 10 + intensity * 20;
              
              return (
                <CircleMarker
                  key={idx}
                  center={[point[0], point[1]]}
                  radius={radius}
                  fillColor={color}
                  color={color}
                  weight={2}
                  opacity={0.7}
                  fillOpacity={0.4}
                >
                  <Popup>
                    <div className="text-xs">
                      <p><strong>Risk Level:</strong> {intensity > 0.8 ? 'EXTREME' : intensity > 0.5 ? 'HIGH' : 'MEDIUM'}</p>
                      <p><strong>Coordinates:</strong> {point[0].toFixed(4)}, {point[1].toFixed(4)}</p>
                      <p><strong>Intensity:</strong> {(intensity * 100).toFixed(0)}%</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Risk Level Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="font-semibold text-gray-900 mb-3">🎨 Risk Level Interpretation</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded" style={{ backgroundColor: '#ff0000' }}></div>
            <div>
              <p className="font-semibold text-gray-900">Extreme Risk</p>
              <p className="text-xs text-gray-600">Multiple HIGH severity incidents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded" style={{ backgroundColor: '#ffaa00' }}></div>
            <div>
              <p className="font-semibold text-gray-900">High Risk</p>
              <p className="text-xs text-gray-600">Frequent MEDIUM/HIGH incidents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded" style={{ backgroundColor: '#00ff00' }}></div>
            <div>
              <p className="font-semibold text-gray-900">Low Risk</p>
              <p className="text-xs text-gray-600">Few LOW severity incidents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-3">🎯 Proactive Recommendations</h4>
        <ul className="text-sm text-green-800 space-y-2">
          {statistics.highRiskZones > 0 && (
            <li>
              ✓ <strong>Deploy Additional Resources:</strong> Position traffic officers in {statistics.highRiskZones} high-risk zone(s)
              during peak hours
            </li>
          )}
          {statistics.mediumRiskZones > 0 && (
            <li>
              ✓ <strong>Infrastructure Improvement:</strong> Review signal timing and road layout in {statistics.mediumRiskZones}{' '}
              medium-risk area(s)
            </li>
          )}
          <li>
            ✓ <strong>Public Awareness:</strong> Run campaigns in identified hotspots to reduce violations
          </li>
          <li>
            ✓ <strong>Speed Enforcement:</strong> Increase traffic cameras/fines in high-density accident zones
          </li>
          {statistics.incidentsNeeded > 0 && (
            <li>
              💡 <strong>Data Collection:</strong> Log {statistics.incidentsNeeded} more incidents to activate predictive AI analysis
            </li>
          )}
        </ul>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>How Prediction Works:</strong> After logging 30+ incidents, the AI analyzes patterns and highlights road
          segments with highest accident probability. This allows city planners to act proactively — adding signals, reducing
          speed limits, or improving infrastructure BEFORE more accidents occur.
        </p>
      </div>
    </div>
  );
}
