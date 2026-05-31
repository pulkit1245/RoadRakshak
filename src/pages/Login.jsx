import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('other');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.login(email, password);
      if (role === 'hospital' || role === 'ambulance') {
        navigate('/hospital-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'hospital',  label: 'Hospital Staff',   icon: '🏥' },
    { id: 'ambulance', label: 'Ambulance Staff',   icon: '🚑' },
    { id: 'other',     label: 'Admin / Other',     icon: '🛡️' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="bg-orb bg-orb-blue"></div>
      <div className="bg-orb bg-orb-purple"></div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-accent/15 border border-brand-accent/20 mb-5 shadow-glow-blue"
          >
            <span className="text-3xl">🛡️</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RoadRakshak <span className="text-brand-accent">2.0</span></h1>
          <p className="text-sm text-gray-500 mt-1.5 font-medium">AI-Powered Traffic Management System</p>
        </div>

        {/* Login Card */}
        <div className="card-3d p-8">
          <h2 className="text-lg font-bold text-white mb-6">Sign In</h2>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3.5 rounded-xl glow-border-danger"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              <p className="text-brand-danger text-xs font-semibold">{error}</p>
            </motion.div>
          )}

          {/* Role Selection */}
          <div className="mb-6 flex gap-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 border ${
                  role === r.id
                    ? 'bg-brand-accent/12 border-brand-accent/30 text-brand-accent shadow-glow-blue'
                    : 'bg-white/3 border-white/8 text-gray-400 hover:bg-white/5 hover:text-gray-300'
                }`}
              >
                <span className="text-sm">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="judge@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="input-3d disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="input-3d disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 btn-3d-accent py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 rounded-xl glow-border-accent" style={{ background: 'rgba(59,130,246,0.05)' }}>
            <p className="text-xs text-brand-accent font-semibold mb-1.5">Demo Credentials</p>
            <p className="text-xs text-gray-400">Email: <span className="text-gray-300 font-mono">judge@test.com</span></p>
            <p className="text-xs text-gray-400">Password: <span className="text-gray-300 font-mono">password123</span></p>
          </div>

          {/* Dev Mode */}
          <button
            onClick={() => {
              localStorage.setItem('authToken', 'dev-test-token');
              navigate('/dashboard');
            }}
            className="w-full mt-4 btn-3d bg-white/5 text-gray-400 hover:text-white text-xs py-2.5"
          >
            🛠️ Dev Mode: Skip Login
          </button>

          {/* Footer */}
          <p className="text-center text-gray-600 text-xs mt-5 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-brand-success rounded-full"></span>
            Secure connection established
          </p>
        </div>

        {/* System Status */}
        <div className="mt-5 text-center">
          <p className="text-[10px] text-gray-600 font-medium">
            Backend: <span className="text-brand-success font-semibold">http://localhost:8000</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
