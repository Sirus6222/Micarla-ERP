
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, DollarSign, FileText, CheckCircle, Activity, Wallet, 
  AlertCircle, ShieldAlert, TrendingUp, Package, RefreshCcw, 
  ArrowRight, Clock, Users, ChevronRight, AlertTriangle 
} from 'lucide-react';
import { QuoteService, FinanceService, CustomerService, ProductService, SystemService } from '../services/store';
import { Quote, QuoteStatus, Invoice, Role, Customer, Product, InvoiceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency } from '../utils/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageLoader, PageError } from '../components/PageStatus';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  
  // Data State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // UI State for Interactivity
  const [activeFilter, setActiveFilter] = useState<string>('default');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [q, i, c, p] = await Promise.all([
          QuoteService.getAll(),
          FinanceService.getAllInvoices(),
          CustomerService.getAll(),
          ProductService.getAll()
        ]);
        setQuotes(q.reverse());
        setInvoices(i);
        setCustomers(c);
        setProducts(p);
      } catch (err) {
        console.error('Dashboard load failed:', err);
        setError('Failed to load dashboard data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRestore = async () => {
    setShowRestoreConfirm(true);
  };

  const confirmRestore = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    await SystemService.restoreDemoData();
    window.location.reload();
  };

  if (loading || !user) return <PageLoader label="Loading Workspace..." />;
  if (error) return <PageError message={error} onRetry={() => window.location.reload()} />;

  // --- Components ---

  const StatCard = ({ 
    id, 
    label, 
    value, 
    subValue, 
    icon: Icon, 
    colorClass, 
    bgClass 
  }: { 
    id: string; 
    label: string; 
    value: string | number; 
    subValue?: string; 
    icon: any; 
    colorClass: string; 
    bgClass: string; 
  }) => {
    const isActive = activeFilter === id;
    return (
      <button
        onClick={() => setActiveFilter(isActive ? 'default' : id)}
        className={`w-full text-left p-5 rounded-xl border transition-all duration-200 shadow-sm group
          ${isActive
            ? 'border-primary-500 ring-1 ring-primary-500 bg-white'
            : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
          }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className={`p-3 rounded-lg ${bgClass} ${colorClass} group-hover:scale-110 transition-transform`}>
            <Icon size={20} />
          </div>
          {isActive && <div className={`w-2 h-2 rounded-full ${colorClass.replace('text', 'bg')}`} />}
        </div>
        <div>
          <h3 className="text-2xl font-bold text-stone-800">{value}</h3>
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mt-1">{label}</p>
          {subValue && <p className="text-[10px] text-stone-400 mt-1">{subValue}</p>}
        </div>
      </button>
    );
  };

  // --- Role Specific Logic ---

  const renderSalesView = () => {
    const drafts = quotes.filter(q => q.status === QuoteStatus.DRAFT);
    const submitted = quotes.filter(q => q.status === QuoteStatus.SUBMITTED);
    const approved = quotes.filter(q => q.status === QuoteStatus.APPROVED);
    const pipelineValue = quotes.filter(q => [QuoteStatus.DRAFT, QuoteStatus.SUBMITTED, QuoteStatus.APPROVED].includes(q.status))
      .reduce((a, b) => a + b.grandTotal, 0);

    let listData = quotes;
    let listTitle = "Recent Activity";

    if (activeFilter === 'drafts') {
      listData = drafts;
      listTitle = "Draft Quotes";
    } else if (activeFilter === 'submitted') {
      listData = submitted;
      listTitle = "Pending Approval";
    } else if (activeFilter === 'approved') {
      listData = approved;
      listTitle = "Ready to Order";
    } else {
      listData = quotes.slice(0, 5);
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Sales Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            id="default"
            label="Pipeline Value" 
            value={`ETB ${(pipelineValue/1000).toFixed(1)}k`} 
            subValue="Active Opportunities"
            icon={TrendingUp} 
            colorClass="text-blue-600" 
            bgClass="bg-blue-50" 
          />
          <StatCard 
            id="drafts"
            label="Drafts" 
            value={drafts.length} 
            icon={FileText} 
            colorClass="text-stone-600" 
            bgClass="bg-stone-100" 
          />
          <StatCard 
            id="submitted"
            label="In Review" 
            value={submitted.length} 
            icon={Clock} 
            colorClass="text-orange-600" 
            bgClass="bg-orange-50" 
          />
          <StatCard 
            id="approved"
            label="Approved" 
            value={approved.length} 
            icon={CheckCircle} 
            colorClass="text-green-600" 
            bgClass="bg-green-50" 
          />
        </div>

        {/* Actionable List */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
             <h3 className="font-bold text-stone-800 flex items-center gap-2">
               {listTitle} <span className="text-xs font-normal text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">{listData.length}</span>
             </h3>
             <Link to="/quotes/new" className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-primary-700 transition-colors">
               <Plus size={14} /> New Quote
             </Link>
           </div>
           
           <div className="divide-y divide-stone-100">
             {listData.length === 0 ? (
               <div className="p-12 text-center text-stone-400 italic">No quotes found in this category.</div>
             ) : (
               listData.map(q => (
                 <div 
                    key={q.id} 
                    onClick={() => navigate(`/quotes/${q.id}`)}
                    className="p-4 hover:bg-stone-50 transition-colors cursor-pointer flex items-center justify-between group"
                 >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        q.status === QuoteStatus.APPROVED ? 'bg-green-100 text-green-600' : 
                        q.status === QuoteStatus.SUBMITTED ? 'bg-orange-100 text-orange-600' : 
                        'bg-stone-100 text-stone-500'
                      }`}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-stone-800">{q.customerName || 'Unknown Customer'}</div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span className="font-mono">{q.number}</span>
                          <span>•</span>
                          <span>{new Date(q.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-bold text-stone-900">ETB {formatCurrency(q.grandTotal)}</div>
                        <span className={`text-[10px] font-bold uppercase ${
                           q.status === QuoteStatus.APPROVED ? 'text-green-600' : 
                           q.status === QuoteStatus.SUBMITTED ? 'text-orange-600' : 
                           'text-stone-400'
                        }`}>{q.status}</span>
                      </div>
                      <ChevronRight size={18} className="text-stone-300 group-hover:text-primary-600 transition-colors" />
                    </div>
                 </div>
               ))
             )}
           </div>
           {listData.length > 5 && activeFilter === 'default' && (
             <div className="p-3 bg-stone-50 border-t text-center">
               <Link to="/quotes" className="text-xs font-bold text-stone-500 hover:text-primary-600">View All Quotes</Link>
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderManagerView = () => {
    const pendingApprovals = quotes.filter(q => q.status === QuoteStatus.SUBMITTED);
    const lowStock = products.filter(p => p.currentStock <= p.reorderPoint);
    const completedThisMonth = quotes.filter(q => q.status === QuoteStatus.COMPLETED);
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            id="approvals"
            label="Pending Approvals" 
            value={pendingApprovals.length} 
            subValue="Requires Action"
            icon={ShieldAlert} 
            colorClass="text-red-600" 
            bgClass="bg-red-50" 
          />
          <StatCard 
            id="stock"
            label="Low Stock Alerts" 
            value={lowStock.length} 
            subValue="Below Reorder Point"
            icon={AlertTriangle} 
            colorClass="text-orange-600" 
            bgClass="bg-orange-50" 
          />
          <StatCard 
            id="completed"
            label="Completed Jobs" 
            value={completedThisMonth.length} 
            icon={CheckCircle} 
            colorClass="text-green-600" 
            bgClass="bg-green-50" 
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          {activeFilter === 'stock' ? (
             <>
                <div className="p-4 border-b border-stone-200 bg-orange-50 flex justify-between items-center">
                  <h3 className="font-bold text-orange-900 flex items-center gap-2">
                    <AlertTriangle size={18} /> Low Stock Products
                  </h3>
                  <Link to="/products" className="text-xs font-bold text-orange-700 hover:underline">Manage Inventory</Link>
                </div>
                <div className="divide-y divide-stone-100">
                   {lowStock.length === 0 ? <div className="p-8 text-center text-stone-400">Inventory levels are healthy.</div> : lowStock.map(p => (
                     <div key={p.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-stone-100 rounded text-stone-500"><Package size={20} /></div>
                           <div>
                              <div className="font-bold text-stone-800">{p.name}</div>
                              <div className="text-xs text-stone-500 font-mono">{p.sku}</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="font-bold text-red-600">{p.currentStock.toFixed(1)} m²</div>
                           <div className="text-[10px] text-stone-400">Reorder at {p.reorderPoint} m²</div>
                        </div>
                     </div>
                   ))}
                </div>
             </>
          ) : (
             <>
                <div className="p-4 border-b border-stone-200 bg-red-50 flex justify-between items-center">
                  <h3 className="font-bold text-red-900 flex items-center gap-2">
                    <ShieldAlert size={18} /> Approvals Needed
                  </h3>
                </div>
                <div className="divide-y divide-stone-100">
                   {pendingApprovals.length === 0 ? <div className="p-8 text-center text-stone-400">No pending approvals.</div> : pendingApprovals.map(q => (
                     <div key={q.id} className="p-4 flex items-center justify-between hover:bg-red-50/30 transition-colors">
                        <div>
                           <div className="font-bold text-stone-800">{q.customerName}</div>
                           <div className="text-xs text-stone-500 flex gap-2">
                             <span>{q.salesRepName}</span> • <span className="font-mono">{q.number}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="text-right">
                              <div className="font-bold text-stone-900">ETB {formatCurrency(q.grandTotal)}</div>
                              <div className="text-[10px] text-stone-400">{new Date(q.date).toLocaleDateString()}</div>
                           </div>
                           <button onClick={() => navigate(`/quotes/${q.id}`)} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
                             Review
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
             </>
          )}
        </div>
      </div>
    );
  };

  const renderFinanceView = () => {
    const overdue = invoices.filter(i => 
      i.status !== InvoiceStatus.PAID && 
      new Date(i.dueDate) < new Date()
    );
    const unpaid = invoices.filter(i => i.status !== InvoiceStatus.PAID);
    const totalOverdue = overdue.reduce((a,b) => a + b.balanceDue, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            id="overdue"
            label="Overdue Amount" 
            value={`ETB ${formatCurrency(totalOverdue)}`} 
            subValue={`${overdue.length} Invoices`}
            icon={AlertCircle} 
            colorClass="text-red-600" 
            bgClass="bg-red-50" 
          />
          <StatCard 
            id="unpaid"
            label="Total Outstanding" 
            value={`ETB ${formatCurrency(unpaid.reduce((a,b)=>a+b.balanceDue,0))}`} 
            icon={Wallet} 
            colorClass="text-orange-600" 
            bgClass="bg-orange-50" 
          />
          <StatCard 
            id="default"
            label="Cash Collected" 
            value={`ETB ${formatCurrency(invoices.reduce((a,b)=>a+b.amountPaid,0))}`} 
            icon={DollarSign} 
            colorClass="text-green-600" 
            bgClass="bg-green-50" 
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
             <h3 className="font-bold text-stone-800">
               {activeFilter === 'overdue' ? 'Overdue Invoices' : activeFilter === 'unpaid' ? 'All Unpaid Invoices' : 'Recent Transactions'}
             </h3>
             <Link to="/finance" className="text-xs font-bold text-primary-600 hover:underline">View All</Link>
           </div>
           <div className="divide-y divide-stone-100">
             {(activeFilter === 'overdue' ? overdue : activeFilter === 'unpaid' ? unpaid : invoices.slice(0, 5)).map(inv => (
               <div key={inv.id} className="p-4 flex justify-between items-center hover:bg-stone-50">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded ${inv.status === InvoiceStatus.OVERDUE || (inv.status !== InvoiceStatus.PAID && new Date(inv.dueDate) < new Date()) ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-500'}`}>
                        <FileText size={18} />
                     </div>
                     <div>
                        <div className="font-bold text-stone-800 text-sm">{inv.number}</div>
                        <div className="text-xs text-stone-500">{inv.customerName}</div>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-stone-900">ETB {formatCurrency(inv.balanceDue)}</div>
                     <div className="text-[10px] text-stone-400">Due: {inv.dueDate}</div>
                  </div>
               </div>
             ))}
             {overdue.length === 0 && activeFilter === 'overdue' && (
               <div className="p-8 text-center text-stone-400">No overdue invoices. Good job!</div>
             )}
           </div>
        </div>
      </div>
    );
  };

  const renderFactoryView = () => {
    const newOrders = quotes.filter(q => q.status === QuoteStatus.ORDERED);
    const inProduction = quotes.filter(q => q.status === QuoteStatus.IN_PRODUCTION);
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <StatCard 
            id="new"
            label="New Orders" 
            value={newOrders.length} 
            subValue="Require Acceptance"
            icon={Package} 
            colorClass="text-blue-600" 
            bgClass="bg-blue-50" 
          />
          <StatCard 
            id="production"
            label="In Production" 
            value={inProduction.length} 
            icon={Activity} 
            colorClass="text-purple-600" 
            bgClass="bg-purple-50" 
          />
          <StatCard 
            id="ready"
            label="Ready for Pickup" 
            value={quotes.filter(q => q.status === QuoteStatus.READY).length} 
            icon={CheckCircle} 
            colorClass="text-green-600" 
            bgClass="bg-green-50" 
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
             <h3 className="font-bold text-stone-800">
               {activeFilter === 'new' ? 'New Orders Waiting' : 'Production Floor'}
             </h3>
             <Link to="/production" className="text-xs font-bold text-primary-600 hover:underline">Go to Board</Link>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-stone-50/50">
              {(activeFilter === 'new' ? newOrders : inProduction).map(q => (
                 <div key={q.id} className="bg-white p-4 border border-stone-200 rounded-xl shadow-sm hover:border-primary-500 transition-colors cursor-pointer" onClick={() => navigate('/production')}>
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-600">{q.orderNumber || q.number}</span>
                       <span className="text-[10px] text-stone-400">{new Date(q.date).toLocaleDateString()}</span>
                    </div>
                    <div className="font-bold text-stone-800 mb-1">{q.customerName}</div>
                    <div className="text-xs text-stone-500 mb-3">{q.items.length} items</div>
                    <div className="flex items-center gap-1 text-xs font-bold text-primary-600">
                       View Job Sheet <ArrowRight size={12} />
                    </div>
                 </div>
              ))}
              {(activeFilter === 'new' ? newOrders : inProduction).length === 0 && (
                <div className="col-span-full p-8 text-center text-stone-400 italic">No orders in this status.</div>
              )}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{t('dashboard')}</h2>
          <p className="text-sm text-stone-500">Welcome back, {user.name} ({user.role})</p>
        </div>
        <button onClick={handleRestore} disabled={restoring} className="flex items-center gap-2 text-xs font-bold text-stone-400 hover:text-primary-600 bg-stone-100 px-3 py-2 rounded-lg transition-colors">
          <RefreshCcw size={12} className={restoring ? 'animate-spin' : ''} />
          {restoring ? 'Restoring...' : 'Reset Demo'}
        </button>
      </div>

      {/* ERP Source of Truth Summary - Admin & Manager overview */}
      {(user.role === Role.ADMIN || user.role === Role.MANAGER) && (
        <div className="mb-8 bg-gradient-to-r from-stone-900 to-stone-800 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-500 rounded flex items-center justify-center text-stone-900 text-lg font-extrabold">G</div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">GraniteFlow ERP — Source of Truth</h3>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">Real-time Business Overview</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Total Quotes</div>
              <div className="text-xl font-bold">{quotes.length}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Active Orders</div>
              <div className="text-xl font-bold">{quotes.filter(q => [QuoteStatus.ORDERED, QuoteStatus.ACCEPTED, QuoteStatus.IN_PRODUCTION, QuoteStatus.READY].includes(q.status)).length}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Revenue Collected</div>
              <div className="text-xl font-bold">ETB {(invoices.reduce((a,b) => a + b.amountPaid, 0) / 1000).toFixed(0)}k</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Outstanding</div>
              <div className="text-xl font-bold text-orange-300">ETB {(invoices.reduce((a,b) => a + b.balanceDue, 0) / 1000).toFixed(0)}k</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Low Stock Items</div>
              <div className="text-xl font-bold text-red-300">{products.filter(p => p.currentStock <= p.reorderPoint).length}</div>
            </div>
          </div>
        </div>
      )}

      {(user.role === Role.SALES_REP || user.role === Role.ADMIN) && (
        <div className={user.role === Role.ADMIN ? "mb-12 border-b border-stone-200 pb-8" : ""}>
          {user.role === Role.ADMIN && <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Sales View</h3>}
          {renderSalesView()}
        </div>
      )}
      {(user.role === Role.MANAGER || user.role === Role.ADMIN) && (
        <div className={user.role === Role.ADMIN ? "mb-12 border-b border-stone-200 pb-8" : ""}>
           {user.role === Role.ADMIN && <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Manager View</h3>}
           {renderManagerView()}
        </div>
      )}
      {(user.role === Role.FINANCE || user.role === Role.ADMIN) && (
        <div className={user.role === Role.ADMIN ? "mb-12 border-b border-stone-200 pb-8" : ""}>
           {user.role === Role.ADMIN && <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Finance View</h3>}
           {renderFinanceView()}
        </div>
      )}
      {(user.role === Role.FACTORY || user.role === Role.ADMIN) && (
        <div className={user.role === Role.ADMIN ? "" : ""}>
           {user.role === Role.ADMIN && <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Factory View</h3>}
           {renderFactoryView()}
        </div>
      )}

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restore Demo Data"
        message="This will overwrite existing records with the same IDs. Are you sure?"
        confirmLabel="Restore"
        variant="danger"
        onConfirm={confirmRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
};
