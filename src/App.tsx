import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Landing } from './pages/Landing';
import './lib/i18n';

const Layout = lazy(() => import('./components/Layout').then((module) => ({ default: module.Layout })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const GroupDetail = lazy(() => import('./pages/GroupDetail').then((module) => ({ default: module.GroupDetail })));
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })));
const Friends = lazy(() => import('./pages/Friends').then((module) => ({ default: module.Friends })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6] text-[#121212] dark:bg-[#121212] dark:text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1ed760] border-t-transparent" />
        <p className="text-sm font-bold text-slate-500 dark:text-[#b3b3b3]">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/group/:id" element={<GroupDetail />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
