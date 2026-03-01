
import { supabase } from '../lib/supabase';
import { Product, Customer, Quote, QuoteStatus, User, Role, Invoice, Payment, InvoiceStatus, InvoiceType, StockRecord, AuditRecord, QuoteLineItem, AppSetting } from '../types';
import { PRECISION_THRESHOLD } from '../utils/constants';

const generateId = () => crypto.randomUUID();

// --- Generic Helpers ---

const fetchAll = async <T>(table: string): Promise<T[]> => {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    throw new Error(`Failed to fetch ${table}: ${error.message}`);
  }
  return data as T[];
};

const fetchById = async <T>(table: string, id: string): Promise<T | undefined> => {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return undefined; // Not found
    throw new Error(`Failed to fetch ${table}/${id}: ${error.message}`);
  }
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
  getAll: async (): Promise<(User & { email?: string })[]> => {
    // Fetches from the public profiles table which mirrors auth.users
    const { data, error } = await supabase.from('profiles').select('*');
    if(error || !data) return [];
    
    return data.map(p => ({
      id: p.id,
      name: p.name || 'Unknown',
      role: p.role as Role,
      avatarInitials: p.avatarInitials || 'U',
      email: p.email
    }));
  },
  getById: async (id: string): Promise<User | undefined> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!data) return undefined;
    return {
      id: data.id,
      name: data.name || 'Unknown',
      role: data.role as Role,
      avatarInitials: data.avatarInitials || 'U'
    };
  },
  update: async (user: Partial<User>): Promise<void> => {
    if (!user.id) return;
    const { error } = await supabase.from('profiles').update({
      name: user.name,
      role: user.role,
      avatarInitials: user.avatarInitials
    }).eq('id', user.id);
    if (error) throw error;
  },
  delete: async (id: string): Promise<void> => {
     // Deleting the profile effectively removes access for the user in the app context
     const { error } = await supabase.from('profiles').delete().eq('id', id);
     if (error) throw error;
  }
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
  },
  reserveStock: async (id: string, sqm: number, user: User, orderNumber: string): Promise<{ success: boolean; available: number; productName: string }> => {
    const product = await ProductService.getById(id);
    if (!product) return { success: false, available: 0, productName: 'Unknown' };
    const reserved = Number(product.reservedStock) || 0;
    const current = Number(product.currentStock) || 0;
    const available = current - reserved;
    if (sqm > available) return { success: false, available, productName: product.name };
    const updated = { ...product, reservedStock: reserved + sqm };
    await upsert('products', updated);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'STOCK_RESERVE', entityType: 'Product', entityId: id, oldValue: String(reserved), newValue: String(updated.reservedStock), reason: `Reserved for ${orderNumber}` });
    return { success: true, available, productName: product.name };
  },
  releaseReservation: async (id: string, sqm: number, user: User, orderNumber: string): Promise<void> => {
    const product = await ProductService.getById(id);
    if (!product) return;
    const newReserved = Math.max(0, (Number(product.reservedStock) || 0) - sqm);
    const updated = { ...product, reservedStock: newReserved };
    await upsert('products', updated);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'STOCK_RELEASE', entityType: 'Product', entityId: id, oldValue: String(product.reservedStock), newValue: String(newReserved), reason: `Reservation released for ${orderNumber}` });
  },
  convertReservationToDeduction: async (id: string, sqm: number, user: User, orderNumber: string): Promise<void> => {
    const product = await ProductService.getById(id);
    if (!product) return;
    const oldStock = Number(product.currentStock) || 0;
    const oldReserved = Number(product.reservedStock) || 0;
    const updated = { ...product, currentStock: Math.max(0, oldStock - sqm), reservedStock: Math.max(0, oldReserved - sqm) };
    await upsert('products', updated);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'STOCK_ADJUST', entityType: 'Product', entityId: id, oldValue: String(oldStock), newValue: String(updated.currentStock), reason: `Order completed, reservation converted: ${orderNumber}` });
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
  getAll: async (): Promise<Quote[]> => {
    const { data, error } = await supabase.from('quotes').select('*, items:quote_items(*)');
    if (error) throw new Error(`Failed to fetch quotes: ${error.message}`);
    return data as Quote[];
  },
  getById: async (id: string): Promise<Quote | undefined> => {
    const { data, error } = await supabase.from('quotes').select('*, items:quote_items(*)').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return undefined;
      throw new Error(`Failed to fetch quote ${id}: ${error.message}`);
    }
    return data as Quote;
  },
  getByCustomerId: async (customerId: string): Promise<Quote[]> => {
    const { data, error } = await supabase.from('quotes').select('*, items:quote_items(*)').eq('customerId', customerId);
    if (error) throw new Error(`Failed to fetch quotes for customer: ${error.message}`);
    return data as Quote[] || [];
  },
  save: async (quote: Quote, user: User): Promise<void> => {
    const oldQuote = await QuoteService.getById(quote.id);

    const { items, ...quoteHeader } = quote;

    // Save Header
    await upsert('quotes', quoteHeader);

    // Save Items - use upsert to atomically update, avoiding delete-then-insert race condition
    const itemsToInsert = items.map(item => ({ ...item, quoteId: quote.id }));

    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('quote_items').upsert(itemsToInsert);
      if (error) {
        console.error("Error saving quote items:", error);
        throw new Error(`Failed to save quote items: ${error.message}`);
      }
    }

    // Remove items that were deleted by the user (exist in old but not in new)
    if (oldQuote?.items) {
      const newItemIds = new Set(items.map(i => i.id));
      const removedIds = oldQuote.items.map(i => i.id).filter(id => !newItemIds.has(id));
      if (removedIds.length > 0) {
        await supabase.from('quote_items').delete().in('id', removedIds);
      }
    }

    // Auditing
    if (oldQuote) {
      if (oldQuote.status !== quote.status) {
        await AuditService.log({ userId: user.id, userName: user.name, action: 'STATUS_CHANGE', entityType: 'Quote', entityId: quote.id, oldValue: oldQuote.status, newValue: quote.status });
      }

      const oldItemsStr = JSON.stringify(oldQuote.items.map(i => ({ p: i.productId, w: i.width, h: i.height, qty: i.pieces })));
      const newItemsStr = JSON.stringify(quote.items.map(i => ({ p: i.productId, w: i.width, h: i.height, qty: i.pieces })));

      if (oldItemsStr !== newItemsStr) {
        await AuditService.log({
          userId: user.id, userName: user.name, action: 'ITEMS_UPDATE',
          entityType: 'Quote', entityId: quote.id,
          reason: `Line items updated (${items.length} items)`
        });
      }
    } else {
      await AuditService.log({ userId: user.id, userName: user.name, action: 'CREATE', entityType: 'Quote', entityId: quote.id, newValue: quote.number });
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
  getInvoiceById: async (id: string): Promise<Invoice | undefined> => fetchById('invoices', id),
  getInvoicesByQuote: async (quoteId: string): Promise<Invoice[]> => {
    const { data } = await supabase.from('invoices').select('*').eq('quoteId', quoteId);
    return data || [];
  },
  getPaymentsByInvoiceId: async (invoiceId: string): Promise<Payment[]> => {
     const { data } = await supabase.from('payments').select('*').eq('invoiceId', invoiceId).order('date', { ascending: false });
     return data || [];
  },
  createInvoice: async (invoice: Invoice, user: User): Promise<void> => {
    await upsert('invoices', invoice);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, newValue: JSON.stringify(invoice) });
  },
  attachInvoiceImage: async (invoice: Invoice, imageData: string, user: User): Promise<void> => {
    invoice.physicalCopyImage = imageData;
    await upsert('invoices', invoice);
    await AuditService.log({ userId: user.id, userName: user.name, action: 'UPDATE', entityType: 'Invoice', entityId: invoice.id, reason: 'Physical invoice attached' });
  },
  checkAndMarkOverdue: async (): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    // Single batch update instead of N+1 loop: mark all past-due open invoices as OVERDUE
    await supabase
      .from('invoices')
      .update({ status: InvoiceStatus.OVERDUE })
      .in('status', [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID])
      .lt('dueDate', today);
  },
  recordPayment: async (payment: Payment, user: User): Promise<void> => {
    await upsert('payments', payment);
    const invoice = await fetchById<Invoice>('invoices', payment.invoiceId);
    if (invoice) {
      // Use SUM query instead of fetching all payment rows
      const { data: sumResult } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoiceId', payment.invoiceId);
      const totalPaid = (sumResult || []).reduce((sum: number, p: any) => sum + p.amount, 0);

      const updated = {
        ...invoice,
        amountPaid: totalPaid,
        balanceDue: Math.max(0, invoice.totalAmount - totalPaid),
        status: Math.max(0, invoice.totalAmount - totalPaid) <= PRECISION_THRESHOLD ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID
      };
      await upsert('invoices', updated);
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

export const SystemService = {
  restoreDemoData: async (): Promise<void> => {
    console.log('Restoring demo data...');
    
    // 1. PRODUCTS
    const products: Product[] = [
      { id: 'p1', name: 'Galaxy Black Granite', sku: 'GR-BLK-001', pricePerSqm: 4500, defaultWastage: 15, thickness: 20, currentStock: 120.5, reservedStock: 0, reorderPoint: 50, description: 'Premium Indian black granite with gold flecks.' },
      { id: 'p2', name: 'Carrara White Marble', sku: 'MR-WHT-002', pricePerSqm: 5200, defaultWastage: 20, thickness: 20, currentStock: 45.0, reservedStock: 0, reorderPoint: 30, description: 'Classic Italian white marble with soft grey veining.' },
      { id: 'p3', name: 'Calacatta Gold Quartz', sku: 'QZ-GLD-003', pricePerSqm: 6800, defaultWastage: 10, thickness: 20, currentStock: 200.0, reservedStock: 0, reorderPoint: 40, description: 'Engineered quartz stone with bold gold veining.' },
      { id: 'p4', name: 'Blue Pearl Granite', sku: 'GR-BLU-004', pricePerSqm: 5800, defaultWastage: 15, thickness: 20, currentStock: 80.0, reservedStock: 0, reorderPoint: 25, description: 'Norwegian granite with shimmering blue crystals.' },
      { id: 'p5', name: 'Ethiopian Gray', sku: 'GR-ETH-005', pricePerSqm: 2800, defaultWastage: 12, thickness: 20, currentStock: 300.0, reservedStock: 0, reorderPoint: 100, description: 'Locally sourced durable gray granite suitable for flooring.' },
      { id: 'p6', name: 'Rose Pink Granite', sku: 'GR-PNK-006', pricePerSqm: 3200, defaultWastage: 15, thickness: 20, currentStock: 150.0, reservedStock: 0, reorderPoint: 50, description: 'Vibrant pink granite often used for stairs and skirting.' },
      { id: 'p7', name: 'Absolute Black', sku: 'GR-ABS-007', pricePerSqm: 4800, defaultWastage: 10, thickness: 30, currentStock: 60.0, reservedStock: 0, reorderPoint: 20, description: 'Pure black granite, excellent for kitchen countertops.' }
    ];

    // 2. CUSTOMERS
    const customers: Customer[] = [
      { id: 'c1', name: 'Abebe Kebede', companyName: 'Acme Construction PLC', email: 'abebe@acme.et', phone: '0911234567', address: 'Bole Road, Addis Ababa', creditLimit: 500000, creditHold: false },
      { id: 'c2', name: 'Sara Tadesse', companyName: 'Modern Interiors', email: 'sara@modern.et', phone: '0922876543', address: 'Kazanchis, Addis Ababa', creditLimit: 200000, creditHold: false },
      { id: 'c3', name: 'Dawit Construction', companyName: 'Dawit General Contractor', email: 'info@dawit.et', phone: '0933998877', address: 'Lebu, Addis Ababa', creditLimit: 100000, creditHold: true },
      { id: 'c4', name: 'Yoseph Alemu', companyName: 'Bole Towers', email: 'yoseph@boletowers.com', phone: '0944556677', address: 'Gerji, Addis Ababa', creditLimit: 1000000, creditHold: false },
      { id: 'c5', name: 'Tigist Haile', companyName: '', email: 'tigist.h@gmail.com', phone: '0912341234', address: 'CMC, Addis Ababa', creditLimit: 50000, creditHold: false }
    ];

    // Note: In real auth, we can't seed users like this. 
    // We assume the users are created via the Login/Sign Up page.

    await supabase.from('products').upsert(products);
    await supabase.from('customers').upsert(customers);
    
    // 4. STOCK RECORDS (Initial Balance)
    const stockRecords = products.map(p => ({
        id: `sr_${p.id}`,
        productId: p.id,
        productName: p.name,
        quantity: p.currentStock,
        date: new Date().toISOString(),
        reference: 'Initial Balance',
        recordedBy: 'System'
    }));
    await supabase.from('stockRecords').upsert(stockRecords);
    
    console.log('Demo data restored successfully.');
  }
};

export const SettingsService = {
  get: async (key: string): Promise<string | null> => {
    const { data } = await supabase.from('appSettings').select('value').eq('key', key).single();
    return data?.value ?? null;
  },
  getAll: async (): Promise<AppSetting[]> => {
    const { data } = await supabase.from('appSettings').select('*');
    return (data as AppSetting[]) || [];
  },
  set: async (key: string, value: string, user: User): Promise<void> => {
    const { error } = await supabase.from('appSettings').upsert({
      key,
      value,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name
    });
    if (error) throw error;
    await AuditService.log({
      userId: user.id,
      userName: user.name,
      action: 'SETTINGS_UPDATE',
      entityType: 'Settings',
      entityId: key,
      newValue: value
    });
  }
};
