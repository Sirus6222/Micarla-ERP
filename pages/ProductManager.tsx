
import React, { useState, useEffect } from 'react';
import { ProductService, AuditService } from '../services/store';
import { Product, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Pencil, AlertCircle, RefreshCw, Box, Tag, Layers, TrendingDown, X } from 'lucide-react';

export const ProductManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ change: 0, reason: '' });

  // Create Product State
  const [showCreate, setShowCreate] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', sku: '', pricePerSqm: 0, defaultWastage: 15, thickness: 20, currentStock: 0, reorderPoint: 50, description: ''
  });

  const load = async () => { setProducts(await ProductService.getAll()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleAdjust = async () => {
    if (!adjustingId || !user) return;
    await ProductService.adjustStock(adjustingId, adjustForm.change, user, adjustForm.reason);
    setAdjustingId(null);
    setAdjustForm({ change: 0, reason: '' });
    load();
  };

  const handleCreate = async () => {
    if (!user || !newProduct.name || !newProduct.sku) {
        alert("Name and SKU are required");
        return;
    }
    try {
        await ProductService.add(newProduct as Omit<Product, 'id'>, user);
        setShowCreate(false);
        setNewProduct({ name: '', sku: '', pricePerSqm: 0, defaultWastage: 15, thickness: 20, currentStock: 0, reorderPoint: 50, description: '' });
        load();
    } catch (e) {
        console.error(e);
        alert("Failed to create product");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
         <div>
            <h2 className="text-2xl font-bold text-stone-900">{t('products')}</h2>
            <p className="text-sm text-stone-500">Inventory control and alerts.</p>
         </div>
         <button onClick={() => setShowCreate(true)} className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2 hover:bg-primary-700 transition-colors">
            <Plus size={20}/> Create Product
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => {
          const isLow = p.currentStock <= p.reorderPoint;
          return (
            <div key={p.id} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative group">
               <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg ${isLow ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <Box size={20} />
                  </div>
                  <button className="text-stone-300 hover:text-stone-800"><Pencil size={16}/></button>
               </div>
               <h3 className="font-bold text-stone-800 mb-1">{p.name}</h3>
               <p className="text-[10px] text-stone-400 font-mono mb-4">{p.sku}</p>
               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Availability</span>
                    <p className={`text-lg font-bold ${isLow ? 'text-red-600' : 'text-stone-800'}`}>{p.currentStock.toFixed(1)} m²</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Alert Level</span>
                    <p className="text-lg font-bold text-stone-800">{p.reorderPoint} m²</p>
                  </div>
               </div>
               
               {isLow && (
                 <div className="mb-4 flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle size={14} /> LOW STOCK ALERT
                 </div>
               )}

               <button onClick={() => setAdjustingId(p.id)} className="w-full py-2 bg-stone-800 text-white rounded-lg text-xs font-bold transition-all hover:bg-black">Update Stock</button>

               {adjustingId === p.id && (
                 <div className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 rounded-xl flex flex-col justify-center animate-in fade-in zoom-in duration-200 z-10">
                    <h4 className="font-bold text-stone-800 mb-4">Manual Adjustment</h4>
                    <div className="space-y-3 mb-6">
                       <input type="number" placeholder="Change (e.g. -5 or +10)" onChange={e => setAdjustForm({...adjustForm, change: Number(e.target.value)})} className="w-full p-2 border rounded-lg text-sm" />
                       <input type="text" placeholder="Reason (Required)" onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => setAdjustingId(null)} className="flex-1 py-2 text-stone-500 font-bold">Cancel</button>
                       <button onClick={handleAdjust} disabled={!adjustForm.reason} className="flex-1 py-2 bg-primary-600 text-white font-bold rounded-lg disabled:bg-stone-200">Submit</button>
                    </div>
                 </div>
               )}
            </div>
          )
        })}
      </div>

      {/* Create Product Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-xl">
                    <h3 className="font-bold text-stone-800">Create New Product</h3>
                    <button onClick={() => setShowCreate(false)} className="hover:bg-stone-200 p-1 rounded-full"><X size={20} className="text-stone-400" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Product Name *</label>
                            <input className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. Galaxy Black" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-stone-500 uppercase block mb-1">SKU *</label>
                            <input className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="e.g. GR-BLK-001" />
                        </div>
                        <div>
                             <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Price / m² (ETB)</label>
                             <input type="number" className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.pricePerSqm} onChange={e => setNewProduct({...newProduct, pricePerSqm: parseFloat(e.target.value)})} />
                        </div>
                         <div>
                             <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Thickness (mm)</label>
                             <input type="number" className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.thickness} onChange={e => setNewProduct({...newProduct, thickness: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                             <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Wastage %</label>
                             <input type="number" className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.defaultWastage} onChange={e => setNewProduct({...newProduct, defaultWastage: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                             <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Initial Stock</label>
                             <input type="number" className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.currentStock} onChange={e => setNewProduct({...newProduct, currentStock: parseFloat(e.target.value)})} />
                        </div>
                         <div>
                             <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Reorder Point</label>
                             <input type="number" className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.reorderPoint} onChange={e => setNewProduct({...newProduct, reorderPoint: parseFloat(e.target.value)})} />
                        </div>
                         <div className="col-span-2">
                            <label className="text-xs font-bold text-stone-500 uppercase block mb-1">Description</label>
                            <textarea className="w-full p-2 border border-stone-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500" value={newProduct.description || ''} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Product details..." />
                        </div>
                    </div>
                    <button onClick={handleCreate} className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-md transition-transform active:scale-95">Create Product</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
