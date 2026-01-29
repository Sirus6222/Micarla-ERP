import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { QuoteBuilder } from './pages/QuoteBuilder';
import { ProductManager } from './pages/ProductManager';
import { QuoteList } from './pages/QuoteList';
import { CustomerList } from './pages/CustomerList';
import { CustomerDetail } from './pages/CustomerDetail';
import { ProductionBoard } from './pages/ProductionBoard';
import { FinanceDashboard } from './pages/FinanceDashboard';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Procurement } from './pages/Procurement';
import { UserManagement } from './pages/UserManagement';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';

// Wrapper for protected routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center bg-stone-50 text-stone-500">Initializing...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;