
import { supabase } from '../lib/supabase';
import { Product, Customer, Quote, QuoteStatus, User, Role, Invoice, Payment, InvoiceStatus, InvoiceType, StockRecord, AuditRecord, QuoteLineItem } from '../types';

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
  getAll: async (): Promise<Quote[]> => {
    const { data, error } = await supabase.from('quotes').select('*, items:quote_items(*)');
    if (error) {
      console.error(error);
      return [];
    }
    return data as Quote[];
  },
  getById: async (id: string): Promise<Quote | undefined> => {
    const { data, error } = await supabase.from('quotes').select('*, items:quote_items(*)').eq('id', id).single();
    if (error) return undefined;
    return data as Quote;
  },
  getByCustomerId: async (customerId: string): Promise<Quote[]> => {
    const { data } = await supabase.from('quotes').select('*, items:quote_items(*)').eq('customerId', customerId);
    return data as Quote[] || [];
  },
  save: async (quote: Quote, user: User): Promise<void> => {
    const oldQuote = await QuoteService.getById(quote.id);
    
    // 1. Separate items from quote body
    const { items, ...quoteHeader } = quote;
    
    // 2. Save Header
    await upsert('quotes', quoteHeader);

    // 3. Save Items (Normalized)
    // First, remove existing items to handle deletions/updates cleanly
    await supabase.from('quote_items').delete().eq('quoteId', quote.id);
    
    // Then insert current items
    const itemsToInsert = items.map(item => ({
      ...item,
      quoteId: quote.id
    }));
    
    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('quote_items').insert(itemsToInsert);
      if (error) console.error("Error saving quote items:", error);
    }

    // 4. Auditing
    if (oldQuote) {
      // Status Change
      if (oldQuote.status !== quote.status) {
        await AuditService.log({ userId: user.id, userName: user.name, action: 'STATUS_CHANGE', entityType: 'Quote', entityId: quote.id, oldValue: oldQuote.status, newValue: quote.status });
      }
      
      // Items Change
      const oldItemsStr = JSON.stringify(oldQuote.items.map(i => ({ p: i.productId, w: i.width, h: i.height, qty: i.pieces })));
      const newItemsStr = JSON.stringify(quote.items.map(i => ({ p: i.productId, w: i.width, h: i.height, qty: i.pieces })));
      
      if (oldItemsStr !== newItemsStr) {
        await AuditService.log({ 
          userId: user.id, 
          userName: user.name, 
          action: 'ITEMS_UPDATE', 
          entityType: 'Quote', 
          entityId: quote.id, 
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
  getInvoicesByQuote: async (quoteId: string): Promise<Invoice[]> => {
    const { data } = await supabase.from('invoices').select('*').eq('quoteId', quoteId);
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

export const SystemService = {
  restoreDemoData: async (): Promise<void> => {
    console.log('Restoring demo data...');
    
    // 1. PRODUCTS
    const products: Product[] = [
      { id: 'p1', name: 'Galaxy Black Granite', sku: 'GR-BLK-001', pricePerSqm: 4500, defaultWastage: 15, thickness: 20, currentStock: 120.5, reorderPoint: 50, description: 'Premium Indian black granite with gold flecks.' },
      { id: 'p2', name: 'Carrara White Marble', sku: 'MR-WHT-002', pricePerSqm: 5200, defaultWastage: 20, thickness: 20, currentStock: 45.0, reorderPoint: 30, description: 'Classic Italian white marble with soft grey veining.' },
      { id: 'p3', name: 'Calacatta Gold Quartz', sku: 'QZ-GLD-003', pricePerSqm: 6800, defaultWastage: 10, thickness: 20, currentStock: 200.0, reorderPoint: 40, description: 'Engineered quartz stone with bold gold veining.' },
      { id: 'p4', name: 'Blue Pearl Granite', sku: 'GR-BLU-004', pricePerSqm: 5800, defaultWastage: 15, thickness: 20, currentStock: 80.0, reorderPoint: 25, description: 'Norwegian granite with shimmering blue crystals.' },
      { id: 'p5', name: 'Ethiopian Gray', sku: 'GR-ETH-005', pricePerSqm: 2800, defaultWastage: 12, thickness: 20, currentStock: 300.0, reorderPoint: 100, description: 'Locally sourced durable gray granite suitable for flooring.' },
      { id: 'p6', name: 'Rose Pink Granite', sku: 'GR-PNK-006', pricePerSqm: 3200, defaultWastage: 15, thickness: 20, currentStock: 150.0, reorderPoint: 50, description: 'Vibrant pink granite often used for stairs and skirting.' },
      { id: 'p7', name: 'Absolute Black', sku: 'GR-ABS-007', pricePerSqm: 4800, defaultWastage: 10, thickness: 30, currentStock: 60.0, reorderPoint: 20, description: 'Pure black granite, excellent for kitchen countertops.' }
    ];

    // 2. CUSTOMERS
    const customers: Customer[] = [
      { id: 'c1', name: 'Abebe Kebede', companyName: 'Acme Construction PLC', email: 'abebe@acme.et', phone: '0911234567', address: 'Bole Road, Addis Ababa', creditLimit: 500000, creditHold: false },
      { id: 'c2', name: 'Sara Tadesse', companyName: 'Modern Interiors', email: 'sara@modern.et', phone: '0922876543', address: 'Kazanchis, Addis Ababa', creditLimit: 200000, creditHold: false },
      { id: 'c3', name: 'Dawit Construction', companyName: 'Dawit General Contractor', email: 'info@dawit.et', phone: '0933998877', address: 'Lebu, Addis Ababa', creditLimit: 100000, creditHold: true },
      { id: 'c4', name: 'Yoseph Alemu', companyName: 'Bole Towers', email: 'yoseph@boletowers.com', phone: '0944556677', address: 'Gerji, Addis Ababa', creditLimit: 1000000, creditHold: false },
      { id: 'c5', name: 'Tigist Haile', companyName: '', email: 'tigist.h@gmail.com', phone: '0912341234', address: 'CMC, Addis Ababa', creditLimit: 50000, creditHold: false }
    ];

    // 3. QUOTES & ITEMS
    const quotesData: any[] = [
       {
        id: 'q1',
        number: 'Q-1001',
        customerId: 'c1',
        customerName: 'Acme Construction PLC',
        salesRepId: 'u1',
        salesRepName: 'Alex Sales',
        date: new Date().toISOString().split('T')[0],
        status: QuoteStatus.DRAFT,
        subTotal: 37260,
        tax: 5589,
        grandTotal: 42849,
        approvalHistory: [],
        stockDeducted: false,
        items: [
          { id: 'i1', productId: 'p1', productName: 'Galaxy Black Granite', width: 2.4, height: 0.6, pieces: 5, depth: 0.02, wastage: 15, pricePerSqm: 4500, totalSqm: 7.2, totalPriceRaw: 32400, pricePlusWaste: 37260, discountPercent: 0 }
        ]
      },
      {
        id: 'q2',
        number: 'Q-1002',
        orderNumber: 'ORD-55421',
        customerId: 'c4',
        customerName: 'Bole Towers',
        salesRepId: 'u1',
        salesRepName: 'Alex Sales',
        date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        status: QuoteStatus.IN_PRODUCTION,
        subTotal: 106776.8, 
        tax: 16016.5,
        grandTotal: 122793.3,
        approvalHistory: [
            { id: 'h1', userId: 'u1', userName: 'Alex Sales', userRole: Role.SALES_REP, action: 'SUBMIT', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
            { id: 'h2', userId: 'u2', userName: 'Sarah Manager', userRole: Role.MANAGER, action: 'APPROVE', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), comment: 'Approved, good margin.' },
            { id: 'h3', userId: 'u2', userName: 'Sarah Manager', userRole: Role.MANAGER, action: 'ORDER', timestamp: new Date(Date.now() - 86400000 * 1).toISOString() },
            { id: 'h4', userId: 'u4', userName: 'Tom Factory', userRole: Role.FACTORY, action: 'ACCEPT', timestamp: new Date(Date.now() - 43200000).toISOString() },
            { id: 'h5', userId: 'u4', userName: 'Tom Factory', userRole: Role.FACTORY, action: 'START_WORK', timestamp: new Date().toISOString() }
        ],
        stockDeducted: false,
        items: [
          { id: 'i2a', productId: 'p5', productName: 'Ethiopian Gray', width: 1.2, height: 1.2, pieces: 20, depth: 0.02, wastage: 12, pricePerSqm: 2800, totalSqm: 28.8, totalPriceRaw: 80640, pricePlusWaste: 90316.8, discountPercent: 5 },
          { id: 'i2b', productId: 'p6', productName: 'Rose Pink Granite', width: 2.0, height: 0.3, pieces: 10, depth: 0.02, wastage: 15, pricePerSqm: 3200, totalSqm: 6.0, totalPriceRaw: 19200, pricePlusWaste: 22080, discountPercent: 0 }
        ]
      },
      {
        id: 'q3',
        number: 'Q-998',
        orderNumber: 'ORD-11029',
        customerId: 'c2',
        customerName: 'Modern Interiors',
        salesRepId: 'u1',
        salesRepName: 'Alex Sales',
        date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
        status: QuoteStatus.COMPLETED,
        subTotal: 20196,
        tax: 3029.4,
        grandTotal: 23225.4,
        approvalHistory: [],
        stockDeducted: true,
        items: [
           { id: 'i3', productId: 'p3', productName: 'Calacatta Gold Quartz', width: 3.0, height: 0.9, pieces: 1, depth: 0.02, wastage: 10, pricePerSqm: 6800, totalSqm: 2.7, totalPriceRaw: 18360, pricePlusWaste: 20196, discountPercent: 0 }
        ]
      }
    ];

    await supabase.from('products').upsert(products);
    await supabase.from('customers').upsert(customers);
    
    // Save Quotes and Items
    for (const q of quotesData) {
        const { items, ...header } = q;
        await supabase.from('quotes').upsert(header);
        const itemsWithId = items.map((i: any) => ({...i, quoteId: q.id}));
        await supabase.from('quote_items').delete().eq('quoteId', q.id);
        await supabase.from('quote_items').upsert(itemsWithId);
    }
    
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
    
    // 5. INVOICES & PAYMENTS (For the active/completed quotes)
    const invoices: Invoice[] = [
        // Deposit invoice for q2
        {
            id: 'inv1', number: 'INV-5001', quoteId: 'q2', orderNumber: 'ORD-55421', 
            customerId: 'c4', customerName: 'Bole Towers',
            dateIssued: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
            type: InvoiceType.DEPOSIT, status: InvoiceStatus.PAID,
            amount: 60000, taxAmount: 0, totalAmount: 60000, amountPaid: 60000, balanceDue: 0
        },
        // Final invoice for q3 (Fully paid)
        {
            id: 'inv2', number: 'INV-4900', quoteId: 'q3', orderNumber: 'ORD-11029', 
            customerId: 'c2', customerName: 'Modern Interiors',
            dateIssued: new Date(Date.now() - 86400000 * 8).toISOString().split('T')[0],
            dueDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
            type: InvoiceType.FINAL, status: InvoiceStatus.PAID,
            amount: 23225.4, taxAmount: 0, totalAmount: 23225.4, amountPaid: 23225.4, balanceDue: 0
        }
    ];
    await supabase.from('invoices').upsert(invoices);

    console.log('Demo data restored successfully.');
  }
};
