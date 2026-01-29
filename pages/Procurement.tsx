
import React, { useState, useEffect } from 'react';
import { ProductService, StockService } from '../services/store';
import { Product, StockRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { PackagePlus, History, Search, Plus, Calendar, User, FileText, TrendingUp } from 'lucide-react';

export const Procurement: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    reference: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [prods, hist] = await Promise.all([
      ProductService.getAll(),
      StockService.getHistory()
    ]);
    setProducts(prods);
    setHistory(hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.productId || !formData.quantity) return;
    
    try {
      await StockService.recordStockIn(
        formData.productId, 
        parseFloat(formData.quantity), 
        formData.reference, 
        user
      );
      setFormData({ productId: '', quantity: '', reference: '' });
      await loadData();
      alert("Stock recorded successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to record stock.");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 flex items-center gap-2">
          <PackagePlus className="text-primary-600" />
          Procurement (Stock In)
        </h2>
        <p className="text-stone-500 mt-1">Record newly arrived granite slabs and update inventory levels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Record Stock Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
            <h3 className="font-bold text-stone-800 mb-6 flex items-center gap-2 uppercase text-xs tracking-wider">
              <Plus size={16} /> Record New Entry
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Select Product</label>
                <select 
                  className="w-full p-2.5 border border-stone-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.productId}
                  onChange={e => setFormData({...formData, productId: e.target.value})}
                  required
                >
                  <option value="">-- Choose Granite --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Quantity (m²)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full p-2.5 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">PO / Invoice Reference</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. PO-2024-001"
                  value={formData.reference}
                  onChange={e => setFormData({...formData, reference: e.target.value})}
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-sm transition-colors mt-2"
              >
                Add to Inventory
              </button>
            </form>
          </div>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
              <h3 className="font-bold text-stone-700 flex items-center gap-2">
                <History size={18} />
                Recent Procurement History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3 text-right">Quantity</th>
                    <th className="px-6 py-3 text-right">Recorder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-stone-400">Loading history...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-stone-400">No records found.</td></tr>
                  ) : history.map(rec => (
                    <tr key={rec.id} className="hover:bg-stone-50">
                      <td className="px-6 py-4 text-xs text-stone-600">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-stone-400" />
                          {new Date(rec.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-800 text-sm">{rec.productName}</td>
                      <td className="px-6 py-4 text-xs text-stone-500">
                        <div className="flex items-center gap-1">
                          <FileText size={12} className="text-stone-400" />
                          {rec.reference || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-green-600">+{rec.quantity.toFixed(1)} m²</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-stone-500">
                        <div className="flex items-center justify-end gap-1">
                          <User size={12} />
                          {rec.recordedBy}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
