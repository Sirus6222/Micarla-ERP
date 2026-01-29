
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, DollarSign, FileText, CheckCircle, Activity, Wallet, AlertCircle, ShieldAlert, TrendingUp, Package } from 'lucide-react';
import { QuoteService, FinanceService, CustomerService } from '../services/store';
import { Quote, QuoteStatus, Invoice, Role, Customer } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    quotes: [] as Quote[],
    invoices: [] as Invoice[],
    customers: [] as Customer[]
  });

  useEffect(() => {
    const load = async () => {
      const [q, i, c] = await Promise.all([QuoteService.getAll(), FinanceService.getAllInvoices(), CustomerService.getAll()]);
      setData({ quotes: q, invoices: i, customers: c });
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !user) return <div className="p-12 text-center text-stone-400">Loading Workspace...</div>;

  const Stat = ({ label, val, icon: Icon, color }: any) => (
    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-xl font-bold text-stone-800">{val}</h3>
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );

  // ROLE SPECIFIC VIEWS
  const renderSalesView = () => {
    const pipeline = data.quotes.filter(q => [QuoteStatus.DRAFT, QuoteStatus.SUBMITTED].includes(q.status)).reduce((a, b) => a + b.grandTotal, 0);
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat label={t('pipeline')} val={`ETB ${pipeline.toLocaleString()}`} icon={TrendingUp} color="bg-blue-500" />
          <Stat label="Recent Quotes" val={data.quotes.length} icon={FileText} color="bg-indigo-500" />
          <Stat label="Conversion Rate" val="42%" icon={Activity} color="bg-orange-500" />
        </div>
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 border-b bg-stone-50 font-bold text-stone-700 flex justify-between items-center">
             <span>Quick Access</span>
             <Link to="/quotes/new" className="text-xs bg-primary-600 text-white px-3 py-1 rounded-lg">New Quote</Link>
           </div>
           <table className="w-full text-left text-sm">
             <tbody className="divide-y">
               {data.quotes.slice(0, 5).map(q => (
                 <tr key={q.id} className="hover:bg-stone-50">
                    <td className="p-3 font-mono text-stone-500">{q.number}</td>
                    <td className="p-3 font-medium">{q.customerName}</td>
                    <td className="p-3 text-right font-bold text-primary-600">ETB {q.grandTotal.toLocaleString()}</td>
                    <td className="p-3 text-right"><span className="text-[10px] font-bold uppercase text-stone-400">{q.status}</span></td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    );
  };

  const renderManagerView = () => {
    const pending = data.quotes.filter(q => q.status === QuoteStatus.SUBMITTED);
    const risks = data.customers.filter(c => c.creditHold || c.creditLimit < 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat label={t('approvals')} val={pending.length} icon={ShieldAlert} color="bg-red-500" />
          <Stat label={t('credit_risks')} val={risks.length} icon={AlertCircle} color="bg-orange-500" />
          <Stat label="WIP Value" val={`ETB ${data.quotes.filter(q => q.status === QuoteStatus.IN_PRODUCTION).reduce((a,b)=>a+b.grandTotal,0).toLocaleString()}`} icon={Activity} color="bg-purple-500" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl shadow-sm">
             <div className="p-4 border-b bg-red-50 font-bold text-red-800">Quotes Pending Approval</div>
             <div className="p-2 space-y-2">
               {pending.length === 0 ? <p className="p-8 text-center text-stone-400 text-sm italic">No pending approvals</p> : pending.map(q => (
                 <Link key={q.id} to={`/quotes/${q.id}`} className="flex justify-between p-3 border rounded hover:bg-stone-50 transition-colors">
                    <div>
                      <div className="font-bold text-sm">{q.customerName}</div>
                      <div className="text-[10px] text-stone-400">{q.salesRepName}</div>
                    </div>
                    <div className="text-right font-bold text-primary-600">ETB {q.grandTotal.toLocaleString()}</div>
                 </Link>
               ))}
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinanceView = () => {
    const totalDebt = data.invoices.reduce((a,b)=>a+b.balanceDue,0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat label={t('outstanding')} val={`ETB ${totalDebt.toLocaleString()}`} icon={Wallet} color="bg-red-600" />
          <Stat label="Total Cash" val={`ETB ${data.invoices.reduce((a,b)=>a+b.amountPaid,0).toLocaleString()}`} icon={DollarSign} color="bg-green-600" />
          <Stat label="Overdue count" val={data.invoices.filter(i => i.status === 'Overdue').length} icon={AlertCircle} color="bg-orange-600" />
        </div>
      </div>
    );
  };

  const renderFactoryView = () => {
    const activeJobs = data.quotes.filter(q => [QuoteStatus.ACCEPTED, QuoteStatus.IN_PRODUCTION].includes(q.status));
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border rounded-xl shadow-sm">
           <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
             <Activity className="text-primary-600" /> {t('job_sheets')}
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {activeJobs.map(j => (
               <div key={j.id} className="p-4 border rounded-xl hover:border-primary-500 transition-colors group">
                 <div className="flex justify-between text-[10px] font-bold text-stone-400 mb-2">
                   <span>{j.orderNumber}</span>
                   <span className="text-primary-600 uppercase">{j.status}</span>
                 </div>
                 <div className="font-bold text-stone-800 mb-3">{j.customerName}</div>
                 <Link to="/production" className="w-full block py-2 bg-stone-100 group-hover:bg-primary-600 group-hover:text-white rounded text-center text-xs font-bold transition-colors">View Job Sheet</Link>
               </div>
             ))}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{t('dashboard')}</h2>
          <p className="text-sm text-stone-500">{user.role} Control Panel</p>
        </div>
      </div>
      {user.role === Role.SALES_REP && renderSalesView()}
      {user.role === Role.MANAGER && renderManagerView()}
      {user.role === Role.FINANCE && renderFinanceView()}
      {user.role === Role.FACTORY && renderFactoryView()}
    </div>
  );
};
