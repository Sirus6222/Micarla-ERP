
import React, { useState, useEffect } from 'react';
import { ProductService, AuditService } from '../services/store';
import { Product, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Pencil, AlertCircle, RefreshCw, Box, Tag, Layers, TrendingDown } from 'lucide-react';

export const ProductManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ change: 0, reason: '' });

  const load = async () => { setProducts(await ProductService.getAll()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleAdjust = async () => {
    if (!adjustingId || !user) return;
    await ProductService.adjustStock(adjustingId, adjustForm.change, user, adjustForm.reason);
    setAdjustingId(null);
    setAdjustForm({ change: 0, reason: '' });
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
         <div>
            <h2 className="text-2xl font-bold text-stone-900">{t('products')}</h2>
            <p className="text-sm text-stone-500">Inventory control and alerts.</p>
         </div>
         <button className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Plus size={20}/> {t('add_product')}</button>
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

               <button onClick={() => setAdjustingId(p.id)} className="w-full py-2 bg-stone-800 text-white rounded-lg text-xs font-bold transition-all hover:bg-black">Adjust Stock</button>

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
    </div>
  );
};
