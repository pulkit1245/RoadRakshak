import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      // Call the backend login endpoint
      await authAPI.login(email, password);
      // On success, redirect to dashboard based on role
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🚦 RoadRakshak</h1>
          <p className="text-gray-600">AI-Powered Traffic Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-6 flex justify-center gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg font-semibold border transition-colors duration-200 ${role === 'hospital' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-300'}`}
              onClick={() => setRole('hospital')}
              disabled={loading}
            >
              Hospital Staff
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg font-semibold border transition-colors duration-200 ${role === 'ambulance' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-green-700 border-green-300'}`}
              onClick={() => setRole('ambulance')}
              disabled={loading}
            >
              Ambulance Staff
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg font-semibold border transition-colors duration-200 ${role === 'other' ? 'bg-gray-700 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
              onClick={() => setRole('other')}
              disabled={loading}
            >
              Other
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-1">Demo Credentials:</p>
            <p className="text-sm text-blue-800">Email: judge@test.com</p>
            <p className="text-sm text-blue-800">Password: password123</p>
          </div>

          {/* Dev Mode - Skip Login */}
          <button
            onClick={() => {
              localStorage.setItem('authToken', 'dev-test-token');
              navigate('/dashboard');
            }}
            className="w-full mt-4 bg-gray-600 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 text-sm"
          >
            🛠️ Dev Mode: Skip Login (for testing)
          </button>

          {/* Footer */}
          <p className="text-center text-gray-600 text-sm mt-6">
            🔐 Your credentials are secure and transmitted over HTTPS
          </p>
        </div>

        {/* System Status */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>Backend: <span className="text-green-600 font-semibold">http://localhost:8000</span></p>
        </div>
      </div>
    </div>
  );
}
