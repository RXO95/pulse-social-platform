import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Still checking token → show something
  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  // Not logged in → redirect
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in → render page
  return children;
}
