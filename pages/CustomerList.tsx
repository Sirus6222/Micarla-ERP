
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CustomerService, FinanceService } from '../services/store';
import { Customer, Invoice, InvoiceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Users, Phone, MapPin, Building, AlertTriangle, Wallet } from 'lucide-react';

export const CustomerList: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerFinancials, setCustomerFinancials] = useState<Record<string, { totalDebt: number, overdueAmount: number }>>({});
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCust, setNewCust] = useState<Partial<Customer>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
      setLoading(true);
      const [allCustomers, allInvoices] = await Promise.all([
          CustomerService.getAll(),
          FinanceService.getAllInvoices()
      ]);
      setCustomers(allCustomers);

      // Build lookup map in single pass O(n) instead of O(n*m) nested loop
      const financials: Record<string, { totalDebt: number, overdueAmount: number }> = {};
      const now = new Date();

      for (const inv of allInvoices) {
          if (!financials[inv.customerId]) {
            financials[inv.customerId] = { totalDebt: 0, overdueAmount: 0 };
          }
          financials[inv.customerId].totalDebt += inv.balanceDue;
          if (inv.status !== InvoiceStatus.PAID && new Date(inv.dueDate) < now) {
            financials[inv.customerId].overdueAmount += inv.balanceDue;
          }
      }
      
      setCustomerFinancials(financials);
      setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const handleSave = async () => {
      if(!newCust.name || !newCust.phone || !user) return;
      // Pass user as required by CustomerService.add for audit logging
      await CustomerService.add(newCust as Omit<Customer, 'id'>, user);
      await loadData();
      setShowAdd(false);
      setNewCust({});
  }

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-3xl font-bold text-stone-900">Customers</h2>
            <p className="text-stone-500 mt-1">Manage client contact details and financial status.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors">
          <Plus size={20} />
          Add Customer
        </button>
      </div>

      {/* Add Customer Form */}
      {showAdd && (
          <div className="mb-8 bg-white p-6 rounded-xl shadow-lg border border-primary-100 ring-4 ring-primary-50">
              <h3 className="text-lg font-bold mb-4 text-stone-800">New Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input className="border p-2 rounded" placeholder="Full Name *" value={newCust.name || ''} onChange={e => setNewCust({...newCust, name: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Company Name" value={newCust.companyName || ''} onChange={e => setNewCust({...newCust, companyName: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Phone Number *" value={newCust.phone || ''} onChange={e => setNewCust({...newCust, phone: e.target.value})} />
                  <input className="border p-2 rounded" placeholder="Email" value={newCust.email || ''} onChange={e => setNewCust({...newCust, email: e.target.value})} />
                  <input className="border p-2 rounded md:col-span-2" placeholder="Address" value={newCust.address || ''} onChange={e => setNewCust({...newCust, address: e.target.value})} />
              </div>
              <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded font-medium">Create Customer</button>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col">
        <div className="p-4 border-b border-stone-200 flex gap-4 items-center bg-stone-50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        {loading ? (
             <div className="p-12 text-center text-stone-400">Loading directory...</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-stone-50/50">
                {filtered.map(c => {
                    const financials = customerFinancials[c.id] || { totalDebt: 0, overdueAmount: 0 };
                    const hasOverdue = financials.overdueAmount > 0;
                    
                    return (
                        <Link key={c.id} to={`/customers/${c.id}`} className={`bg-white p-6 rounded-xl border hover:shadow-md transition-all group ${hasOverdue ? 'border-red-200 hover:border-red-400' : 'border-stone-200 hover:border-primary-500'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${hasOverdue ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-500 group-hover:bg-primary-50 group-hover:text-primary-600'}`}>
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900 truncate">{c.name}</h3>
                                    {c.companyName && <p className="text-xs text-stone-500 font-medium uppercase tracking-wide truncate">{c.companyName}</p>}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-stone-50 p-2 rounded border border-stone-100">
                                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-0.5">Total Debt</p>
                                    <p className="text-sm font-bold text-stone-800">ETB {formatCurrency(financials.totalDebt)}</p>
                                </div>
                                <div className={`p-2 rounded border ${hasOverdue ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'}`}>
                                    <p className={`text-[10px] uppercase font-bold mb-0.5 ${hasOverdue ? 'text-red-500' : 'text-stone-400'}`}>Overdue</p>
                                    <p className={`text-sm font-bold ${hasOverdue ? 'text-red-700' : 'text-stone-400'}`}>
                                        {hasOverdue ? `ETB ${formatCurrency(financials.overdueAmount)}` : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1 text-xs text-stone-500">
                                <div className="flex items-center gap-2">
                                    <Phone size={12} className="text-stone-400" />
                                    {c.phone}
                                </div>
                                {c.address && (
                                    <div className="flex items-center gap-2 truncate">
                                        <MapPin size={12} className="text-stone-400" />
                                        <span>{c.address}</span>
                                    </div>
                                )}
                            </div>
                        </Link>
                    )
                })}
            </div>
        )}
      </div>
    </div>
  );
};
