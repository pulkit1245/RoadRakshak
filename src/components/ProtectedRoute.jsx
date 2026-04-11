import React from 'react';
import { Navigate } from 'react-router-dom';
import { apiUtils } from '../services/api';

// ProtectedRoute - redirects to login if not authenticated
// In development, set TEST_MODE=true to bypass authentication
export default function ProtectedRoute({ children }) {
  const isAuthenticated = apiUtils.isAuthenticated();
  const TEST_MODE = import.meta.env.MODE === 'development'; // Always true in dev

  if (!isAuthenticated && !TEST_MODE) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
