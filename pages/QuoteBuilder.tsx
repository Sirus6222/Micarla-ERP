
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, Edit2, X, ChevronRight, RefreshCw, ShieldCheck, FileCheck, Factory, CheckSquare, Lock, Wand2, FileDown, History, AlertCircle, Info, Copy, Tag, User, CreditCard, DollarSign } from 'lucide-react';
import { QuoteService, ProductService, CustomerService, FinanceService, AuditService } from '../services/store';
import { Quote, QuoteLineItem, QuoteStatus, Product, Customer, Role, ApprovalLog, Invoice, AuditRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GoogleGenAI } from "@google/genai";

export const QuoteBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isNew = id === 'new';

  const [quote, setQuote] = useState<Quote | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stages = [
    { label: 'Draft', status: QuoteStatus.DRAFT },
    { label: 'Review', status: QuoteStatus.SUBMITTED },
    { label: 'Approved', status: QuoteStatus.APPROVED },
    { label: 'Order', status: QuoteStatus.ORDERED },
    { label: 'Factory', status: QuoteStatus.IN_PRODUCTION },
    { label: 'Ready', status: QuoteStatus.READY },
    { label: 'Completed', status: QuoteStatus.COMPLETED }
  ];

  const isEditable = () => {
    if (!quote || !user) return false;
    if (user.role === Role.FINANCE || user.role === Role.FACTORY) return false;
    if (user.role === Role.SALES_REP) {
      return quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.REJECTED;
    }
    if (user.role === Role.MANAGER) {
      return quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.SUBMITTED;
    }
    return false;
  };

  useEffect(() => {
    const load = async () => {
      const [ps, cs] = await Promise.all([ProductService.getAll(), CustomerService.getAll()]);
      setProducts(ps);
      setCustomers(cs);

      if (isNew && user) {
        setQuote(await QuoteService.createEmpty(user));
      } else if (id) {
        const q = await QuoteService.getById(id);
        if (q) {
          setQuote(q);
          const c = await CustomerService.getById(q.customerId);
          if (c) setCustomer(c);
          setInvoices(await FinanceService.getInvoicesByQuote(id));
          if (user?.role === Role.MANAGER || user?.role === Role.ADMIN) {
            const logs = await AuditService.getForEntity(id);
            setAuditLogs(logs);
          }
        }
      }
      setLoading(false);
    };
    if (user) load();
  }, [id, isNew, user]);

  const calculateLineItem = (item: QuoteLineItem): QuoteLineItem => {
    const width = Math.max(0, Number(item.width) || 0);
    const height = Math.max(0, Number(item.height) || 0);
    const pieces = Math.max(0, Number(item.pieces) || 0);
    const pricePerSqm = Math.max(0, Number(item.pricePerSqm) || 0);
    const wastage = Math.max(0, Number(item.wastage) || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));

    const areaPerPiece = width * height;
    const totalSqm = Math.round(((areaPerPiece * pieces) + Number.EPSILON) * 1000) / 1000;
    const totalPriceRaw = pricePerSqm * totalSqm;
    const wasteMultiplier = 1 + (wastage / 100);
    const priceWithWaste = totalPriceRaw * wasteMultiplier;
    const pricePlusWaste = priceWithWaste * (1 - (discountPercent / 100));

    return {
      ...item,
      width, height, pieces, pricePerSqm, wastage, discountPercent,
      totalSqm, totalPriceRaw, pricePlusWaste
    };
  };

  const updateTotals = (currentQuote: Quote): Quote => {
    const subTotal = currentQuote.items.reduce((sum, item) => sum + item.pricePlusWaste, 0);
    const discountAmount = Math.max(0, Number(currentQuote.discountAmount) || 0);
    const taxableAmount = Math.max(0, subTotal - discountAmount);
    const tax = taxableAmount * 0.15;
    const grandTotal = taxableAmount + tax;

    return {
      ...currentQuote,
      subTotal, tax, grandTotal, discountAmount
    };
  };

  const handleHeaderChange = (field: keyof Quote, value: any) => {
    if (!isEditable() && field !== 'discountAmount') return; 
    setQuote(prev => {
      if (!prev) return null;
      let updates: Partial<Quote> = { [field]: value };
      if (field === 'customerId') {
        const cust = customers.find(c => c.id === value);
        if (cust) {
          updates.customerName = cust.companyName || cust.name;
          setCustomer(cust);
        }
      }
      if (field === 'discountAmount') {
        const numericVal = parseFloat(value);
        updates.discountAmount = isNaN(numericVal) ? 0 : Math.max(0, numericVal);
        return updateTotals({ ...prev, ...updates });
      }
      return { ...prev, ...updates };
    });
  };

  const addLineItem = () => {
    if (!isEditable()) return;
    setQuote(prev => {
      if (!prev) return null;
      const newLine: QuoteLineItem = {
        id: Math.random().toString(36).substr(2, 9),
        productId: '', productName: '', width: 0, height: 0, depth: 0.03, pieces: 1,
        pricePerSqm: 0, wastage: 0, discountPercent: 0, totalSqm: 0, totalPriceRaw: 0, pricePlusWaste: 0
      };
      return updateTotals({ ...prev, items: [...prev.items, newLine] });
    });
  };

  const updateLineItem = (lineId: string, field: keyof QuoteLineItem, value: any) => {
    if (!isEditable()) return;
    setQuote(prev => {
      if (!prev) return null;
      const newItems = prev.items.map(item => {
        if (item.id !== lineId) return item;
        let val = value;
        if (['width', 'height', 'pieces', 'pricePerSqm', 'discountPercent', 'wastage'].includes(field as string)) {
          val = Math.max(0, parseFloat(value) || 0);
          if (field === 'discountPercent') val = Math.min(100, val);
        }
        let updatedItem = { ...item, [field]: val } as any;
        if (field === 'productId') {
          const prod = products.find(p => p.id === value);
          if (prod) {
            updatedItem.productName = prod.name;
            updatedItem.pricePerSqm = prod.pricePerSqm;
            updatedItem.wastage = prod.defaultWastage;
            if (prod.thickness) updatedItem.depth = prod.thickness / 100;
          }
        }
        return calculateLineItem(updatedItem);
      });
      return updateTotals({ ...prev, items: newItems });
    });
  };

  const removeLineItem = (lineId: string) => {
    if (!isEditable()) return;
    setQuote(prev => {
      if (!prev) return null;
      return updateTotals({ ...prev, items: prev.items.filter(i => i.id !== lineId) });
    });
  };

  const duplicateLineItem = (lineId: string) => {
    if (!isEditable()) return;
    setQuote(prev => {
      if (!prev) return null;
      const itemToCopy = prev.items.find(i => i.id === lineId);
      if (!itemToCopy) return prev;
      const newItem = { ...itemToCopy, id: Math.random().toString(36).substr(2, 9) };
      return updateTotals({ ...prev, items: [...prev.items, newItem] });
    });
  };

  const handleScanSheet = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !quote) return;
    setScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{
            parts: [
              { inlineData: { data: base64Data, mimeType: file.type } },
              { text: `Extract JSON: [{ "product_name": string, "width": number, "height": number, "pieces": number }]` }
            ]
          }],
        });
        const cleanJson = response.text?.replace(/```json|```/g, '').trim() || "[]";
        const parsedItems = JSON.parse(cleanJson);
        if (Array.isArray(parsedItems)) {
          const newItems = [...quote.items];
          for (const item of parsedItems) {
            const matchedProd = products.find(p => p.name.toLowerCase().includes(item.product_name?.toLowerCase()));
            newItems.push(calculateLineItem({
              id: Math.random().toString(36).substr(2, 9),
              productId: matchedProd?.id || '',
              productName: matchedProd?.name || item.product_name || 'Extracted',
              width: Math.max(0, item.width || 0),
              height: Math.max(0, item.height || 0),
              pieces: Math.max(0, item.pieces || 1),
              depth: matchedProd?.thickness ? matchedProd.thickness / 100 : 0.03,
              wastage: matchedProd?.defaultWastage || 15,
              pricePerSqm: matchedProd?.pricePerSqm || 0,
              totalSqm: 0,
              totalPriceRaw: 0,
              pricePlusWaste: 0
            }));
          }
          setQuote(updateTotals({ ...quote, items: newItems }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setScanning(false);
      }
    };
  };

  const handleWorkflow = async (action: ApprovalLog['action']) => {
    if (!quote || !user) return;

    if (action === 'ORDER' && customer) {
      const allInvoices = await FinanceService.getAllInvoices();
      const debt = allInvoices.filter(i => i.customerId === customer.id).reduce((a, b) => a + b.balanceDue, 0);
      if (debt + quote.grandTotal > customer.creditLimit) {
        alert(`CREDIT LIMIT BREACH: Customer has ETB ${debt.toLocaleString()} debt. This order exceeds limit of ETB ${customer.creditLimit.toLocaleString()}.`);
        return;
      }
    }

    if (action === 'COMPLETE') {
      const paid = invoices.reduce((a, b) => a + b.amountPaid, 0);
      if (quote.grandTotal - paid > 1.0) {
        alert("BALANCE OUTSTANDING: Cannot complete order until full payment received.");
        return;
      }
      if (!quote.stockDeducted) {
        for (const item of quote.items) {
          if (item.productId) await ProductService.adjustStock(item.productId, -item.totalSqm, user, `Order Completed: ${quote.orderNumber}`);
        }
        quote.stockDeducted = true;
      }
    }

    let nextStatus = quote.status;
    switch (action) {
      case 'SUBMIT': nextStatus = QuoteStatus.SUBMITTED; break;
      case 'APPROVE': nextStatus = QuoteStatus.APPROVED; break;
      case 'REJECT': nextStatus = QuoteStatus.REJECTED; break;
      case 'ORDER':
        nextStatus = QuoteStatus.ORDERED;
        if (!quote.orderNumber) quote.orderNumber = `ORD-${Math.floor(Math.random() * 99999)}`;
        break;
      case 'PRODUCTION': nextStatus = QuoteStatus.IN_PRODUCTION; break;
      case 'READY': nextStatus = QuoteStatus.READY; break;
      case 'COMPLETE': nextStatus = QuoteStatus.COMPLETED; break;
    }

    const logEntry: ApprovalLog = {
      id: Math.random().toString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      timestamp: new Date().toISOString(),
      comment: approvalComment
    };

    const updated = {
      ...quote,
      status: nextStatus,
      approvalHistory: [...quote.approvalHistory, logEntry],
      stockDeducted: quote.stockDeducted
    };

    setQuote(updated);
    await QuoteService.save(updated, user);
    setApprovalComment('');
    if (isNew) navigate(`/quotes/${updated.id}`);
  };

  if (loading || !quote) return <div className="p-12 text-center text-stone-400">Loading Quote Builder...</div>;

  const currentIdx = stages.findIndex(s => s.status === quote.status);
  const totalPaid = invoices.reduce((a, b) => a + b.amountPaid, 0);
  const depositPaid = invoices.filter(i => i.type === 'Deposit').reduce((a, b) => a + b.amountPaid, 0) > 0;

  const totalRowDiscounts = quote.items.reduce((sum, item) => {
    const rawWithWaste = (item.pricePerSqm * item.totalSqm) * (1 + (item.wastage / 100));
    return sum + (rawWithWaste * ((item.discountPercent || 0) / 100));
  }, 0);

  return (
    <div className="bg-stone-50 min-h-screen pb-20">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-container { padding: 0; width: 100%; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 10pt; }
        }
      `}</style>

      {/* HEADER */}
      <div className="bg-white border-b px-8 py-4 sticky top-0 z-30 flex justify-between items-center shadow-sm no-print">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quotes')} className="text-stone-400 hover:text-stone-800 transition-colors"><ArrowLeft /></button>
          <div>
            <h1 className="text-xl font-bold text-stone-900">{isNew ? t('new_quote') : (quote.orderNumber || quote.number)}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${quote.status === QuoteStatus.APPROVED ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>{quote.status}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="p-2 border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors"><FileDown size={20} /></button>
          {isEditable() && (
            <>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleScanSheet} />
              <button onClick={() => fileInputRef.current?.click()} className="hidden md:flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg font-bold border border-primary-100 transition-colors">
                {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />} {t('scan_ai')}
              </button>
              <button onClick={() => handleWorkflow('SUBMIT')} className="bg-stone-800 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-stone-900 transition-all active:scale-95">
                Save Draft
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* PROGRESS BAR */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm no-print">
          <div className="flex justify-between mb-4">
            {stages.map((s, idx) => (
              <div key={s.label} className="flex-1 flex flex-col items-center relative">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 transition-all duration-300 ${idx <= currentIdx ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white border-stone-200 text-stone-300'}`}>
                  {idx < currentIdx ? <CheckCircle size={16} /> : idx + 1}
                </div>
                <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${idx <= currentIdx ? 'text-primary-600' : 'text-stone-300'}`}>{s.label}</span>
                {idx < stages.length - 1 && <div className={`absolute top-4 left-[50%] w-full h-0.5 -z-0 ${idx < currentIdx ? 'bg-primary-600' : 'bg-stone-100'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* WORKFLOW HISTORY & ACTIONS (MOVED ABOVE TABLE) */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden no-print">
          <div className="p-4 border-b bg-stone-50 font-bold text-stone-700 flex items-center justify-between">
            <div className="flex items-center gap-2 uppercase text-[10px] tracking-widest"><History size={14} className="text-stone-400" /> Workflow & History</div>
            {customer && (
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1 text-stone-400"><CreditCard size={12}/> Limit: <span className="text-stone-800">ETB {customer.creditLimit.toLocaleString()}</span></span>
                <span className={`flex items-center gap-1 ${customer.creditHold ? 'text-red-600' : 'text-green-600'}`}><ShieldCheck size={12}/> Hold: {customer.creditHold ? 'YES' : 'NO'}</span>
              </div>
            )}
          </div>
          
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AUDIT LIST */}
            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 border-r border-stone-100">
              {auditLogs.length === 0 ? (
                <p className="text-[10px] text-stone-400 text-center italic py-4">No workflow records yet.</p>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 relative pl-3 border-l border-stone-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300 absolute -left-[4px] top-1.5" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-stone-700">{log.userName}</span>
                        <span className="text-[9px] text-stone-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 uppercase font-bold tracking-tight">{log.action}: <span className="text-primary-600 font-medium normal-case">{log.newValue || log.oldValue || 'Update'}</span></div>
                      {log.reason && <div className="text-[10px] italic text-stone-400 mt-0.5 leading-tight">"{log.reason}"</div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ACTION BOX */}
            <div className="flex flex-col justify-end gap-3">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">Approver's Comment / Action Note</label>
              <textarea 
                value={approvalComment} 
                onChange={e => setApprovalComment(e.target.value)} 
                className="w-full h-20 border border-stone-200 p-3 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none" 
                placeholder="Required for approvals/rejections..." 
              />
              <div className="flex flex-wrap gap-2 justify-end">
                {user?.role === Role.MANAGER && quote.status === QuoteStatus.SUBMITTED && (
                  <>
                    <button onClick={() => handleWorkflow('REJECT')} className="px-5 py-2.5 border border-red-200 text-red-600 font-bold rounded-lg bg-red-50 hover:bg-red-100 transition-colors shadow-sm">Reject</button>
                    <button onClick={() => handleWorkflow('APPROVE')} className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all shadow-md active:scale-95">Approve Quote</button>
                  </>
                )}
                {quote.status === QuoteStatus.APPROVED && (
                  <button onClick={() => handleWorkflow('ORDER')} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-all shadow-md active:scale-95"><FileCheck size={18}/> Confirm Order</button>
                )}
                {quote.status === QuoteStatus.ORDERED && (
                  <button onClick={() => handleWorkflow('PRODUCTION')} disabled={!depositPaid} className={`px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${depositPaid ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-stone-100 text-stone-300 cursor-not-allowed border border-stone-200'}`}>
                    {depositPaid ? <><Factory size={18} /> Send to Factory</> : <><Lock size={18} /> Deposit Required</>}
                  </button>
                )}
                {quote.status === QuoteStatus.READY && (
                  <button onClick={() => handleWorkflow('COMPLETE')} className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-md active:scale-95"><CheckSquare size={18}/> Mark Completed</button>
                )}
                {isEditable() && quote.status !== QuoteStatus.SUBMITTED && (
                  <button onClick={() => handleWorkflow('SUBMIT')} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-all shadow-md active:scale-95">
                    Submit for Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN ENTRY FORM (FULL WIDTH) */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
          {/* HEADER SECTION */}
          <div className="p-6 bg-stone-50 border-b grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t('customer')}</label>
              <select
                value={quote.customerId}
                onChange={e => handleHeaderChange('customerId', e.target.value)}
                disabled={!isEditable()}
                className="w-full p-2.5 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition-all outline-none"
              >
                <option value="">Select a customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t('date')}</label>
              <input 
                type="date" 
                value={quote.date} 
                disabled={!isEditable()} 
                className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all outline-none" 
                onChange={e => handleHeaderChange('date', e.target.value)} 
              />
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-stone-100 text-stone-500 text-[10px] uppercase font-extrabold border-b tracking-tighter">
                <tr>
                  <th className="p-4 w-10 text-center">#</th>
                  <th className="p-4">{t('products')}</th>
                  <th className="p-4 w-28 text-center">{t('width')}</th>
                  <th className="p-4 w-28 text-center">{t('height')}</th>
                  <th className="p-4 w-32 text-center">{t('price_sqm')}</th>
                  <th className="p-4 w-24 text-center">{t('pieces')}</th>
                  <th className="p-4 w-24 text-primary-600 text-center">{t('discount')}%</th>
                  <th className="p-4 w-28 bg-stone-50 text-right">Tot m²</th>
                  <th className="p-4 w-36 bg-primary-50 text-primary-900 border-l text-right">{t('total')}</th>
                  <th className="p-4 w-24 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quote.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-stone-400 italic text-sm">No items added yet. Click "Add Line Item" below.</td>
                  </tr>
                ) : (
                  quote.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-stone-50 transition-colors group">
                      <td className="p-4 text-stone-400 font-mono text-center text-[10px]">{index + 1}</td>
                      <td className="p-4">
                        <select
                          value={item.productId}
                          onChange={e => updateLineItem(item.id, 'productId', e.target.value)}
                          disabled={!isEditable()}
                          className="w-full p-2 border border-stone-200 rounded-lg bg-white text-xs focus:ring-1 focus:ring-primary-500 transition-all outline-none"
                        >
                          <option value="">Select Product...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="p-4"><input type="number" step="0.01" min="0" value={item.width} disabled={!isEditable()} onChange={e => updateLineItem(item.id, 'width', e.target.value)} className="w-full p-2 border border-stone-200 rounded-lg text-center text-xs focus:ring-1 focus:ring-primary-500 outline-none" /></td>
                      <td className="p-4"><input type="number" step="0.01" min="0" value={item.height} disabled={!isEditable()} onChange={e => updateLineItem(item.id, 'height', e.target.value)} className="w-full p-2 border border-stone-200 rounded-lg text-center text-xs focus:ring-1 focus:ring-primary-500 outline-none" /></td>
                      <td className="p-4"><input type="number" step="1" min="0" value={item.pricePerSqm} disabled={!isEditable()} onChange={e => updateLineItem(item.id, 'pricePerSqm', e.target.value)} className="w-full p-2 border border-stone-200 rounded-lg text-center text-xs focus:ring-1 focus:ring-primary-500 outline-none font-mono" /></td>
                      <td className="p-4"><input type="number" min="0" value={item.pieces} disabled={!isEditable()} onChange={e => updateLineItem(item.id, 'pieces', e.target.value)} className="w-full p-2 border border-stone-200 rounded-lg text-center text-xs font-bold focus:ring-1 focus:ring-primary-500 outline-none" /></td>
                      <td className="p-4"><input type="number" min="0" max="100" value={item.discountPercent || 0} disabled={!isEditable()} onChange={e => updateLineItem(item.id, 'discountPercent', e.target.value)} className="w-full p-2 border border-primary-100 rounded-lg text-center text-primary-600 text-xs focus:ring-1 focus:ring-primary-500 outline-none" /></td>
                      <td className="p-4 text-right bg-stone-50 font-mono text-xs text-stone-700">{item.totalSqm.toFixed(2)}</td>
                      <td className="p-4 text-right bg-primary-50 border-l font-bold text-primary-800 text-sm">ETB {Number(item.pricePlusWaste).toLocaleString()}</td>
                      <td className="p-4 text-center no-print">
                        {isEditable() && (
                          <div className="flex gap-1 justify-center md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => duplicateLineItem(item.id)} className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Copy size={16} /></button>
                            <button onClick={() => removeLineItem(item.id)} className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {isEditable() && (
              <div className="p-6 bg-stone-50 border-t border-stone-100 no-print">
                <button onClick={addLineItem} className="flex items-center gap-2 text-primary-700 font-bold px-6 py-2.5 rounded-lg border border-primary-200 bg-white hover:bg-primary-50 hover:border-primary-300 transition-all shadow-sm active:scale-95">
                  <Plus size={18} /> Add Line Item
                </button>
              </div>
            )}
          </div>

          {/* FOOTER SECTION: NOTES & TOTALS */}
          <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-12 border-t bg-white">
            <div className="w-full md:w-1/2">
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Info size={12}/> Fabrication Instructions / Notes</label>
              <textarea 
                value={quote.notes || ''} 
                disabled={!isEditable()} 
                className="w-full h-40 p-4 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none bg-stone-50/50" 
                placeholder="Specific instructions for factory or delivery..." 
                onChange={e => handleHeaderChange('notes', e.target.value)} 
              />
            </div>
            
            <div className="w-full md:w-1/3 space-y-4 bg-stone-900 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                 <DollarSign size={80} />
              </div>
              <div className="flex justify-between text-stone-400 text-xs font-bold uppercase tracking-widest">
                <span>{t('subtotal')}</span>
                <span className="font-mono text-white">ETB {Number(quote.subTotal).toLocaleString()}</span>
              </div>
              {totalRowDiscounts > 0 && (
                <div className="flex justify-between text-primary-400 text-[10px] font-bold italic border-b border-stone-800 pb-2">
                  <span className="flex items-center gap-1"><Tag size={10} /> Row Discounts Applied</span>
                  <span>- ETB {totalRowDiscounts.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-400 text-xs font-bold uppercase tracking-widest items-center">
                <span>Managerial Discount</span>
                <input 
                  type="number" 
                  min="0" 
                  className="w-28 text-right p-1.5 border border-stone-700 rounded bg-stone-800 font-mono text-xs text-primary-400 focus:ring-1 focus:ring-primary-500 outline-none" 
                  value={quote.discountAmount || 0} 
                  onChange={e => handleHeaderChange('discountAmount', e.target.value)} 
                  disabled={!isEditable() && user?.role !== Role.MANAGER} 
                />
              </div>
              <div className="flex justify-between text-stone-400 text-xs font-bold uppercase tracking-widest">
                <span>VAT (15%)</span>
                <span className="font-mono text-white">ETB {Number(quote.tax).toLocaleString()}</span>
              </div>
              <div className="pt-6 border-t border-stone-800 flex justify-between items-center">
                <span className="text-sm font-bold text-stone-300 uppercase tracking-widest">{t('grand_total')}</span>
                <span className="text-3xl font-black text-primary-400 font-mono">ETB {Number(quote.grandTotal).toLocaleString()}</span>
              </div>
              
              <div className="pt-4 space-y-2">
                {totalPaid > 0 && (
                  <div className="flex justify-between text-xs font-bold text-green-400 bg-green-400/10 p-2 rounded-lg border border-green-400/20">
                    <span>Total Paid</span>
                    <span>ETB {totalPaid.toLocaleString()}</span>
                  </div>
                )}
                {quote.grandTotal - totalPaid > 0 && totalPaid > 0 && (
                  <div className="flex justify-between text-xs font-bold text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                      <span>Outstanding Balance</span>
                      <span>ETB {(quote.grandTotal - totalPaid).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
