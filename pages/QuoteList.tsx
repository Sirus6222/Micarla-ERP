
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QuoteService } from '../services/store';
import { Quote } from '../types';
import { Plus, FileText, RefreshCw } from 'lucide-react';

export const QuoteList: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const all = await QuoteService.getAll();
        setQuotes(all.reverse()); // Newest first
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-stone-900">Quotes</h2>
        <Link to="/quotes/new" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm">
          <Plus size={20} />
          Create New
        </Link>
      </div>

      <div className="grid gap-4">
        {loading ? (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="animate-spin text-stone-400" size={32} />
            </div>
        ) : quotes.map(q => (
          <Link key={q.id} to={`/quotes/${q.id}`} className="block group">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 hover:border-primary-500 hover:shadow-md transition-all flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-stone-100 rounded-lg group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                  <FileText size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-stone-800">{q.number}</span>
                    <span className="text-sm text-stone-400">|</span>
                    <span className="font-medium text-stone-700">{q.customerName}</span>
                  </div>
                  <div className="text-sm text-stone-500 mt-1">
                    {q.date} • {q.items.length} Items
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-xl font-bold text-stone-900">ETB {(q.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-stone-400 mt-1">{q.status}</div>
              </div>
            </div>
          </Link>
        ))}
        
        {!loading && quotes.length === 0 && (
           <div className="text-center py-12 text-stone-400 bg-stone-100 rounded-xl border-2 border-dashed border-stone-200">
             No quotes found. Start by creating one.
           </div>
        )}
      </div>
    </div>
  );
};
