
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
import { Procurement } from './pages/Procurement';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/quotes" element={<QuoteList />} />
          <Route path="/quotes/:id" element={<QuoteBuilder />} />
          <Route path="/products" element={<ProductManager />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/production" element={<ProductionBoard />} />
          <Route path="/finance" element={<FinanceDashboard />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
