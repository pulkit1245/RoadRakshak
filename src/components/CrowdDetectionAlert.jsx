import React from 'react';

export default function CrowdDetectionAlert({ crowdData = {}, pedestrianData = {} }) {
  const {
    total_pedestrians = 0,
    jaywalking_count = 0,
    no_crossing_zone_count = 0,
    crowd_density = 0,
    is_crowded = false,
  } = crowdData;

  const {
    in_safe_zone = true,
    risk_level = 'LOW',
    zone_name = 'Unknown',
  } = pedestrianData;

  const riskLevelConfig = {
    LOW: {
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-800',
      icon: '🟢',
      label: 'Safe',
    },
    MEDIUM: {
      color: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-800',
      icon: '🟡',
      label: 'Caution',
    },
    HIGH: {
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      icon: '🔴',
      label: 'High Risk',
    },
  };

  const config = riskLevelConfig[risk_level];

  return (
    <div className="space-y-4">
      {/* Crowd Density Alert */}
      {is_crowded && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="font-bold text-red-900">⚠️ HIGH CROWD DENSITY DETECTED</p>
          <p className="text-sm text-red-700 mt-1">
            {total_pedestrians} pedestrians detected. Crowd density: {(crowd_density * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {/* Jaywalking Alert */}
      {jaywalking_count > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <p className="font-bold text-yellow-900">⚠️ JAYWALKING DETECTED</p>
          <p className="text-sm text-yellow-700 mt-1">
            {jaywalking_count} pedestrian(s) crossing outside designated zones
          </p>
        </div>
      )}

      {/* No Crossing Zone Alert */}
      {no_crossing_zone_count > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="font-bold text-red-900">🚫 NO CROSSING ZONE VIOLATION</p>
          <p className="text-sm text-red-700 mt-1">
            {no_crossing_zone_count} pedestrian(s) detected in restricted areas
          </p>
        </div>
      )}

      {/* Pedestrian Safety Status */}
      <div className={`border-2 ${config.color} rounded-lg p-4`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className={`font-bold ${config.textColor} text-lg`}>
              {config.icon} Pedestrian Safety: {config.label}
            </p>
            <p className="text-sm text-gray-600 mt-1">Zone: {zone_name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-white p-2 rounded">
            <p className="text-gray-600">Total Pedestrians</p>
            <p className="text-xl font-bold text-gray-900">{total_pedestrians}</p>
          </div>
          <div className="bg-white p-2 rounded">
            <p className="text-gray-600">Jaywalking Count</p>
            <p className="text-xl font-bold text-yellow-600">{jaywalking_count}</p>
          </div>
          <div className="bg-white p-2 rounded">
            <p className="text-gray-600">No Crossing Violations</p>
            <p className="text-xl font-bold text-red-600">{no_crossing_zone_count}</p>
          </div>
          <div className="bg-white p-2 rounded">
            <p className="text-gray-600">Crowd Density</p>
            <p className="text-xl font-bold text-blue-600">{(crowd_density * 100).toFixed(0)}%</p>
          </div>
        </div>

        {!in_safe_zone && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded">
            <p className="text-sm font-semibold text-red-900">
              ⚠️ Pedestrians detected outside safe crossing zone
            </p>
          </div>
        )}
      </div>

      {/* Prevention Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-semibold text-blue-900 mb-2">💡 Preventive Measures</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Increase signage in high jaywalking zones</li>
          <li>✓ Deploy traffic officers during peak hours</li>
          <li>✓ Improve pedestrian crossing infrastructure</li>
          <li>✓ Educational campaigns in crowded areas</li>
        </ul>
      </div>
    </div>
  );
}
