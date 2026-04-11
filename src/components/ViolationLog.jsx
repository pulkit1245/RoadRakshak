import React from 'react';

export default function ViolationLog({ violations }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleString();
    const dt = new Date(timestamp);
    return Number.isNaN(dt.getTime()) ? String(timestamp) : dt.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Recent Violations</h3>
      {violations.length === 0 ? (
        <p className="text-gray-600 text-sm">No violations detected</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {violations.map((violation, idx) => (
            <div
              key={idx}
              className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">
                    {violation.type || 'Traffic Violation'}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {formatTimestamp(violation.timestamp)}
                  </p>
                  {violation.description && (
                    <p className="text-xs text-yellow-600 mt-1">{violation.description}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-yellow-600 ml-2">
                  {violation.severity || 'MEDIUM'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
