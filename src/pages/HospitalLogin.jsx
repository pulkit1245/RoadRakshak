import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function HospitalLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hospital/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospital_code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Invalid hospital code');
      }
      const hospital = await res.json();
      localStorage.setItem('hospitalAuth', JSON.stringify(hospital));
      navigate('/hospital-dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-blue w-[500px] h-[500px] top-[-10%] left-[-10%]" />
      <div className="bg-orb bg-orb-purple w-[400px] h-[400px] bottom-[-10%] right-[-10%]" />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo area */}
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-accent/15 border border-brand-accent/30 mb-4 shadow-glow-blue animate-float"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <span className="text-4xl">🏥</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hospital Portal</h1>
          <p className="text-brand-accent/80 mt-2 text-sm">RoadRakshak — Emergency Response Network</p>
        </div>

        {/* Card */}
        <div className="card-3d p-8">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in with Hospital Code</h2>
          <p className="text-sm text-brand-muted mb-6">
            Enter your unique hospital access code to view live accident alerts.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Hospital Access Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. HOSP-AIIMS"
                className="input-3d w-full"
                autoFocus
                required
              />
            </div>

            {error && (
              <motion.div
                className="glass-panel glow-border-danger px-4 py-3"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-red-300 text-sm">⚠️ {error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-3d-accent w-full py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '🔄 Verifying…' : '→ Access Dashboard'}
            </button>
          </form>

          {/* Demo codes */}
          <div className="mt-6 pt-5 border-t border-brand-border">
            <p className="text-xs text-brand-muted mb-3">Demo access codes:</p>
            <div className="grid grid-cols-2 gap-2">
              {['HOSP-AIIMS', 'HOSP-APOLLO', 'HOSP-FORTIS', 'HOSP-MAX'].map((c) => (
                <motion.button
                  key={c}
                  onClick={() => setCode(c)}
                  className="card-3d text-xs text-slate-300 px-3 py-2 text-left font-mono hover:text-white hover:border-brand-accent/40 transition-colors"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {c}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-brand-muted/60 text-xs mt-6">
          Admin?{' '}
          <a href="/login" className="text-brand-accent hover:text-blue-300 underline transition-colors">
            Sign in to admin dashboard →
          </a>
        </p>
      </motion.div>
    </div>
  );
}
