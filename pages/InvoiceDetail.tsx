
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FinanceService, QuoteService } from '../services/store';
import { Invoice, Payment, Quote, InvoiceStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, FileText, Calendar, CreditCard, Camera, Download, Paperclip, AlertTriangle, CheckCircle, User, Box } from 'lucide-react';
import { formatCurrency } from '../utils/format';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [invoice, setInvoice] = useState<Invoice | undefined>();
  const [quote, setQuote] = useState<Quote | undefined>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (id) {
        try {
            const inv = await FinanceService.getInvoiceById(id);
            setInvoice(inv);
            if (inv) {
                const [q, p] = await Promise.all([
                    QuoteService.getById(inv.quoteId),
                    FinanceService.getPaymentsByInvoiceId(inv.id)
                ]);
                setQuote(q);
                setPayments(p);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && invoice && user) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;
            await FinanceService.attachInvoiceImage(invoice, base64Data, user);
            setInvoice({ ...invoice, physicalCopyImage: base64Data });
        };
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Loading Invoice Details...</div>;
  if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found.</div>;

  const isOverdue = invoice.status !== InvoiceStatus.PAID && new Date(invoice.dueDate) < new Date();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/finance" className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors">
        <ArrowLeft size={20} /> Back to Finance Dashboard
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
              <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-stone-900">{invoice.number}</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                      invoice.status === InvoiceStatus.PAID ? 'bg-green-100 text-green-700 border-green-200' :
                      isOverdue ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                      {isOverdue && invoice.status !== InvoiceStatus.OVERDUE ? 'OVERDUE' : invoice.status}
                  </span>
              </div>
              <p className="text-stone-500 mt-1 flex items-center gap-2">
                 <span className="font-bold">{invoice.type}</span> 
                 <span>•</span> 
                 Issued {new Date(invoice.dateIssued).toLocaleDateString()}
              </p>
          </div>
          <button onClick={() => window.print()} className="px-4 py-2 border border-stone-300 rounded-lg font-bold text-stone-600 hover:bg-stone-50 transition-colors">
              Print Record
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* Financial Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Amount</span>
                      <div className="text-2xl font-bold text-stone-900 mt-1">ETB {formatCurrency(invoice.totalAmount)}</div>
                      <div className="text-xs text-stone-400 mt-1">Tax: ETB {formatCurrency(invoice.taxAmount)}</div>
                  </div>
                   <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Paid to Date</span>
                      <div className="text-2xl font-bold text-green-600 mt-1">ETB {formatCurrency(invoice.amountPaid)}</div>
                  </div>
                   <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Balance Due</span>
                      <div className={`text-2xl font-bold mt-1 ${invoice.balanceDue > 0 ? 'text-red-600' : 'text-stone-400'}`}>
                          ETB {formatCurrency(invoice.balanceDue)}
                      </div>
                      {invoice.balanceDue > 0 && (
                          <div className="text-xs font-bold text-red-500 mt-1 flex items-center gap-1">
                             <Calendar size={12} /> Due: {new Date(invoice.dueDate).toLocaleDateString()}
                          </div>
                      )}
                  </div>
              </div>

              {/* Customer & Order Link */}
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-4 border-b border-stone-200 bg-stone-50 font-bold text-stone-700">Client & Order Details</div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="text-xs font-bold text-stone-400 uppercase block mb-2">Customer</label>
                          <Link to={`/customers/${invoice.customerId}`} className="flex items-center gap-3 group">
                              <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                  <User size={20} />
                              </div>
                              <div>
                                  <div className="font-bold text-stone-800 group-hover:text-primary-700 transition-colors">{invoice.customerName}</div>
                                  <div className="text-xs text-stone-400">View Profile</div>
                              </div>
                          </Link>
                      </div>
                      <div>
                           <label className="text-xs font-bold text-stone-400 uppercase block mb-2">Linked Order</label>
                           {quote ? (
                               <Link to={`/quotes/${quote.id}`} className="flex items-center gap-3 group">
                                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                                      <Box size={20} />
                                  </div>
                                  <div>
                                      <div className="font-bold text-stone-800 group-hover:text-blue-700 transition-colors">{invoice.orderNumber || quote.number}</div>
                                      <div className="text-xs text-stone-400">Total Value: ETB {formatCurrency(quote.grandTotal)}</div>
                                  </div>
                               </Link>
                           ) : (
                               <div className="text-stone-400 italic text-sm">Order information unavailable</div>
                           )}
                      </div>
                  </div>
              </div>

               {/* Payment History */}
               <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-4 border-b border-stone-200 bg-stone-50 font-bold text-stone-700 flex justify-between items-center">
                      <span>Payment History</span>
                      <span className="text-xs font-normal bg-stone-200 px-2 py-0.5 rounded-full">{payments.length} Records</span>
                  </div>
                  {payments.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 italic">No payments recorded yet.</div>
                  ) : (
                      <div className="divide-y divide-stone-100">
                          {payments.map(p => (
                              <div key={p.id} className="p-4 flex justify-between items-center hover:bg-stone-50">
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                          <CreditCard size={18} />
                                      </div>
                                      <div>
                                          <div className="font-bold text-stone-800">ETB {formatCurrency(p.amount)}</div>
                                          <div className="text-xs text-stone-500">{new Date(p.date).toLocaleDateString()} via {p.method}</div>
                                      </div>
                                  </div>
                                  <div className="text-right text-xs text-stone-400">
                                      {p.reference && <div>Ref: {p.reference}</div>}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

          </div>

          {/* Right Column: Attachments */}
          <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-4 border-b border-stone-200 bg-stone-50 font-bold text-stone-700 flex items-center gap-2">
                      <Paperclip size={16} /> Physical Copy
                  </div>
                  
                  <div className="p-4 bg-stone-100 min-h-[300px] flex items-center justify-center">
                      {invoice.physicalCopyImage ? (
                          <div className="relative group w-full">
                              <img src={invoice.physicalCopyImage} alt="Invoice Scan" className="w-full rounded shadow-sm border border-stone-200" />
                              <a 
                                href={invoice.physicalCopyImage} 
                                download={`Invoice-${invoice.number}.png`}
                                className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-lg text-stone-700 shadow-sm hover:text-primary-600 transition-colors"
                              >
                                  <Download size={16} />
                              </a>
                          </div>
                      ) : (
                          <div className="text-center">
                              <FileText size={48} className="text-stone-300 mx-auto mb-2" />
                              <p className="text-sm text-stone-500 font-medium">No image attached</p>
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-stone-200">
                      <label className="w-full cursor-pointer bg-stone-800 text-white font-bold py-3 rounded-xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2 text-sm">
                        <Camera size={16} />
                        {invoice.physicalCopyImage ? 'Replace Image' : 'Upload / Take Photo'}
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                            onChange={handleFileUpload}
                        />
                    </label>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
