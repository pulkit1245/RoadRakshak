import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MultiCameraManager from '../components/MultiCameraManager';
import RoleManager from '../components/RoleManager';
// import CrowdDetectionAlert from '../components/CrowdDetectionAlert';
import RiskZoneHeatmap from '../components/RiskZoneHeatmap';
import SeverityBadge from '../components/SeverityBadge';
import { generateIncidentPDF } from '../utils/pdfGenerator';

export default function AdvancedFeatures() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [mockIncidents] = useState([
    {
      id: 'INC-001',
      timestamp: new Date(),
      location: 'Main Street',
      latitude: 28.7041,
      longitude: 77.1025,
      severity: 'HIGH',
      vehicles_involved: 3,
      pedestrians_detected: 2,
      speed: 85,
      hospital_alerted: true,
      ambulance_dispatched: true,
      response_time: 5,
      nearest_hospital: 'City Medical Center',
      hospital_distance: 2.5,
      eta_minutes: 8,
      vehicle_count: 3,
      injury_risk_score: 8.5,
      violation_types: ['Speeding', 'Improper Lane Change'],
    },
    {
      id: 'INC-002',
      timestamp: new Date(Date.now() - 3600000),
      location: 'Highway Exit',
      latitude: 28.7052,
      longitude: 77.1045,
      severity: 'MEDIUM',
      vehicles_involved: 2,
      pedestrians_detected: 0,
      speed: 65,
      hospital_alerted: false,
      ambulance_dispatched: false,
      nearest_hospital: 'General Hospital',
      vehicle_count: 2,
      injury_risk_score: 5.2,
      violation_types: ['Traffic Signal Violation'],
    },
    {
      id: 'INC-003',
      timestamp: new Date(Date.now() - 7200000),
      location: 'Market Square',
      latitude: 28.7030,
      longitude: 77.1015,
      severity: 'LOW',
      vehicles_involved: 1,
      pedestrians_detected: 0,
      speed: 35,
      vehicle_count: 1,
      injury_risk_score: 1.5,
      violation_types: ['Parking Violation'],
    },
  ]);

  const mockCrowdData = {
    total_pedestrians: 45,
    jaywalking_count: 3,
    no_crossing_zone_count: 2,
    crowd_density: 0.65,
    is_crowded: true,
  };

  const handleGeneratePDF = async (incident) => {
    try {
      const filename = await generateIncidentPDF(incident, null);
      alert(`✓ PDF generated: ${filename}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚡ Advanced Features</h1>
            <p className="text-sm text-gray-600">PDF reports • Severity scoring • Multi-camera • Crowd detection • Predictive heatmap</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'pdf', label: '📄 PDF Reports' },
              { id: 'severity', label: '⚠️ Severity Scoring' },
              { id: 'roles', label: '🔐 Role Access' },
              { id: 'cameras', label: '📹 Multi-Camera' },
              // { id: 'crowd', label: '👥 Crowd Detection' },
              { id: 'heatmap', label: '🔥 Risk Heatmap' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-3 border-b-2 font-medium text-sm transition ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Feature Overview</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>PDF Reports</strong> - Auto-generate incident reports
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>Severity Scoring</strong> - AI classification (Low/Med/High)
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>Role-Based Access</strong> - Admin/Supervisor/Operator
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>Multi-Camera</strong> - Manage multiple camera feeds
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>Crowd Detection</strong> - Jaywalking alerts
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span> <strong>Risk Heatmap</strong> - Predictive accident zones
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Key Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Incidents</span>
                    <span className="font-bold text-gray-900">{mockIncidents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">High Severity</span>
                    <span className="font-bold text-red-600">
                      {mockIncidents.filter((i) => i.severity === 'HIGH').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PDF Reports Generated</span>
                    <span className="font-bold text-blue-600">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Cameras</span>
                    <span className="font-bold text-green-600">6</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Reports Tab */}
        {activeTab === 'pdf' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📄 Auto PDF Incident Reports</h3>
              <p className="text-gray-600 mb-6">Every accident auto-generates a downloadable PDF with all details.</p>

              <div className="space-y-4">
                {mockIncidents.map((incident) => (
                  <div key={incident.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{incident.id}</p>
                        <p className="text-sm text-gray-600">{incident.location}</p>
                        <p className="text-xs text-gray-500">{new Date(incident.timestamp).toLocaleString()}</p>
                      </div>
                      <SeverityBadge
                        level={incident.severity}
                        vehicleCount={incident.vehicles_involved}
                        pedestrianCount={incident.pedestrians_detected}
                        speed={incident.speed || 0}
                      />
                    </div>

                    <button
                      onClick={() => handleGeneratePDF(incident)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      📥 Download PDF Report
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Severity Scoring Tab */}
        {activeTab === 'severity' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Severity Classification</h3>
              <p className="text-gray-600 mb-6">
                AI classifies accidents as Low / Medium / High based on vehicle count, speed, and pedestrian overlap.
              </p>

              <div className="space-y-6">
                {mockIncidents.map((incident) => (
                  <div key={incident.id}>
                    <div className="mb-3">
                      <p className="font-semibold text-gray-900">{incident.id} - {incident.location}</p>
                    </div>
                    <SeverityBadge
                      level={incident.severity}
                      vehicleCount={incident.vehicles_involved}
                      pedestrianCount={incident.pedestrians_detected}
                      speed={incident.speed || 0}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Scoring Criteria:</strong> Vehicles (0-4 pts) + Pedestrians (0-3 pts) + Speed (0-3 pts) = Total severity
                  score. HIGH (≥8), MEDIUM (≥5), LOW (&lt;5)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Role-Based Access Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <RoleManager />
          </div>
        )}

        {/* Multi-Camera Tab */}
        {activeTab === 'cameras' && (
          <div className="space-y-6">
            <MultiCameraManager />
          </div>
        )}

        {/* /* Crowd Detection Tab
        {activeTab === 'crowd' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Crowd & Pedestrian Detection</h3>
              <p className="text-gray-600 mb-6">
                Detects jaywalking and pedestrian presence in no-crossing zones — alerts before accidents happen.
              </p>

              <CrowdDetectionAlert crowdData={mockCrowdData} pedestrianData={{ risk_level: 'MEDIUM', zone_name: 'Market Square' }} />
            </div>
          </div>
        )} */}

        {/* Risk Heatmap Tab */}
        {activeTab === 'heatmap' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Predictive Risk Zone Heatmap</h3>
              <p className="text-gray-600 mb-6">
                After 30+ incidents logged, AI highlights road segments with highest accident probability.
              </p>

              <RiskZoneHeatmap incidents={mockIncidents} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
