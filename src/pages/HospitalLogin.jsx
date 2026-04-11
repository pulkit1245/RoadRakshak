import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4 shadow-lg shadow-blue-500/10">
            <span className="text-4xl">🏥</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hospital Portal</h1>
          <p className="text-blue-300 mt-2 text-sm">RoadRakshak — Emergency Response Network</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in with Hospital Code</h2>
          <p className="text-sm text-slate-400 mb-6">
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
                className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500
                           rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent transition"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-300 text-sm">⚠️ {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                         text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm
                         shadow-lg shadow-blue-500/20"
            >
              {loading ? '🔄 Verifying…' : '→ Access Dashboard'}
            </button>
          </form>

          {/* Demo codes */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-slate-500 mb-3">Demo access codes:</p>
            <div className="grid grid-cols-2 gap-2">
              {['HOSP-AIIMS', 'HOSP-APOLLO', 'HOSP-FORTIS', 'HOSP-MAX'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCode(c)}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300
                             px-3 py-1.5 rounded-lg transition text-left font-mono"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Admin?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-300 underline">
            Sign in to admin dashboard →
          </a>
        </p>
      </div>
    </div>
  );
}
