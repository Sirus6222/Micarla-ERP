
-- 1. Products Table
create table if not exists products (
  id text primary key,
  name text not null,
  sku text,
  "pricePerSqm" numeric default 0,
  "defaultWastage" numeric default 0,
  thickness numeric default 0,
  description text,
  "currentStock" numeric default 0,
  "reorderPoint" numeric default 0
);

-- 2. Customers Table
create table if not exists customers (
  id text primary key,
  name text not null,
  "companyName" text,
  email text,
  phone text,
  address text,
  "creditLimit" numeric default 0,
  "creditHold" boolean default false
);

-- 3. Quotes Table
create table if not exists quotes (
  id text primary key,
  number text,
  "orderNumber" text,
  "customerId" text, 
  "customerName" text,
  "salesRepId" text,
  "salesRepName" text,
  date text,
  status text,
  notes text,
  "approvalHistory" jsonb default '[]'::jsonb,
  "subTotal" numeric default 0,
  "discountAmount" numeric default 0,
  tax numeric default 0,
  "grandTotal" numeric default 0,
  "depositAmount" numeric default 0,
  "completionDate" text,
  "stockDeducted" boolean default false
);

-- 4. Quote Items Table (Normalized Line Items)
create table if not exists "quote_items" (
  id text primary key,
  "quoteId" text references quotes(id) on delete cascade,
  "productId" text,
  "productName" text,
  width numeric default 0,
  height numeric default 0,
  pieces numeric default 0,
  depth numeric default 0,
  wastage numeric default 0,
  "pricePerSqm" numeric default 0,
  "discountPercent" numeric default 0,
  "totalSqm" numeric default 0,
  "totalPriceRaw" numeric default 0,
  "pricePlusWaste" numeric default 0,
  "isCompleted" boolean default false
);

-- 5. Invoices Table
create table if not exists invoices (
  id text primary key,
  number text,
  "quoteId" text, 
  "orderNumber" text,
  "customerId" text, 
  "customerName" text,
  "dateIssued" text,
  "dueDate" text,
  type text,
  status text,
  amount numeric default 0,
  "taxAmount" numeric default 0,
  "totalAmount" numeric default 0,
  "amountPaid" numeric default 0,
  "balanceDue" numeric default 0,
  notes text,
  "physicalCopyImage" text
);

-- 6. Payments Table
create table if not exists payments (
  id text primary key,
  "invoiceId" text, 
  "quoteId" text,
  amount numeric default 0,
  date text,
  method text,
  reference text,
  "recordedByUserId" text
);

-- 7. Stock Records Table
create table if not exists "stockRecords" (
  id text primary key,
  "productId" text, 
  "productName" text,
  quantity numeric default 0,
  date text,
  reference text,
  "recordedBy" text
);

-- 8. Audit Logs Table
create table if not exists "auditLogs" (
  id text primary key,
  "userId" text,
  "userName" text,
  action text,
  "entityType" text,
  "entityId" text,
  "oldValue" text,
  "newValue" text,
  timestamp text,
  reason text
);

-- RLS Policies (Open Access for Demo Purposes)
alter table products enable row level security;
alter table customers enable row level security;
alter table quotes enable row level security;
alter table "quote_items" enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table "stockRecords" enable row level security;
alter table "auditLogs" enable row level security;

-- Products Policies
drop policy if exists "Public Select Products" on products;
create policy "Public Select Products" on products for select using (true);

drop policy if exists "Public Insert Products" on products;
create policy "Public Insert Products" on products for insert with check (true);

drop policy if exists "Public Update Products" on products;
create policy "Public Update Products" on products for update using (true);

-- Customers Policies
drop policy if exists "Public Select Customers" on customers;
create policy "Public Select Customers" on customers for select using (true);

drop policy if exists "Public Insert Customers" on customers;
create policy "Public Insert Customers" on customers for insert with check (true);

drop policy if exists "Public Update Customers" on customers;
create policy "Public Update Customers" on customers for update using (true);

-- Quotes Policies
drop policy if exists "Public Select Quotes" on quotes;
create policy "Public Select Quotes" on quotes for select using (true);

drop policy if exists "Public Insert Quotes" on quotes;
create policy "Public Insert Quotes" on quotes for insert with check (true);

drop policy if exists "Public Update Quotes" on quotes;
create policy "Public Update Quotes" on quotes for update using (true);

-- Quote Items Policies
drop policy if exists "Public Select QuoteItems" on "quote_items";
create policy "Public Select QuoteItems" on "quote_items" for select using (true);

drop policy if exists "Public Insert QuoteItems" on "quote_items";
create policy "Public Insert QuoteItems" on "quote_items" for insert with check (true);

drop policy if exists "Public Update QuoteItems" on "quote_items";
create policy "Public Update QuoteItems" on "quote_items" for update using (true);

drop policy if exists "Public Delete QuoteItems" on "quote_items";
create policy "Public Delete QuoteItems" on "quote_items" for delete using (true);

-- Invoices Policies
drop policy if exists "Public Select Invoices" on invoices;
create policy "Public Select Invoices" on invoices for select using (true);

drop policy if exists "Public Insert Invoices" on invoices;
create policy "Public Insert Invoices" on invoices for insert with check (true);

drop policy if exists "Public Update Invoices" on invoices;
create policy "Public Update Invoices" on invoices for update using (true);

-- Payments Policies
drop policy if exists "Public Select Payments" on payments;
create policy "Public Select Payments" on payments for select using (true);

drop policy if exists "Public Insert Payments" on payments;
create policy "Public Insert Payments" on payments for insert with check (true);

drop policy if exists "Public Update Payments" on payments;
create policy "Public Update Payments" on payments for update using (true);

-- Stock Records Policies
drop policy if exists "Public Select Stock" on "stockRecords";
create policy "Public Select Stock" on "stockRecords" for select using (true);

drop policy if exists "Public Insert Stock" on "stockRecords";
create policy "Public Insert Stock" on "stockRecords" for insert with check (true);

drop policy if exists "Public Update Stock" on "stockRecords";
create policy "Public Update Stock" on "stockRecords" for update using (true);

-- Audit Logs Policies
drop policy if exists "Public Select Audit" on "auditLogs";
create policy "Public Select Audit" on "auditLogs" for select using (true);

drop policy if exists "Public Insert Audit" on "auditLogs";
create policy "Public Insert Audit" on "auditLogs" for insert with check (true);
