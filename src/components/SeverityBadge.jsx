import React from 'react';

export default function SeverityBadge({ level = 'MEDIUM', vehicleCount = 0, pedestrianCount = 0, speed = 0 }) {
  // Calculate severity based on multiple factors
  const calculateSeverity = () => {
    let score = 0;

    // Vehicle involvement (0-4 points)
    if (vehicleCount >= 5) score += 4;
    else if (vehicleCount >= 3) score += 3;
    else if (vehicleCount >= 2) score += 2;
    else if (vehicleCount >= 1) score += 1;

    // Pedestrian involvement (0-3 points)
    if (pedestrianCount >= 5) score += 3;
    else if (pedestrianCount >= 3) score += 2;
    else if (pedestrianCount >= 1) score += 1;

    // Speed (0-3 points)
    if (speed > 100) score += 3;
    else if (speed > 80) score += 2;
    else if (speed > 50) score += 1;

    // Determine severity level
    if (score >= 8) return 'HIGH';
    if (score >= 5) return 'MEDIUM';
    return 'LOW';
  };

  const severity = level || calculateSeverity();

  const severityConfig = {
    HIGH: {
      color: 'bg-brand-danger/10',
      textColor: 'text-brand-danger',
      borderColor: 'border-brand-danger/30',
      glow: 'glow-border-danger',
      icon: '🚨',
      label: 'HIGH SEVERITY',
      description: 'Critical incident - immediate response required',
      animation: 'animate-pulse',
    },
    MEDIUM: {
      color: 'bg-brand-warning/10',
      textColor: 'text-brand-warning',
      borderColor: 'border-brand-warning/30',
      glow: 'glow-border-warning',
      icon: '⚠️',
      label: 'MEDIUM SEVERITY',
      description: 'Moderate incident - standard response',
      animation: '',
    },
    LOW: {
      color: 'bg-brand-success/10',
      textColor: 'text-brand-success',
      borderColor: 'border-brand-success/30',
      glow: 'glow-border-success',
      icon: 'ℹ️',
      label: 'LOW SEVERITY',
      description: 'Minor incident - monitoring',
      animation: '',
    },
  };

  const config = severityConfig[severity];

  return (
    <div className={`card-3d p-4 ${config.glow}`} style={{ background: 'rgba(17,24,39,0.8)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${config.color} border border-transparent flex items-center justify-center`}>
            <span className={`text-xl ${config.animation}`}>{config.icon}</span>
          </div>
          <div>
            <p className={`font-black text-[11px] uppercase tracking-widest ${config.textColor}`}>{config.label}</p>
            <p className={`text-[10px] text-gray-400 mt-0.5`}>{config.description}</p>
          </div>
        </div>
      </div>

      {/* Risk Score */}
      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Vehicles</span>
          <span className="font-mono text-white text-xs">{vehicleCount}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Pedestrians</span>
          <span className="font-mono text-white text-xs">{pedestrianCount}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 font-bold uppercase tracking-wider">Speed</span>
          <span className="font-mono text-white text-xs">{speed} <span className="text-[9px] text-gray-500">km/h</span></span>
        </div>
      </div>
    </div>
  );
}
