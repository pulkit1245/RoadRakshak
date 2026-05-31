import React from 'react';
import { motion } from 'framer-motion';

export default function ViolationLog({ violations }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleString();
    const dt = new Date(timestamp);
    return Number.isNaN(dt.getTime()) ? String(timestamp) : dt.toLocaleString();
  };

  const severityColor = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'high':   return { bg: 'bg-brand-danger/8', border: 'border-l-brand-danger', text: 'text-brand-danger' };
      case 'medium': return { bg: 'bg-brand-warning/8', border: 'border-l-brand-warning', text: 'text-brand-warning' };
      default:       return { bg: 'bg-brand-accent/8', border: 'border-l-brand-accent', text: 'text-brand-accent' };
    }
  };

  return (
    <div className="p-4">
      {violations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 opacity-30">
          <p className="text-3xl mb-3">🛡️</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">No Violations Detected</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {violations.map((violation, idx) => {
            const sc = severityColor(violation.severity);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className={`p-3.5 rounded-xl ${sc.bg} border-l-[3px] ${sc.border} transition-all duration-200 hover:translate-x-1`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {violation.type || 'Traffic Violation'}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium mt-1 tabular-nums">
                      {formatTimestamp(violation.timestamp).split(', ')[1] || formatTimestamp(violation.timestamp)}
                    </p>
                    {violation.description && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">{violation.description}</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.text} ml-2 shrink-0`}>
                    {violation.severity || 'MEDIUM'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
