import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import VerifyMagicLink from './pages/VerifyMagicLink';
import Home from './pages/Home';
import Vote from './pages/Vote';
import Results from './pages/Results';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminEvents from './pages/admin/Events';
import AdminPizzaOptions from './pages/admin/PizzaOptions';
import AdminReport from './pages/admin/Report';
import AdminFindPizzaPlaces from './pages/admin/FindPizzaPlaces';
import NotFound from './pages/NotFound';
import LoadingScreen from './components/ui/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route path="/auth/verify" element={<VerifyMagicLink />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="vote" element={<Vote />} />
        <Route path="vote/:eventId" element={<Vote />} />
        <Route path="results" element={<Results />} />
        <Route path="results/:eventId" element={<Results />} />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="admin/events"
          element={
            <AdminRoute>
              <AdminEvents />
            </AdminRoute>
          }
        />
        <Route
          path="admin/events/:eventId/pizzas"
          element={
            <AdminRoute>
              <AdminPizzaOptions />
            </AdminRoute>
          }
        />
        <Route
          path="admin/events/:eventId/report"
          element={
            <AdminRoute>
              <AdminReport />
            </AdminRoute>
          }
        />
        <Route
          path="admin/events/:eventId/find-pizza"
          element={
            <AdminRoute>
              <AdminFindPizzaPlaces />
            </AdminRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
