import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'pdf', label: '📄 PDF Reports' },
    { id: 'severity', label: '⚠️ Severity Scoring' },
    { id: 'roles', label: '🔐 Role Access' },
    { id: 'cameras', label: '📹 Multi-Camera' },
    // { id: 'crowd', label: '👥 Crowd Detection' },
    { id: 'heatmap', label: '🔥 Risk Heatmap' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-white relative">
      <div className="bg-orb bg-orb-blue"></div>
      <div className="bg-orb bg-orb-purple"></div>

      {/* Header */}
      <nav className="glass-panel sticky top-0 z-[500] border-0 border-b border-brand-border/40" style={{ borderRadius: 0 }}>
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-accent/15 rounded-xl flex items-center justify-center border border-brand-accent/20 shadow-glow-blue">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">Core <span className="text-brand-accent">Config</span></h1>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Advanced Features & System Settings</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="nav-link-3d"
          >
            <span>←</span> Return to Dashboard
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="border-b border-brand-border/40 bg-white/5 backdrop-blur-sm relative z-10">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-2 py-4 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-3d whitespace-nowrap ${activeTab === tab.id ? 'tab-3d-active' : 'tab-3d-inactive'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-3d p-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-accent"></span>
                    Feature Overview
                  </h3>
                  <div className="space-y-4">
                    {[
                      { icon: '📄', title: 'PDF Reports', desc: 'Auto-generate incident reports' },
                      { icon: '⚠️', title: 'Severity Scoring', desc: 'AI classification (Low/Med/High)' },
                      { icon: '🔐', title: 'Role-Based Access', desc: 'Admin/Supervisor/Operator' },
                      { icon: '📹', title: 'Multi-Camera', desc: 'Manage multiple camera feeds' },
                      { icon: '👥', title: 'Crowd Detection', desc: 'Jaywalking alerts' },
                      { icon: '🔥', title: 'Risk Heatmap', desc: 'Predictive accident zones' },
                    ].map((feature, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-xl">{feature.icon}</span>
                        <div>
                          <p className="text-[11px] font-bold text-white uppercase tracking-wider">{feature.title}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{feature.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="card-3d p-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-success"></span>
                    Key Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-panel p-4 border-white/5 bg-white/5 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Incidents</p>
                      <p className="text-2xl font-black text-white tabular-nums">{mockIncidents.length}</p>
                    </div>
                    <div className="glass-panel p-4 border-white/5 glow-border-danger bg-brand-danger/10 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-danger mb-1">High Severity</p>
                      <p className="text-2xl font-black text-white tabular-nums">
                        {mockIncidents.filter((i) => i.severity === 'HIGH').length}
                      </p>
                    </div>
                    <div className="glass-panel p-4 border-white/5 glow-border-accent bg-brand-accent/10 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-accent mb-1">PDF Reports</p>
                      <p className="text-2xl font-black text-white tabular-nums">0</p>
                    </div>
                    <div className="glass-panel p-4 border-white/5 glow-border-success bg-brand-success/10 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-success mb-1">Active Cameras</p>
                      <p className="text-2xl font-black text-white tabular-nums">6</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Reports Tab */}
            {activeTab === 'pdf' && (
              <div className="card-3d p-6">
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <span className="text-lg">📄</span> Auto PDF Incident Reports
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">Every accident auto-generates a downloadable PDF with all details.</p>
                </div>

                <div className="space-y-4">
                  {mockIncidents.map((incident) => (
                    <div key={incident.id} className="glass-panel p-5 border-white/10 bg-white/5 hover:bg-white/10 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black/30 rounded-xl flex items-center justify-center border border-white/10">
                          <span className="text-xl">📊</span>
                        </div>
                        <div>
                          <p className="font-black text-sm text-white tracking-tight">{incident.id}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-brand-accent font-bold uppercase tracking-wider">{incident.location}</span>
                            <span className="text-gray-500 text-[10px]">•</span>
                            <span className="text-[10px] text-gray-500 font-mono">{new Date(incident.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <SeverityBadge
                          level={incident.severity}
                          vehicleCount={incident.vehicles_involved}
                          pedestrianCount={incident.pedestrians_detected}
                          speed={incident.speed || 0}
                        />
                        <button
                          onClick={() => handleGeneratePDF(incident)}
                          className="btn-3d-accent text-[10px] font-black uppercase tracking-widest h-10 px-4"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Severity Scoring Tab */}
            {activeTab === 'severity' && (
              <div className="card-3d p-6">
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <span className="text-lg">⚠️</span> Severity Classification
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    AI classifies accidents as Low / Medium / High based on vehicle count, speed, and pedestrian overlap.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {mockIncidents.map((incident) => (
                    <div key={incident.id} className="glass-panel p-5 border-white/10 bg-white/5 flex flex-col">
                      <div className="mb-4 pb-3 border-b border-white/10">
                        <p className="font-black text-sm text-white tracking-tight">{incident.id}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{incident.location}</p>
                      </div>
                      <div className="flex-1">
                        <SeverityBadge
                          level={incident.severity}
                          vehicleCount={incident.vehicles_involved}
                          pedestrianCount={incident.pedestrians_detected}
                          speed={incident.speed || 0}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-xl glow-border-accent bg-brand-accent/5 flex items-start gap-3">
                  <span className="text-brand-accent mt-0.5">ℹ️</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-accent mb-1">Scoring Criteria Matrix</p>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                      Vehicles (0-4 pts) + Pedestrians (0-3 pts) + Speed (0-3 pts) = Total severity score.<br/>
                      <span className="text-brand-danger font-bold">HIGH (≥8)</span>, <span className="text-brand-warning font-bold">MEDIUM (≥5)</span>, <span className="text-brand-success font-bold">LOW (&lt;5)</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Role-Based Access Tab */}
            {activeTab === 'roles' && (
              <div className="card-3d p-6">
                <RoleManager />
              </div>
            )}

            {/* Multi-Camera Tab */}
            {activeTab === 'cameras' && (
              <div className="card-3d p-6">
                <MultiCameraManager />
              </div>
            )}

            {/* Risk Heatmap Tab */}
            {activeTab === 'heatmap' && (
              <div className="card-3d p-6">
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <span className="text-lg">🔥</span> Predictive Risk Zone Heatmap
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    After 30+ incidents logged, AI highlights road segments with highest accident probability.
                  </p>
                </div>
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <RiskZoneHeatmap incidents={mockIncidents} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
