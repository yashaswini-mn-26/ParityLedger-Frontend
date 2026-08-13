import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import ProjectsHome from './pages/ProjectsHome';
import ProjectLayout from './pages/ProjectLayout';
import ProjectDashboard from './pages/ProjectDashboard';
import PageDetail from './pages/PageDetail';
import QueryDrilldown from './pages/QueryDrilldown';
import UsersAdmin from './pages/UsersAdmin';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><ProjectsHome /></ProtectedRoute>} />

            <Route path="/admin/users" element={
              <ProtectedRoute roles={['admin']}><UsersAdmin /></ProtectedRoute>
            } />

            <Route path="/projects/:projectId" element={
              <ProtectedRoute><ProjectLayout /></ProtectedRoute>
            }>
              <Route index element={<ProjectDashboard />} />
              <Route path="pages/:pageId" element={<PageDetail />} />
              <Route path="pages/:pageId/queries/:type" element={<QueryDrilldown />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
