
import React, { useState, useEffect } from 'react';
import { FinanceService, QuoteService } from '../services/store';
import { Invoice, Quote, QuoteStatus, InvoiceType, InvoiceStatus, Payment, PaymentMethod, Role } from '../types';
import { Plus, DollarSign, FileText, CheckCircle, Wallet, CreditCard, AlertTriangle, X, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export const FinanceDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Quote | null>(null);
  
  const [invoiceForm, setInvoiceForm] = useState<{
      type: InvoiceType, 
      percentage: number,
      paymentTerms: number 
  }>({ type: InvoiceType.DEPOSIT, percentage: 50, paymentTerms: 0 });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: PaymentMethod.BANK_TRANSFER, ref: '' });

  const loadData = async () => {
      const allQuotes = await QuoteService.getAll();
      const orderList = allQuotes.filter(q => q.status === QuoteStatus.ORDERED || q.status === QuoteStatus.IN_PRODUCTION || q.status === QuoteStatus.READY || q.status === QuoteStatus.COMPLETED);
      const allInvoices = await FinanceService.getAllInvoices();
      setOrders(orderList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setInvoices(allInvoices.sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime()));
      setLoading(false);
  };

  useEffect(() => {
      loadData();
  }, []);

  const openInvoiceModal = (order: Quote) => {
      const existingInvs = invoices.filter(i => i.quoteId === order.id);
      const hasDepositInv = existingInvs.some(i => i.type === InvoiceType.DEPOSIT);
      
      setSelectedOrder(order);
      setInvoiceForm({ 
          type: hasDepositInv ? InvoiceType.FINAL : InvoiceType.DEPOSIT, 
          percentage: 50, 
          paymentTerms: 0 
      });
      setShowInvoiceModal(true);
  };

  const createInvoice = async () => {
      if (!selectedOrder || !user) return;
      
      const existingInvs = invoices.filter(i => i.quoteId === selectedOrder.id);
      const invoicedTotalSoFar = existingInvs.reduce((sum, i) => sum + i.totalAmount, 0);

      let amount = 0;
      if (invoiceForm.type === InvoiceType.DEPOSIT) {
          amount = selectedOrder.grandTotal * (invoiceForm.percentage / 100);
      } else {
          // Final balance calculation: Grand Total - (Sum of all existing Invoices)
          amount = Math.max(0, selectedOrder.grandTotal - invoicedTotalSoFar);
      }

      if (amount <= 0.01) {
          alert("This order is already fully invoiced.");
          return;
      }

      const dateIssued = new Date();
      const dueDate = new Date(dateIssued);
      dueDate.setDate(dueDate.getDate() + invoiceForm.paymentTerms);

      const newInvoice: Invoice = {
          id: Math.random().toString(36).substr(2, 9),
          number: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
          quoteId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber || '',
          customerId: selectedOrder.customerId,
          customerName: selectedOrder.customerName,
          dateIssued: dateIssued.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          type: invoiceForm.type,
          status: InvoiceStatus.ISSUED,
          amount: amount / 1.15,
          taxAmount: amount - (amount / 1.15),
          totalAmount: amount,
          amountPaid: 0,
          balanceDue: amount
      };

      // Pass user for audit tracking requirement in createInvoice
      await FinanceService.createInvoice(newInvoice, user);
      setShowInvoiceModal(false);
      loadData();
  };

  const openPaymentModal = (invoice: Invoice) => {
      setSelectedInvoice(invoice);
      setPaymentForm({ amount: invoice.balanceDue, method: PaymentMethod.BANK_TRANSFER, ref: '' });
      setShowPaymentModal(true);
  };

  const recordPayment = async () => {
      if (!selectedInvoice || !user) return;
      const payment: Payment = {
          id: Math.random().toString(36).substr(2, 9),
          invoiceId: selectedInvoice.id,
          quoteId: selectedInvoice.quoteId,
          amount: Number(paymentForm.amount),
          date: new Date().toISOString().split('T')[0],
          method: paymentForm.method,
          reference: paymentForm.ref,
          recordedByUserId: user.id
      };
      // Pass user for audit tracking requirement in recordPayment
      await FinanceService.recordPayment(payment, user);
      setShowPaymentModal(false);
      loadData();
  };

  const getOverdueDays = (invoice: Invoice) => {
      if(invoice.status === InvoiceStatus.PAID) return 0;
      const due = new Date(invoice.dueDate);
      const now = new Date();
      const diffTime = now.getTime() - due.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  if (loading) return <div className="p-12 text-center text-stone-500">Loading Ledger...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-3xl font-bold text-stone-900 flex items-center gap-2">
                <Wallet className="text-primary-600" size={32} />
                Sales Ledger
            </h2>
            <p className="text-stone-500 mt-1">Invoicing and payment reconciliation.</p>
        </div>
        <div className="text-right">
             <div className="text-2xl font-bold text-stone-800">
                 ETB {invoices.reduce((acc, i) => acc + i.amountPaid, 0).toLocaleString()}
             </div>
             <div className="text-xs text-stone-500 font-bold uppercase">Total Collections</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col">
              <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                  <h3 className="font-bold text-stone-700">Orders Pending Invoice</h3>
                  <span className="text-xs bg-stone-200 px-2 py-1 rounded font-bold">{orders.filter(o => {
                      const orderInvoices = invoices.filter(i => i.quoteId === o.id);
                      return orderInvoices.reduce((acc, i) => acc + i.totalAmount, 0) < o.grandTotal;
                  }).length}</span>
              </div>
              <div className="overflow-y-auto max-h-[500px] divide-y divide-stone-50">
                  {orders.map(order => {
                      const orderInvoices = invoices.filter(i => i.quoteId === order.id);
                      const totalInvoiced = orderInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
                      const pctInvoiced = (totalInvoiced / order.grandTotal) * 100;

                      return (
                        <div key={order.id} className="p-4 hover:bg-stone-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-stone-800 text-sm">{order.customerName}</div>
                                    <div className="text-[10px] text-stone-500 font-mono">{order.orderNumber}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-primary-700 text-sm">ETB {order.grandTotal.toLocaleString()}</div>
                                    <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{Math.round(pctInvoiced)}% Invoiced</div>
                                </div>
                            </div>
                            {pctInvoiced < 99.9 ? (
                                <button onClick={() => openInvoiceModal(order)} className="w-full mt-2 py-2 text-xs font-bold text-primary-700 border border-primary-200 bg-primary-50 rounded-lg hover:bg-primary-100 flex items-center justify-center gap-2 transition-colors">
                                    <Plus size={14} /> {totalInvoiced > 0 ? 'Invoice Final Balance' : 'Invoice Deposit'}
                                </button>
                            ) : (
                                <div className="mt-2 text-center text-xs text-green-600 font-bold bg-green-50 py-2 rounded-lg border border-green-100 flex items-center justify-center gap-2">
                                    <CheckCircle size={14} /> Fully Invoiced
                                </div>
                            )}
                        </div>
                      );
                  })}
              </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col">
               <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                  <h3 className="font-bold text-stone-700">Payment Center</h3>
                  <div className="flex gap-2 text-[10px] uppercase font-bold text-stone-400">
                      <span>Total Unpaid: ETB {invoices.reduce((acc, i) => acc + i.balanceDue, 0).toLocaleString()}</span>
                  </div>
              </div>
              <div className="overflow-y-auto max-h-[500px] divide-y divide-stone-50">
                  {invoices.map(inv => {
                      const daysOverdue = getOverdueDays(inv);
                      const isOverdue = daysOverdue > 0;
                      return (
                      <div key={inv.id} className="p-4 hover:bg-stone-50 transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg ${inv.status === InvoiceStatus.PAID ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-500'}`}>
                                     <FileText size={20} />
                                 </div>
                                 <div>
                                     <div className="font-bold text-stone-800 text-sm">{inv.number}</div>
                                     <div className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">{inv.customerName} • {inv.type}</div>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold text-stone-900 text-sm">ETB {inv.totalAmount.toLocaleString()}</div>
                                 {inv.balanceDue > 0 && (
                                     <div className={`text-[10px] font-bold flex items-center justify-end gap-1 ${isOverdue ? 'text-red-600' : 'text-stone-400'}`}>
                                         {isOverdue && <AlertTriangle size={10} />}
                                         {isOverdue ? `${daysOverdue}d overdue` : `Due: ${inv.dueDate}`}
                                     </div>
                                 )}
                             </div>
                          </div>
                          {inv.status !== InvoiceStatus.PAID && (
                              <button onClick={() => openPaymentModal(inv)} className="w-full mt-2 py-2 text-xs font-bold text-white bg-stone-800 rounded-lg hover:bg-stone-900 flex items-center justify-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CreditCard size={14} /> Record Payment
                              </button>
                          )}
                      </div>
                  )})}
              </div>
          </div>
      </div>

      {showInvoiceModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in duration-150">
                  <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-xl">
                      <h3 className="font-bold text-stone-800">Issue New Invoice</h3>
                      <button onClick={() => setShowInvoiceModal(false)} className="hover:bg-stone-200 p-1 rounded-full"><X size={20} className="text-stone-400" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-stone-500 block mb-1 uppercase tracking-wider">Invoice Type</label>
                          <select 
                            className="w-full p-3 border border-stone-300 rounded-lg text-sm"
                            value={invoiceForm.type}
                            onChange={e => setInvoiceForm({...invoiceForm, type: e.target.value as InvoiceType})}
                          >
                              <option value={InvoiceType.DEPOSIT}>Deposit Invoice</option>
                              <option value={InvoiceType.FINAL}>Final Balance Invoice</option>
                          </select>
                      </div>
                      
                      {invoiceForm.type === InvoiceType.DEPOSIT && (
                          <div>
                             <label className="text-xs font-bold text-stone-500 block mb-1 uppercase tracking-wider">Deposit Percentage %</label>
                             <input 
                                type="number" 
                                className="w-full p-3 border border-stone-300 rounded-lg font-mono text-sm"
                                value={invoiceForm.percentage}
                                onChange={e => setInvoiceForm({...invoiceForm, percentage: Number(e.target.value)})}
                             />
                          </div>
                      )}

                      <div>
                          <label className="text-xs font-bold text-stone-500 block mb-1 uppercase tracking-wider">Payment Terms</label>
                          <select 
                            className="w-full p-3 border border-stone-300 rounded-lg text-sm"
                            value={invoiceForm.paymentTerms}
                            onChange={e => setInvoiceForm({...invoiceForm, paymentTerms: Number(e.target.value)})}
                          >
                              <option value={0}>Due Immediately</option>
                              <option value={7}>Net 7 (1 Week)</option>
                              <option value={14}>Net 14 (2 Weeks)</option>
                          </select>
                      </div>

                      <div className="p-5 bg-primary-50 rounded-xl text-center border border-primary-100">
                          <span className="text-[10px] uppercase text-primary-600 font-bold block mb-1 tracking-widest">Total to Invoice</span>
                          <span className="text-2xl font-bold text-primary-800 font-mono">
                              ETB {Math.round(selectedOrder.grandTotal * (invoiceForm.type === InvoiceType.DEPOSIT ? invoiceForm.percentage / 100 : 1)).toLocaleString()} 
                          </span>
                      </div>
                      <button onClick={createInvoice} className="w-full py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-md transition-transform active:scale-95">
                          Confirm & Issue Invoice
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in duration-150">
                  <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-xl">
                      <h3 className="font-bold text-stone-800">Record Payment Received</h3>
                      <button onClick={() => setShowPaymentModal(false)} className="hover:bg-stone-200 p-1 rounded-full"><X size={20} className="text-stone-400" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="bg-stone-50 p-3 rounded border border-stone-200 text-xs flex justify-between">
                          <span className="text-stone-500">Invoice: {selectedInvoice.number}</span>
                          <span className="font-bold text-stone-700">Outstanding: ETB {selectedInvoice.balanceDue.toLocaleString()}</span>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-stone-500 block mb-1 uppercase tracking-wider">Amount Collected (ETB)</label>
                          <input 
                            type="number" 
                            className="w-full p-3 border border-stone-300 rounded-lg font-mono text-xl font-bold text-green-700"
                            value={paymentForm.amount}
                            onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 block mb-1 uppercase">Method</label>
                            <select 
                                className="w-full p-2 border border-stone-300 rounded-lg text-sm"
                                value={paymentForm.method}
                                onChange={e => setPaymentForm({...paymentForm, method: e.target.value as PaymentMethod})}
                            >
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 block mb-1 uppercase">Ref / TXN #</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-stone-300 rounded-lg text-sm font-mono"
                                value={paymentForm.ref}
                                onChange={e => setPaymentForm({...paymentForm, ref: e.target.value})}
                                placeholder="Ref..."
                            />
                        </div>
                      </div>
                      <button onClick={recordPayment} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md transition-transform active:scale-95">
                          Verify & Record Payment
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};