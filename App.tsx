import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { useAuth } from './contexts/AuthContext';

// Lazy-loaded page components for code splitting
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const QuoteBuilder = React.lazy(() => import('./pages/QuoteBuilder').then(m => ({ default: m.QuoteBuilder })));
const ProductManager = React.lazy(() => import('./pages/ProductManager').then(m => ({ default: m.ProductManager })));
const QuoteList = React.lazy(() => import('./pages/QuoteList').then(m => ({ default: m.QuoteList })));
const CustomerList = React.lazy(() => import('./pages/CustomerList').then(m => ({ default: m.CustomerList })));
const CustomerDetail = React.lazy(() => import('./pages/CustomerDetail').then(m => ({ default: m.CustomerDetail })));
const ProductionBoard = React.lazy(() => import('./pages/ProductionBoard').then(m => ({ default: m.ProductionBoard })));
const FinanceDashboard = React.lazy(() => import('./pages/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const InvoiceDetail = React.lazy(() => import('./pages/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const Procurement = React.lazy(() => import('./pages/Procurement').then(m => ({ default: m.Procurement })));
const UserManagement = React.lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));

const AppLoader = () => (
  <div className="h-screen flex flex-col items-center justify-center gap-3 bg-stone-50">
    <Loader2 size={28} className="animate-spin text-primary-500" />
    <span className="text-sm font-medium text-stone-400">Loading...</span>
  </div>
);

// Wrapper for protected routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError } = useAuth();

  if (authError) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 p-8">
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
        <WifiOff size={24} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-stone-800 mb-1">Connection problem</p>
        <p className="text-sm text-stone-500">Check your internet connection and try again.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors"
      >
        <RefreshCw size={14} />
        Refresh
      </button>
    </div>
  );

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-stone-50">
      <Loader2 size={28} className="animate-spin text-primary-500" />
      <span className="text-sm font-medium text-stone-400">Initializing...</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ErrorBoundary>
    <Router>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute><QuoteList /></ProtectedRoute>} />
          <Route path="/quotes/:id" element={<ProtectedRoute><QuoteBuilder /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductManager /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
          <Route path="/production" element={<ProtectedRoute><ProductionBoard /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><FinanceDashboard /></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
          <Route path="/procurement" element={<ProtectedRoute><Procurement /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
