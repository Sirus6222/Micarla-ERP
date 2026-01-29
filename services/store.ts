
import { supabase } from '../lib/supabase';
import { Product, Customer, Quote, QuoteStatus, User, Role, Invoice, Payment, InvoiceStatus, InvoiceType, StockRecord, AuditRecord } from '../types';

// Hardcoded users for Auth Context (Authentication remains client-side for now)
const SEED_USERS: User[] = [
  { id: 'u1', name: 'Alex Sales', role: Role.SALES_REP, avatarInitials: 'AS' },
  { id: 'u2', name: 'Sarah Manager', role: Role.MANAGER, avatarInitials: 'SM' },
  { id: 'u3', name: 'Frank Finance', role: Role.FINANCE, avatarInitials: 'FF' },
  { id: 'u4', name: 'Tom Factory', role: Role.FACTORY, avatarInitials: 'TF' },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Generic Helpers ---

const fetchAll = async <T>(table: string): Promise<T[]> => {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
  return data as T[];
};

const fetchById = async <T>(table: string, id: string): Promise<T | undefined> => {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) return undefined;
  return data as T;
};

const upsert = async <T extends { id: string }>(table: string, item: T): Promise<void> => {
  const { error } = await supabase.from(table).upsert(item);
  if (error) throw error;
};

// --- Services ---

export const AuditService = {
  log: async (record: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<void> => {
    // We fire and forget audit logs to not block UI
    supabase.from('auditLogs').insert({ 
      ...record, 
      id: generateId(), 
      timestamp: new Date().toISOString() 
    }).then(({ error }) => {
      if (error) console.error('Audit log failed', error);
    });
  },
  getForEntity: async (entityId: string): Promise<AuditRecord[]> => {
    const { data } = await supabase
      .from('auditLogs')
      .select('*')
      .eq('entityId', entityId)
      .order('timestamp', { ascending: false });
    return data || [];
  }
};

export const UserService = {
  // Keeping Users local for now as per current auth implementation
  getAll: async (): Promise<User[]> => SEED_USERS,
  getById: async (id: string): Promise<User | undefined> => SEED_USERS.find(u => u.id === id)
};

export const ProductService = {
  getAll: async (): Promise<Product[]> => fetchAll('products'),
  getById: async (id: string): Promise<Product | undefined> => fetchById('products', id),
  add: async (item: Omit<Product, 'id'>, user: User): Promise<Product> => {
    const newItem = { ...item, id: generateId() };
    await upsert('products', newItem);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'CREATE', entityType: 'Product', entityId: newItem.id, newValue: JSON.stringify(newItem) });
    return newItem;
  },
  update: async (product: Product, user: User): Promise<void> => {
    const old = await fetchById<Product>('products', product.id);
    await upsert('products', product);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'UPDATE', entityType: 'Product', entityId: product.id, oldValue: JSON.stringify(old), newValue: JSON.stringify(product) });
  },
  adjustStock: async (id: string, change: number, user: User, reason: string): Promise<void> => {
    const product = await ProductService.getById(id);
    if (product) {
      const oldVal = product.currentStock;
      product.currentStock = Math.max(0, (Number(product.currentStock) || 0) + change);
      await upsert('products', product);
      await AuditService.log({ userId: user.id, userName: user.name, action: 'STOCK_ADJUST', entityType: 'Product', entityId: id, oldValue: String(oldVal), newValue: String(product.currentStock), reason });
    }
  }
};

export const CustomerService = {
  getAll: async (): Promise<Customer[]> => fetchAll('customers'),
  getById: async (id: string): Promise<Customer | undefined> => fetchById('customers', id),
  add: async (item: Omit<Customer, 'id'>, user: User): Promise<Customer> => {
    const newItem = { ...item, id: generateId() };
    await upsert('customers', newItem);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'CREATE', entityType: 'Customer', entityId: newItem.id, newValue: JSON.stringify(newItem) });
    return newItem;
  },
  update: async (customer: Customer, user: User): Promise<void> => {
    const old = await fetchById<Customer>('customers', customer.id);
    await upsert('customers', customer);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'UPDATE', entityType: 'Customer', entityId: customer.id, oldValue: JSON.stringify(old), newValue: JSON.stringify(customer) });
  }
};

export const QuoteService = {
  getAll: async (): Promise<Quote[]> => fetchAll('quotes'),
  getById: async (id: string): Promise<Quote | undefined> => fetchById('quotes', id),
  getByCustomerId: async (customerId: string): Promise<Quote[]> => {
    const { data } = await supabase.from('quotes').select('*').eq('customerId', customerId);
    return data || [];
  },
  save: async (quote: Quote, user: User): Promise<void> => {
    const old = await fetchById<Quote>('quotes', quote.id);
    await upsert('quotes', quote);
    if (old?.status !== quote.status) {
      await AuditService.log({ userId: user.id, userName: user.name, action: 'STATUS_CHANGE', entityType: 'Quote', entityId: quote.id, oldValue: old?.status, newValue: quote.status });
    }
  },
  createEmpty: async (user: User): Promise<Quote> => {
    const id = generateId();
    // Get count for ID generation
    const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
    const nextNum = (count || 0) + 1000;
    
    return {
      id, 
      number: `Q-${nextNum}`, 
      customerId: '', 
      customerName: '',
      salesRepId: user.id, 
      salesRepName: user.name, 
      date: new Date().toISOString().split('T')[0],
      status: QuoteStatus.DRAFT, 
      items: [], 
      approvalHistory: [], 
      subTotal: 0, 
      tax: 0, 
      grandTotal: 0, 
      stockDeducted: false
    };
  }
};

export const FinanceService = {
  getAllInvoices: async (): Promise<Invoice[]> => fetchAll('invoices'),
  getInvoicesByQuote: async (quoteId: string): Promise<Invoice[]> => {
    const { data } = await supabase.from('invoices').select('*').eq('quoteId', quoteId);
    return data || [];
  },
  createInvoice: async (invoice: Invoice, user: User): Promise<void> => {
    await upsert('invoices', invoice);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, newValue: JSON.stringify(invoice) });
  },
  recordPayment: async (payment: Payment, user: User): Promise<void> => {
    await upsert('payments', payment);
    const invoice = await fetchById<Invoice>('invoices', payment.invoiceId);
    if (invoice) {
      const { data: allPayments } = await supabase.from('payments').select('*').eq('invoiceId', payment.invoiceId);
      const totalPaid = (allPayments || []).reduce((sum, p) => sum + p.amount, 0);
      
      invoice.amountPaid = totalPaid;
      invoice.balanceDue = Math.max(0, invoice.totalAmount - totalPaid);
      invoice.status = invoice.balanceDue <= 0.01 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      
      await upsert('invoices', invoice);
      await AuditService.log({ userId: user.id, userName: user.name, action: 'PAYMENT', entityType: 'Payment', entityId: payment.id, newValue: JSON.stringify(payment) });
    }
  }
};

export const StockService = {
  getHistory: async (): Promise<StockRecord[]> => fetchAll('stockRecords'),
  recordStockIn: async (productId: string, quantity: number, reference: string, user: User): Promise<void> => {
    const product = await ProductService.getById(productId);
    if (product) {
      const record: StockRecord = {
        id: generateId(),
        productId,
        productName: product.name,
        quantity,
        date: new Date().toISOString(),
        reference,
        recordedBy: user.name
      };
      await upsert('stockRecords', record);
      // Adjust existing product stock levels
      await ProductService.adjustStock(productId, quantity, user, `Procurement: ${reference || 'Manual Stock In'}`);
    }
  }
};
