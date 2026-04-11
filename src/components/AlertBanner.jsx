import React, { useEffect, useState } from 'react';

export default function AlertBanner({ accident }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [accident]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-pulse">
      <div className="bg-red-600 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">🚨</span>
            <div>
              <p className="font-bold text-lg">ACCIDENT DETECTED!</p>
              <p className="text-sm text-red-100">
                {accident?.location || 'Location unknown'} - {accident?.type || 'Critical incident'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-red-200 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
