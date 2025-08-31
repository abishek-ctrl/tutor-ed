import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // You can replace this with a fancy loading spinner component
    return <div className="h-screen flex items-center justify-center bg-zinc-900 text-zinc-400 font-sans">Loading authentication status…</div>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}