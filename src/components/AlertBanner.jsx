import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AlertBanner({ accident }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => setIsVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [accident]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[60]"
        >
          <div className="glass-panel border-b border-brand-danger/30 px-6 py-4 glow-border-danger"
               style={{ background: 'rgba(239,68,68,0.08)', backdropFilter: 'blur(24px)' }}>
            <div className="max-w-[1600px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-danger/20 flex items-center justify-center shadow-glow-red">
                  <span className="text-xl animate-pulse">🚨</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-brand-danger uppercase tracking-wide">Accident Detected</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {accident?.location || 'Location unknown'} — {accident?.type || 'Critical incident'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
