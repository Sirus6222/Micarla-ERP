
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, Edit2, X, ChevronRight, RefreshCw, ShieldCheck, FileCheck, Factory, CheckSquare, Lock, Wand2, FileDown, History, AlertCircle, Info, Copy, Tag, User, CreditCard, DollarSign, Wallet } from 'lucide-react';
import { QuoteService, ProductService, CustomerService, FinanceService, AuditService } from '../services/store';
import { Quote, QuoteLineItem, QuoteStatus, Product, Customer, Role, ApprovalLog, Invoice, AuditRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

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
    // Master access: Admin can edit anything at any time
    if (user.role === Role.ADMIN) return true;
    
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
        id: crypto.randomUUID(),
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
      const newItem = { ...itemToCopy, id: crypto.randomUUID() };
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
        // Call the secure Supabase Edge Function instead of exposing API keys client-side
        const { data, error } = await supabase.functions.invoke('scan-quote', {
          body: { imageBase64: base64Data, mimeType: file.type }
        });

        if (error) throw error;

        const parsedItems = data?.items || [];
        if (Array.isArray(parsedItems)) {
          const newItems = [...quote.items];
          for (const item of parsedItems) {
            // Fuzzy match product names against inventory database
            const searchName = (item.product_name || '').toLowerCase();
            const matchedProd = products.find(p =>
              p.name.toLowerCase().includes(searchName) ||
              searchName.includes(p.name.toLowerCase().split(' ')[0])
            );
            newItems.push(calculateLineItem({
              id: crypto.randomUUID(),
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
        console.error('AI Scan failed:', err);
        alert('AI scan failed. Please ensure the Edge Function is deployed and GEMINI_API_KEY is configured.');
      } finally {
        setScanning(false);
      }
    };
  };

  const handleWorkflow = async (action: ApprovalLog['action']) => {
    if (!quote || !user) return;

    if (action === 'ORDER' && customer) {
      if (customer.creditHold) {
        alert(`CREDIT HOLD: ${customer.companyName || customer.name} is currently on credit hold. Orders cannot be placed until the hold is lifted by a Manager.`);
        return;
      }
      const allInvoices = await FinanceService.getAllInvoices();
      const debt = allInvoices.filter(i => i.customerId === customer.id).reduce((a, b) => a + b.balanceDue, 0);
      if (customer.creditLimit > 0 && debt + quote.grandTotal > customer.creditLimit) {
        alert(`CREDIT LIMIT BREACH: Customer has ETB ${debt.toLocaleString()} outstanding debt. Adding this order (ETB ${quote.grandTotal.toLocaleString()}) would exceed the credit limit of ETB ${customer.creditLimit.toLocaleString()}.`);
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
        if (!quote.orderNumber) quote.orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        break;
      case 'PRODUCTION': nextStatus = QuoteStatus.IN_PRODUCTION; break;
      case 'READY': nextStatus = QuoteStatus.READY; break;
      case 'COMPLETE': nextStatus = QuoteStatus.COMPLETED; break;
    }

    const logEntry: ApprovalLog = {
      id: crypto.randomUUID(),
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

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-stone-50 min-h-screen pb-20 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { margin: 0.5cm; size: A4; }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
            font-size: 11px !important; 
            color: #000 !important;
          }
          .no-print { display: none !important; }
          .print-full-width { 
            width: 100% !important; 
            max-width: none !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            border: none !important;
            box-shadow: none !important;
          }
          
          /* Form Elements Reset */
          input, select, textarea { 
            border: none !important; 
            background: transparent !important; 
            resize: none !important; 
            padding: 0 !important;
            appearance: none !important;
            box-shadow: none !important;
            font-size: 11px !important;
            color: #000 !important;
            line-height: 1.2;
          }
          
          /* Hide placeholders in print */
          input::placeholder, textarea::placeholder { color: transparent !important; }

          /* Table Styling - Compact */
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          thead { background-color: #f3f4f6 !important; border-bottom: 2px solid #000 !important; }
          th { padding: 4px 2px !important; font-size: 10px !important; font-weight: 800 !important; }
          td { border-bottom: 1px solid #ddd; padding: 4px 2px !important; }
          tr { break-inside: avoid; }
          
          /* Custom Print Headers - Compact */
          .print-header { display: block !important; margin-bottom: 10px; }
          .print-header h1 { font-size: 20px !important; margin-bottom: 0 !important; line-height: 1.2; }
          .print-header h2 { font-size: 16px !important; margin-bottom: 0 !important; }
          .print-header-meta { font-size: 9px !important; line-height: 1.3; }
          
          /* Grid adjustments */
          .print-grid-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem !important; margin-bottom: 1rem !important; }
          
          /* Summary Section Compact */
          .print-summary-text { font-size: 11px !important; }
          .print-grand-total { font-size: 16px !important; font-weight: 900 !important; }
          
          /* Footer */
          .print-footer { display: block !important; margin-top: 10px; padding-top: 10px; page-break-inside: avoid; border-top: 1px solid #ccc !important; }
          
          /* Hide icons/colors in print */
          .status-badge { border: 1px solid #000; color: #000 !important; background: transparent !important; }
          
          /* Ensure flex containers work well */
          .print-flex-row { display: flex !important; flex-direction: row !important; gap: 2rem !important; }
          .print-w-half { width: 50% !important; }
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
          <button onClick={() => window.print()} className="p-2 border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors flex items-center gap-2 font-bold text-xs">
              <FileDown size={18} /> Print / Export
          </button>
          {isEditable() && (
            <>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleScanSheet} />
              <button onClick={() => fileInputRef.current?.click()} className="hidden md:flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg font-bold border border-primary-100 transition-colors text-xs">
                {scanning ? <RefreshCw className="animate-spin" size={16} /> : <Wand2 size={16} />} {t('scan_ai')}
              </button>
              <button onClick={() => handleWorkflow('SUBMIT')} className="bg-stone-800 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-stone-900 transition-all active:scale-95 text-xs">
                Save Draft
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 print-full-width print:p-0 print:space-y-4">
        
        {/* PRINT ONLY HEADER */}
        <div className="hidden print-header">
            <div className="flex justify-between items-start border-b-2 border-stone-900 pb-2 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 tracking-tight uppercase">GraniteFlow ERP</h1>
                    <p className="text-sm font-medium text-stone-600">Enterprise Stone Management</p>
                    <div className="text-xs text-stone-500 mt-1 leading-tight print-header-meta">
                        Bole Road, Addis Ababa, Ethiopia<br/>
                        Tax ID: 0012345678 | Phone: +251 911 234 567
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-light text-stone-800 uppercase tracking-widest">
                        {quote.status === QuoteStatus.ORDERED || quote.status === QuoteStatus.IN_PRODUCTION || quote.status === QuoteStatus.COMPLETED ? 'Order' : 'Quote'}
                    </h2>
                    <p className="text-lg font-bold text-stone-900 mt-0.5">{quote.orderNumber || quote.number}</p>
                    <p className="text-xs text-stone-500">Date: {new Date(quote.date).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4 print-grid-compact">
                <div>
                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5 border-b pb-0.5">Bill To</h3>
                    <div className="text-sm font-bold text-stone-900">{customer?.companyName || customer?.name || 'Walk-in Customer'}</div>
                    {customer && (
                        <div className="text-xs text-stone-600 mt-0.5 leading-tight">
                            {customer.name}<br/>
                            {customer.address}<br/>
                            {customer.phone}
                        </div>
                    )}
                </div>
                <div>
                     <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5 border-b pb-0.5">Sales Rep</h3>
                     <div className="text-sm font-bold text-stone-900">{quote.salesRepName}</div>
                </div>
            </div>
        </div>

        {/* PROGRESS BAR (Hidden in Print) */}
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

        {/* WORKFLOW HISTORY & ACTIONS (Hidden in Print) */}
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
                {(user?.role === Role.MANAGER || user?.role === Role.ADMIN) && quote.status === QuoteStatus.SUBMITTED && (
                  <>
                    <button onClick={() => handleWorkflow('REJECT')} className="px-5 py-2.5 border border-red-200 text-red-600 font-bold rounded-lg bg-red-50 hover:bg-red-100 transition-colors shadow-sm">Reject Quote</button>
                    <button onClick={() => handleWorkflow('APPROVE')} className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all shadow-md active:scale-95">Approve Quote</button>
                  </>
                )}
                {quote.status === QuoteStatus.APPROVED && (
                  <button onClick={() => handleWorkflow('ORDER')} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-all shadow-md active:scale-95"><FileCheck size={18}/> Convert to Order</button>
                )}
                {quote.status === QuoteStatus.ORDERED && (
                  <button onClick={() => handleWorkflow('PRODUCTION')} disabled={!depositPaid} className={`px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${depositPaid ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-stone-100 text-stone-300 cursor-not-allowed border border-stone-200'}`}>
                    {depositPaid ? <><Factory size={18} /> Release to Production</> : <><Lock size={18} /> Deposit Required</>}
                  </button>
                )}
                {quote.status === QuoteStatus.READY && (
                  <button onClick={() => handleWorkflow('COMPLETE')} className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-md active:scale-95"><CheckSquare size={18}/> Mark as Complete</button>
                )}
                {isEditable() && quote.status !== QuoteStatus.SUBMITTED && (
                  <button onClick={() => handleWorkflow('SUBMIT')} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-all shadow-md active:scale-95">
                    Submit for Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN ENTRY FORM (FULL WIDTH) */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden print-full-width">
          {/* Credit Hold Warning Banner */}
          {customer?.creditHold && (
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-3 no-print">
              <AlertCircle className="text-red-600 shrink-0" size={20} />
              <div>
                <span className="font-bold text-red-800 text-sm">CREDIT HOLD ACTIVE</span>
                <span className="text-red-600 text-xs ml-2">This customer is on credit hold. New orders cannot be created until the hold is removed.</span>
              </div>
            </div>
          )}

          {/* HEADER SECTION - Display Only in Print if needed, but we have a custom header */}
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
              <label className="block text-sm font-bold text-stone-400 uppercase tracking-widest mb-1">{t('date')}</label>
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
          <div className="overflow-x-auto w-full print-full-width">
            <table className="w-full text-left border-collapse min-w-[1000px] print:min-w-0">
              <thead className="bg-stone-100 text-stone-500 text-[10px] uppercase font-extrabold border-b tracking-tighter">
                <tr>
                  <th className="p-4 w-10 text-center">#</th>
                  <th className="p-4">{t('products')}</th>
                  <th className="p-4 w-28 text-center">{t('width')}</th>
                  <th className="p-4 w-28 text-center">{t('height')}</th>
                  <th className="p-4 w-32 text-center">{t('price_sqm')}</th>
                  <th className="p-4 w-24 text-center">{t('pieces')}</th>
                  <th className="p-4 w-24 text-primary-600 text-center">{t('discount')}%</th>
                  <th className="p-4 w-28 bg-stone-50 text-right print:bg-transparent">Tot m²</th>
                  <th className="p-4 w-36 bg-primary-50 text-primary-900 border-l text-right print:bg-transparent print:text-black">{t('total')}</th>
                  <th className="p-4 w-24 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quote.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-stone-400 italic text-sm">No items added yet.</td>
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
                      <td className="p-4 text-right bg-stone-50 font-mono text-xs text-stone-700 print:bg-transparent">{(item.totalSqm || 0).toFixed(2)}</td>
                      <td className="p-4 text-right bg-primary-50 border-l font-bold text-primary-800 text-sm print:bg-transparent print:text-black">ETB {formatCurrency(item.pricePlusWaste)}</td>
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
          <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-12 border-t bg-white print-full-width print:p-0 print:border-t-0 print-flex-row">
            <div className="w-full md:w-1/2 print-w-half">
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Info size={12}/> Fabrication Instructions / Notes</label>
              <textarea 
                value={quote.notes || ''} 
                disabled={!isEditable()} 
                className="w-full h-40 p-4 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none bg-stone-50/50 print:bg-transparent print:border-none print:h-auto" 
                placeholder="Specific instructions for factory or delivery..." 
                onChange={e => handleHeaderChange('notes', e.target.value)} 
              />
            </div>
            
            <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl border border-stone-200 shadow-lg h-fit print:border-none print:shadow-none print:p-0 print-w-half">
              <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2 no-print">
                <Wallet className="text-primary-600" size={20}/>
                Payment Summary
              </h3>

              <div className="space-y-3 print-summary-text">
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">ETB {formatCurrency(quote.subTotal)}</span>
                </div>

                {totalRowDiscounts > 0 && (
                  <div className="flex justify-between text-xs text-green-600 italic">
                    <span>Includes Item Discounts</span>
                    <span>- ETB {formatCurrency(totalRowDiscounts)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2">
                   <span className="text-sm text-stone-600">Additional Discount</span>
                   <div className="flex items-center gap-2">
                     <span className="text-xs text-stone-400 font-mono no-print">- ETB</span>
                     <input 
                       type="number" 
                       min="0" 
                       className="w-24 text-right p-1.5 border border-stone-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all print:w-auto" 
                       value={quote.discountAmount || 0} 
                       onChange={e => handleHeaderChange('discountAmount', e.target.value)} 
                       disabled={!isEditable() && user?.role !== Role.MANAGER} 
                     />
                   </div>
                </div>

                <div className="flex justify-between text-sm text-stone-600 border-t border-stone-100 pt-3">
                  <span>VAT (15%)</span>
                  <span className="font-mono font-medium">ETB {formatCurrency(quote.tax)}</span>
                </div>

                <div className="flex justify-between items-end border-t-2 border-stone-100 pt-4 mt-2 print:border-black">
                  <div>
                    <span className="block text-sm font-bold text-stone-900 uppercase tracking-wide">Grand Total</span>
                    <span className="text-xs text-stone-400 font-medium no-print">Inclusive of VAT</span>
                  </div>
                  <span className="text-3xl font-black text-primary-700 font-mono tracking-tight print:text-black print-grand-total">ETB {formatCurrency(quote.grandTotal)}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-stone-100 space-y-3">
                {totalPaid > 0 && (
                  <div className="flex justify-between text-xs font-bold text-green-700 bg-green-50 p-3 rounded-lg border border-green-100 print:bg-transparent print:border-none print:text-black">
                    <span>Total Paid</span>
                    <span>ETB {formatCurrency(totalPaid)}</span>
                  </div>
                )}
                {quote.grandTotal - totalPaid > 0 && totalPaid > 0 && (
                  <div className="flex justify-between text-xs font-bold text-red-700 bg-red-50 p-3 rounded-lg border border-red-100 print:bg-transparent print:border-none print:text-black">
                      <span>Outstanding Balance</span>
                      <span>ETB {formatCurrency(quote.grandTotal - totalPaid)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* PRINT FOOTER */}
        <div className="hidden print-footer pt-8 mt-8 border-t-2 border-stone-200">
             <div className="grid grid-cols-2 gap-12">
                 <div>
                     <h4 className="text-[10px] font-bold uppercase mb-2">Terms & Conditions</h4>
                     <ul className="text-[9px] list-disc list-inside text-stone-600 space-y-0.5">
                         <li>50% Deposit required to commence production.</li>
                         <li>Final balance due prior to delivery or pickup.</li>
                         <li>Quotations are valid for 15 days.</li>
                         <li>Natural stone may vary in color and pattern.</li>
                     </ul>
                 </div>
                 <div>
                     <div className="h-12 border-b border-stone-400 mb-1"></div>
                     <p className="text-[9px] font-bold text-center uppercase">Authorized Signature & Date</p>
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
};
