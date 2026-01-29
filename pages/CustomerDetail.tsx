
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CustomerService, QuoteService, FinanceService } from '../services/store';
import { Customer, Quote, QuoteStatus, Invoice, InvoiceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Phone, Mail, MapPin, Building, Clock, CheckCircle, DollarSign, Pencil, Save, X, AlertTriangle, Wallet } from 'lucide-react';

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | undefined>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (id) {
        try {
            const cust = await CustomerService.getById(id);
            setCustomer(cust);
            setEditForm(cust || {});
            if (cust) {
                const customerQuotes = await QuoteService.getByCustomerId(id);
                const allInvoices = await FinanceService.getAllInvoices();
                const customerInvoices = allInvoices.filter(i => i.customerId === id);
                
                setQuotes(customerQuotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                setInvoices(customerInvoices);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
  };

  const handleUpdateCustomer = async () => {
      if (!customer || !editForm.name || !user) return;
      const updated = { ...customer, ...editForm } as Customer;
      // Pass the current user for audit logging purposes
      await CustomerService.update(updated, user);
      setCustomer(updated);
      setIsEditing(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!customer) return <div className="p-8">Customer not found.</div>;

  const activeOrders = quotes.filter(q => 
    q.status !== QuoteStatus.DRAFT && 
    q.status !== QuoteStatus.SUBMITTED && 
    q.status !== QuoteStatus.COMPLETED &&
    q.status !== QuoteStatus.CANCELLED
  );
  
  // Revised Financial Stats (Source of Truth: Invoices)
  // Lifetime Value = Total Amount Paid on Invoices (Cash collected)
  const lifetimeValue = invoices.reduce((sum, i) => sum + i.amountPaid, 0);

  // Total Debt = Total Balance Due on Invoices
  const totalDebt = invoices.reduce((sum, i) => sum + i.balanceDue, 0);
  
  // Overdue Logic
  const overdueInvoices = invoices.filter(i => i.status === InvoiceStatus.OVERDUE || (i.status !== InvoiceStatus.PAID && new Date(i.dueDate) < new Date()));
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0);
  
  // Calculate oldest due date for debt aging context
  const oldestDue = overdueInvoices.length > 0 
    ? overdueInvoices.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].dueDate 
    : null;
  
  const daysOverdue = oldestDue 
    ? Math.floor((new Date().getTime() - new Date(oldestDue).getTime()) / (1000 * 3600 * 24)) 
    : 0;

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link to="/customers" className="flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-6">
        <ArrowLeft size={20} /> Back to List
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Profile */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 relative">
                <button 
                    onClick={() => setIsEditing(!isEditing)} 
                    className="absolute top-4 right-4 text-stone-400 hover:text-primary-600 p-2 hover:bg-primary-50 rounded-full"
                >
                    {isEditing ? <X size={20} /> : <Pencil size={20} />}
                </button>

                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 mb-4">
                    <span className="text-2xl font-bold">{customer.name.charAt(0)}</span>
                </div>

                {isEditing ? (
                    <div className="space-y-3">
                        <input 
                            className="w-full p-2 border rounded text-lg font-bold"
                            value={editForm.name} 
                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                            placeholder="Name"
                        />
                        <input 
                            className="w-full p-2 border rounded text-sm"
                            value={editForm.companyName} 
                            onChange={e => setEditForm({...editForm, companyName: e.target.value})}
                            placeholder="Company Name"
                        />
                         <input 
                            className="w-full p-2 border rounded text-sm"
                            value={editForm.phone} 
                            onChange={e => setEditForm({...editForm, phone: e.target.value})}
                            placeholder="Phone"
                        />
                        <input 
                            className="w-full p-2 border rounded text-sm"
                            value={editForm.email} 
                            onChange={e => setEditForm({...editForm, email: e.target.value})}
                            placeholder="Email"
                        />
                        <textarea 
                            className="w-full p-2 border rounded text-sm"
                            value={editForm.address} 
                            onChange={e => setEditForm({...editForm, address: e.target.value})}
                            placeholder="Address"
                        />
                        <button onClick={handleUpdateCustomer} className="w-full py-2 bg-primary-600 text-white rounded font-bold flex items-center justify-center gap-2">
                            <Save size={16} /> Save Changes
                        </button>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-stone-900">{customer.name}</h1>
                        {customer.companyName && (
                            <div className="flex items-center gap-2 text-stone-500 mt-1">
                                <Building size={16} />
                                <span className="font-medium">{customer.companyName}</span>
                            </div>
                        )}
                        
                        <div className="mt-6 space-y-4 pt-6 border-t border-stone-100">
                            <div className="flex items-center gap-3 text-stone-600">
                                <Phone size={18} className="text-stone-400" />
                                <span>{customer.phone}</span>
                            </div>
                            <div className="flex items-center gap-3 text-stone-600">
                                <Mail size={18} className="text-stone-400" />
                                <span>{customer.email}</span>
                            </div>
                            <div className="flex items-start gap-3 text-stone-600">
                                <MapPin size={18} className="text-stone-400 mt-1" />
                                <span>{customer.address}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Financial Health Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
                <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <Wallet size={18} className="text-stone-400" />
                    Financial Health
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                         <p className="text-xs text-stone-400 uppercase">Total Debt</p>
                         <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-stone-800' : 'text-green-600'}`}>
                             ETB {formatCurrency(totalDebt)}
                         </p>
                    </div>
                    <div>
                         <p className="text-xs text-stone-400 uppercase">Overdue</p>
                         <p className={`text-xl font-bold ${totalOverdue > 0 ? 'text-red-600' : 'text-stone-400'}`}>
                             ETB {formatCurrency(totalOverdue)}
                         </p>
                    </div>
                </div>

                {totalOverdue > 0 && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-bold text-red-800">Account Aging</p>
                            <p className="text-xs text-red-600">
                                Payment overdue by <span className="font-bold">{daysOverdue} days</span>.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-stone-100">
                     <p className="text-xs text-stone-400 uppercase mb-1">Lifetime Value (Paid)</p>
                     <p className="text-lg font-bold text-primary-700">ETB {formatCurrency(lifetimeValue)}</p>
                </div>
            </div>
        </div>

        {/* Right Column: Activity */}
        <div className="md:col-span-2 space-y-8">
            
            {/* Active Orders */}
            {activeOrders.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                        <Clock className="text-orange-600" size={20} />
                        <h3 className="font-bold text-orange-900">Orders In Progress</h3>
                    </div>
                    <div className="divide-y divide-stone-100">
                        {activeOrders.map(q => (
                            <Link key={q.id} to={`/quotes/${q.id}`} className="block p-4 hover:bg-stone-50 flex items-center justify-between group">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-stone-800">{q.number}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            q.status === QuoteStatus.IN_PRODUCTION ? 'bg-purple-100 text-purple-800' :
                                            q.status === QuoteStatus.READY ? 'bg-green-100 text-green-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>
                                            {q.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-stone-500 mt-1">
                                        {q.items.length} items • Placed {q.date}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-stone-900">ETB {formatCurrency(q.grandTotal)}</div>
                                    {q.depositAmount && (
                                        <div className="text-xs text-green-600">Dep: ETB {formatCurrency(q.depositAmount)}</div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* All Quotes History */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200">
                    <h3 className="font-bold text-stone-700">Order History</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-stone-50 text-stone-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="px-6 py-3">Ref</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {quotes.map(q => (
                            <tr key={q.id} className="hover:bg-stone-50">
                                <td className="px-6 py-4">
                                    <Link to={`/quotes/${q.id}`} className="font-mono text-primary-600 font-medium hover:underline">
                                        {q.number}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-600">{q.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        q.status === QuoteStatus.COMPLETED ? 'bg-stone-100 text-stone-600' :
                                        q.status === QuoteStatus.DRAFT ? 'bg-stone-100 text-stone-400' :
                                        'bg-blue-50 text-blue-600'
                                    }`}>
                                        {q.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium">ETB {formatCurrency(q.grandTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
      </div>
    </div>
  );
};
