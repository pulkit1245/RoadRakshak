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
      color: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-300',
      icon: '🔴',
      label: 'HIGH SEVERITY',
      description: 'Critical incident - immediate response required',
    },
    MEDIUM: {
      color: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-300',
      icon: '🟡',
      label: 'MEDIUM SEVERITY',
      description: 'Moderate incident - standard response',
    },
    LOW: {
      color: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-300',
      icon: '🟢',
      label: 'LOW SEVERITY',
      description: 'Minor incident - monitoring',
    },
  };

  const config = severityConfig[severity];

  return (
    <div className={`${config.color} border-2 ${config.borderColor} rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <div>
            <p className={`font-bold ${config.textColor}`}>{config.label}</p>
            <p className={`text-xs ${config.textColor} opacity-75`}>{config.description}</p>
          </div>
        </div>
      </div>

      {/* Risk Score */}
      <div className="mt-2 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className={config.textColor}>Vehicles:</span>
          <span className="font-semibold">{vehicleCount}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className={config.textColor}>Pedestrians:</span>
          <span className="font-semibold">{pedestrianCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={config.textColor}>Speed:</span>
          <span className="font-semibold">{speed} km/h</span>
        </div>
      </div>
    </div>
  );
}
