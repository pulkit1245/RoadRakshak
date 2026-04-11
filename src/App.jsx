import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LiveFeed from './pages/LiveFeed'
import MapView from './pages/MapView'
import Analytics from './pages/Analytics'
import AdvancedFeatures from './pages/AdvancedFeatures'
import HospitalDashboard from './pages/HospitalDashboard'
import HospitalLogin from './pages/HospitalLogin'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Hospital auth — separate from admin JWT */}
        <Route path="/hospital-login" element={<HospitalLogin />} />
        <Route path="/hospital-dashboard" element={<HospitalDashboard />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/live-feed"
          element={
            <ProtectedRoute>
              <LiveFeed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced"
          element={
            <ProtectedRoute>
              <AdvancedFeatures />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
