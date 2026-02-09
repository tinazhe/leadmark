import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import TodayDashboard from './pages/TodayDashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import NewLead from './pages/NewLead';
import Settings from './pages/Settings';
import AccountSettings from './pages/settings/AccountSettings';
import WorkspaceSettings from './pages/settings/WorkspaceSettings';
import BillingSettings from './pages/settings/BillingSettings';
import TeamSettings from './pages/settings/TeamSettings';
import NotificationsSettings from './pages/settings/NotificationsSettings';
import RegionalSettings from './pages/settings/RegionalSettings';
import IntegrationsSettings from './pages/settings/IntegrationsSettings';
import AboutSettings from './pages/settings/AboutSettings';
import TeamInbox from './pages/TeamInbox';
import Layout from './components/Layout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayDashboard />} />
        <Route path="inbox" element={<TeamInbox />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/new" element={<NewLead />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/account" element={<AccountSettings />} />
        <Route path="settings/workspace" element={<WorkspaceSettings />} />
        <Route path="settings/billing" element={<BillingSettings />} />
        <Route path="settings/team" element={<TeamSettings />} />
        <Route path="settings/notifications" element={<NotificationsSettings />} />
        <Route path="settings/regional" element={<RegionalSettings />} />
        <Route path="settings/integrations" element={<IntegrationsSettings />} />
        <Route path="settings/about" element={<AboutSettings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
