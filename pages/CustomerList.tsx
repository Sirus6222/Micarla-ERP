
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CustomerService } from '../services/store';
import { Customer } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Users, Phone, MapPin, Building } from 'lucide-react';

export const CustomerList: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCust, setNewCust] = useState<Partial<Customer>>({});

  const loadCustomers = async () => {
      const all = await CustomerService.getAll();
      setCustomers(all);
  }

  useEffect(() => {
    loadCustomers();
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
      await loadCustomers();
      setShowAdd(false);
      setNewCust({});
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-3xl font-bold text-stone-900">Customers</h2>
            <p className="text-stone-500 mt-1">Manage client contact details and order history.</p>
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
                  <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded font-medium">Save Customer</button>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-stone-50/50">
            {filtered.map(c => (
                <Link key={c.id} to={`/customers/${c.id}`} className="bg-white p-6 rounded-xl border border-stone-200 hover:border-primary-500 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900">{c.name}</h3>
                            {c.companyName && <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{c.companyName}</p>}
                        </div>
                    </div>
                    <div className="space-y-2 text-sm text-stone-600">
                        <div className="flex items-center gap-2">
                            <Phone size={14} className="text-stone-400" />
                            {c.phone}
                        </div>
                        {c.address && (
                            <div className="flex items-start gap-2">
                                <MapPin size={14} className="text-stone-400 mt-0.5" />
                                <span className="flex-1">{c.address}</span>
                            </div>
                        )}
                    </div>
                </Link>
            ))}
        </div>
      </div>
    </div>
  );
};