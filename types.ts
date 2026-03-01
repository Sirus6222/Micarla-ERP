
export enum Role {
  ADMIN = 'Admin',
  SALES_REP = 'Sales Representative',
  MANAGER = 'Senior Manager',
  FINANCE = 'Finance Officer',
  FACTORY = 'Factory Foreman'
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatarInitials: string;
}

export enum QuoteStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted for Approval',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  ORDERED = 'Converted to Order',
  ACCEPTED = 'Accepted by Factory',
  IN_PRODUCTION = 'In Production',
  READY = 'Ready for Pickup',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum InvoiceStatus {
  DRAFT = 'Draft',
  ISSUED = 'Issued',
  PARTIALLY_PAID = 'Partially Paid',
  PAID = 'Paid',
  OVERDUE = 'Overdue',
  VOID = 'Void'
}

export enum InvoiceType {
  DEPOSIT = 'Deposit',
  FINAL = 'Final Balance',
  STANDARD = 'Standard',
  CREDIT_NOTE = 'Credit Note'
}

export enum PaymentMethod {
  BANK_TRANSFER = 'Bank Transfer',
  CASH = 'Cash',
  CHECK = 'Check',
  CARD = 'Credit Card'
}

export interface AuditRecord {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'Quote' | 'Product' | 'Customer' | 'Invoice' | 'Payment' | 'Settings';
  entityId: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  reason?: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt?: string;
  updatedBy?: string;
}

// StockRecord interface for procurement tracking
export interface StockRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  date: string;
  reference?: string;
  recordedBy: string;
}

export interface ApprovalLog {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RESET' | 'ORDER' | 'ACCEPT' | 'START_WORK' | 'PRODUCTION' | 'READY' | 'COMPLETE' | 'CANCEL';
  timestamp: string;
  comment?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  pricePerSqm: number;
  defaultWastage: number;
  thickness: number;
  description?: string;
  currentStock: number;
  reservedStock: number;
  reorderPoint: number;
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditHold: boolean;
}

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  width: number;
  height: number;
  pieces: number;
  depth: number; 
  wastage: number; 
  pricePerSqm: number;
  discountPercent?: number;
  totalSqm: number; 
  totalPriceRaw: number; 
  pricePlusWaste: number; 
  isCompleted?: boolean;
}

export interface Quote {
  id: string;
  number: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  salesRepId: string;
  salesRepName: string;
  date: string;
  status: QuoteStatus;
  items: QuoteLineItem[];
  notes?: string;
  approvalHistory: ApprovalLog[];
  subTotal: number;
  discountAmount?: number;
  tax: number;
  grandTotal: number;
  depositAmount?: number;
  completionDate?: string;
  stockDeducted?: boolean;
  stockReserved?: boolean;
  cancellationReason?: string;
}

export interface Invoice {
  id: string;
  number: string;
  quoteId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  dateIssued: string;
  dueDate: string;
  type: InvoiceType;
  status: InvoiceStatus;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  physicalCopyImage?: string; // Base64 or URL of the physical invoice scan
}

export interface Payment {
  id: string;
  invoiceId: string;
  quoteId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  recordedByUserId: string;
}
