
import React, { useState, useEffect } from 'react';
import { QuoteService, FinanceService } from '../services/store';
import { Quote, QuoteStatus, ApprovalLog, Invoice, Role } from '../types';
import { Factory, Check, Clock, CheckCircle, ArrowRight, Inbox, RotateCcw, Eye, X, Box, FileText, Lock, FileSearch, CheckSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ProductionBoard: React.FC = () => {
  const [orders, setOrders] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const { user } = useAuth();

  const refreshOrders = async () => {
    setLoading(true);
    try {
        const [allQuotes, allInvoices] = await Promise.all([
            QuoteService.getAll(),
            FinanceService.getAllInvoices()
        ]);
        setOrders(allQuotes.sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime()));
        setInvoices(allInvoices);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  const updateStatus = async (quote: Quote, newStatus: QuoteStatus, action: ApprovalLog['action'], comment: string) => {
      if (!user) return;
      const logEntry: ApprovalLog = {
          id: Math.random().toString(36).substr(2, 9),
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: action,
          timestamp: new Date().toISOString(),
          comment: comment
      };
      const updated = { 
          ...quote, 
          status: newStatus,
          approvalHistory: [...(quote.approvalHistory || []), logEntry]
      };
      setOrders(prev => prev.map(o => o.id === quote.id ? updated : o));
      // Passing current user for audit tracking
      await QuoteService.save(updated, user);
  };

  const toggleItemComplete = async (itemId: string) => {
      if (!selectedQuote || !user) return;
      const updatedItems = selectedQuote.items.map(item => {
          if (item.id === itemId) return { ...item, isCompleted: !item.isCompleted };
          return item;
      });
      const updatedQuote = { ...selectedQuote, items: updatedItems };
      setSelectedQuote(updatedQuote);
      setOrders(prev => prev.map(o => o.id === updatedQuote.id ? updatedQuote : o));
      // Passing current user for audit tracking
      await QuoteService.save(updatedQuote, user);
  };

  const hasDeposit = (quoteId: string) => {
      const quoteInvoices = invoices.filter(i => i.quoteId === quoteId);
      const totalPaid = quoteInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
      return totalPaid > 0;
  };

  const isFullyPaid = (quoteId: string) => {
      const quote = orders.find(q => q.id === quoteId);
      if (!quote) return false;
      const quoteInvoices = invoices.filter(i => i.quoteId === quoteId);
      const totalPaid = quoteInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
      return (quote.grandTotal - totalPaid) < 1;
  };

  const isFactoryUser = user?.role === Role.FACTORY;

  const columns = [
    { 
        id: 'draft', 
        title: 'Draft / Lead', 
        statuses: [QuoteStatus.DRAFT, QuoteStatus.REJECTED], 
        icon: FileText,
        color: 'border-stone-400',
        bg: 'bg-stone-50'
    },
    { 
        id: 'approval', 
        title: 'In Approval', 
        statuses: [QuoteStatus.SUBMITTED], 
        icon: FileSearch,
        color: 'border-blue-400',
        bg: 'bg-blue-50'
    },
    { 
        id: 'approved', 
        title: 'Approved', 
        statuses: [QuoteStatus.APPROVED], 
        icon: CheckSquare,
        color: 'border-green-400',
        bg: 'bg-green-50'
    },
    { 
        id: 'ordered', 
        title: 'Ordered', 
        statuses: [QuoteStatus.ORDERED], 
        icon: Inbox,
        color: 'border-blue-600',
        bg: 'bg-blue-100'
    },
    { 
        id: 'progress', 
        title: 'Production', 
        statuses: [QuoteStatus.ACCEPTED, QuoteStatus.IN_PRODUCTION], 
        icon: Factory,
        color: 'border-purple-600',
        bg: 'bg-purple-50'
    },
    { 
        id: 'ready', 
        title: 'Ready', 
        statuses: [QuoteStatus.READY], 
        icon: CheckCircle,
        color: 'border-green-600',
        bg: 'bg-green-100'
    }
  ];

  // Fix: Explicitly defining Card as React.FC to satisfy TS JSX requirements for 'key' prop
  const Card: React.FC<{ quote: Quote }> = ({ quote }) => {
      const depositPaid = hasDeposit(quote.id);
      return (
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-3 mb-3 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-[10px] font-bold bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                  {quote.orderNumber || quote.number}
              </span>
              <span className="text-[10px] text-stone-400">{new Date(quote.date).toLocaleDateString()}</span>
          </div>
          <h4 className="font-bold text-stone-800 text-sm mb-1 truncate">{quote.customerName}</h4>
          <div className="text-[10px] text-stone-500 mb-2 flex items-center gap-1">
              <Box size={10} />
              {quote.items.length} items • {quote.items.reduce((a,b) => a+b.pieces, 0)} pcs
          </div>

          <button onClick={() => setSelectedQuote(quote)} className="w-full mb-2 py-1 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors">
             <Eye size={10} /> View Sheet
          </button>
          
          <div className="pt-2 border-t border-stone-100 flex gap-2">
              {quote.status === QuoteStatus.ORDERED && (
                  depositPaid ? (
                    <button onClick={() => updateStatus(quote, QuoteStatus.ACCEPTED, 'ACCEPT', 'Job accepted')} disabled={!isFactoryUser} className={`w-full py-1 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 ${isFactoryUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}>
                        {isFactoryUser ? 'Accept' : 'Factory'} <ArrowRight size={10} />
                    </button>
                  ) : (
                    <div className="w-full py-1 bg-stone-100 text-stone-400 border border-stone-200 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                        <Lock size={10} /> Dep. Required
                    </div>
                  )
              )}
              {quote.status === QuoteStatus.ACCEPTED && (
                  <button onClick={() => updateStatus(quote, QuoteStatus.IN_PRODUCTION, 'START_WORK', 'Started')} disabled={!isFactoryUser} className={`w-full py-1 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 ${isFactoryUser ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-300 cursor-not-allowed'}`}>
                      {isFactoryUser ? 'Start' : 'Factory'} <ArrowRight size={10} />
                  </button>
              )}
              {quote.status === QuoteStatus.IN_PRODUCTION && (
                  <button onClick={() => updateStatus(quote, QuoteStatus.READY, 'READY', 'Quality Check Passed')} disabled={!isFactoryUser} className={`w-full py-1 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 ${isFactoryUser ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-300 cursor-not-allowed'}`}>
                      {isFactoryUser ? 'Mark Ready' : 'Factory'} <Check size={10} />
                  </button>
              )}
              {quote.status === QuoteStatus.READY && (
                  isFullyPaid(quote.id) ? (
                    <button onClick={() => updateStatus(quote, QuoteStatus.COMPLETED, 'COMPLETE', 'Released')} className="w-full py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1">
                        Release <CheckCircle size={10} />
                    </button>
                  ) : (
                    <div className="w-full py-1 bg-stone-100 text-stone-400 border border-stone-200 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                        <Lock size={10} /> Balance Due
                    </div>
                  )
              )}
          </div>
      </div>
  )};

  return (
    <div className="h-full flex flex-col bg-stone-100 overflow-hidden relative">
      <div className="p-4 md:px-8 md:py-6 bg-white border-b border-stone-200 flex justify-between items-center shrink-0">
        <div>
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-2">
                <Factory className="text-primary-600" size={24} />
                Pipeline & Production
            </h2>
            <p className="text-xs md:text-sm text-stone-500">End-to-end visibility from Draft to Delivery.</p>
        </div>
        <div className="flex gap-4">
            <button onClick={refreshOrders} className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors">
                <RotateCcw size={20} />
            </button>
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex items-center justify-center text-stone-500">Loading Board...</div>
      ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
              <div className="flex h-full gap-4 min-w-[1500px]">
                  {columns.map(col => {
                      const colOrders = orders.filter(o => col.statuses.includes(o.status));
                      const Icon = col.icon;
                      return (
                          <div key={col.id} className="w-[250px] flex flex-col h-full rounded-xl bg-stone-200/50 border border-stone-200 shrink-0">
                              <div className={`p-3 border-b-2 ${col.color} bg-white rounded-t-xl flex justify-between items-center shrink-0`}>
                                  <div className="flex items-center gap-2 font-bold text-stone-700 text-xs">
                                      <Icon size={14} className="text-stone-400" />
                                      {col.title}
                                  </div>
                                  <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      {colOrders.length}
                                  </span>
                              </div>
                              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                  {colOrders.length === 0 ? (
                                      <div className="h-24 border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center text-stone-400 text-[10px] italic">
                                          Empty
                                      </div>
                                  ) : (
                                      colOrders.map(order => <Card key={order.id} quote={order} />)
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-200 flex justify-between items-start bg-stone-50 rounded-t-xl">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-stone-900">Job Sheet</h2>
                            <span className="bg-stone-900 text-white px-2 py-1 rounded text-sm font-mono font-bold">
                                {selectedQuote.orderNumber || selectedQuote.number}
                            </span>
                        </div>
                        <p className="text-stone-500">{selectedQuote.customerName}</p>
                    </div>
                    <button onClick={() => setSelectedQuote(null)} className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-full">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6">
                        <h3 className="text-sm font-bold uppercase text-stone-400 mb-3 tracking-wider">Cutting List</h3>
                        <table className="w-full border-collapse">
                            <thead className="bg-stone-100 text-left text-xs font-bold uppercase text-stone-600">
                                <tr>
                                    <th className="p-3 rounded-l-lg">Material</th>
                                    <th className="p-3 text-center">W (m)</th>
                                    <th className="p-3 text-center">H (m)</th>
                                    <th className="p-3 text-center">Pcs</th>
                                    <th className="p-3 rounded-r-lg text-center">Check</th>
                                </tr>
                            </thead>
                            <tbody className="text-stone-800">
                                {selectedQuote.items.map((item) => (
                                    <tr key={item.id} className={`border-b border-stone-100 ${item.isCompleted ? 'bg-green-50/50' : ''}`}>
                                        <td className={`p-3 font-medium ${item.isCompleted ? 'text-stone-400 line-through' : ''}`}>{item.productName}</td>
                                        <td className="p-3 text-center font-mono font-bold text-lg">{item.width}</td>
                                        <td className="p-3 text-center font-mono font-bold text-lg">{item.height}</td>
                                        <td className="p-3 text-center font-bold text-lg bg-stone-50">{item.pieces}</td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => toggleItemComplete(item.id)}
                                                className={`w-8 h-8 rounded-lg border-2 mx-auto flex items-center justify-center transition-all ${
                                                    item.isCompleted 
                                                    ? 'bg-green-500 border-green-500 text-white shadow-sm scale-110' 
                                                    : 'border-stone-300 text-transparent hover:border-primary-500 hover:text-stone-200'
                                                }`}
                                            >
                                                <Check size={18} strokeWidth={4} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {selectedQuote.notes && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <FileText size={16} />
                                Fabrication Notes
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{selectedQuote.notes}</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-stone-200 bg-stone-50 rounded-b-xl flex justify-end">
                    <button onClick={() => setSelectedQuote(null)} className="px-6 py-2 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-900">
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
