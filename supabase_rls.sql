-- ============================================================
-- Role-Based RLS Policies for GraniteFlow ERP
-- ============================================================
-- Run this in the Supabase SQL Editor AFTER supabase.sql and supabase_auth.sql.
-- It replaces the open "using (true)" policies with proper role checks.
--
-- Roles: Admin, Sales Representative, Senior Manager, Finance Officer, Factory Foreman
-- ============================================================

-- Helper function: get current user's role from profiles
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================================
-- PRODUCTS: All authenticated can read. Admin/Manager can write.
-- ============================================================
drop policy if exists "Public Select Products" on products;
drop policy if exists "Public Insert Products" on products;
drop policy if exists "Public Update Products" on products;

create policy "Authenticated Select Products" on products
  for select using (auth.uid() is not null);

create policy "Admin/Manager Insert Products" on products
  for insert with check (
    public.get_my_role() in ('Admin', 'Senior Manager')
  );

create policy "Admin/Manager Update Products" on products
  for update using (
    public.get_my_role() in ('Admin', 'Senior Manager')
  );

-- ============================================================
-- CUSTOMERS: All authenticated can read. Sales/Manager/Admin can write.
-- ============================================================
drop policy if exists "Public Select Customers" on customers;
drop policy if exists "Public Insert Customers" on customers;
drop policy if exists "Public Update Customers" on customers;

create policy "Authenticated Select Customers" on customers
  for select using (auth.uid() is not null);

create policy "Sales/Manager/Admin Insert Customers" on customers
  for insert with check (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

create policy "Sales/Manager/Admin Update Customers" on customers
  for update using (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

-- ============================================================
-- QUOTES: All authenticated can read. Sales/Manager/Admin can write.
-- ============================================================
drop policy if exists "Public Select Quotes" on quotes;
drop policy if exists "Public Insert Quotes" on quotes;
drop policy if exists "Public Update Quotes" on quotes;

create policy "Authenticated Select Quotes" on quotes
  for select using (auth.uid() is not null);

create policy "Sales/Manager/Admin Insert Quotes" on quotes
  for insert with check (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

create policy "Sales/Manager/Admin Update Quotes" on quotes
  for update using (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

-- ============================================================
-- QUOTE ITEMS: Same as quotes
-- ============================================================
drop policy if exists "Public Select QuoteItems" on "quote_items";
drop policy if exists "Public Insert QuoteItems" on "quote_items";
drop policy if exists "Public Update QuoteItems" on "quote_items";
drop policy if exists "Public Delete QuoteItems" on "quote_items";

create policy "Authenticated Select QuoteItems" on "quote_items"
  for select using (auth.uid() is not null);

create policy "Sales/Manager/Admin Insert QuoteItems" on "quote_items"
  for insert with check (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

create policy "Sales/Manager/Admin Update QuoteItems" on "quote_items"
  for update using (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

create policy "Sales/Manager/Admin Delete QuoteItems" on "quote_items"
  for delete using (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Sales Representative')
  );

-- ============================================================
-- INVOICES: All authenticated can read. Finance/Admin can write.
-- ============================================================
drop policy if exists "Public Select Invoices" on invoices;
drop policy if exists "Public Insert Invoices" on invoices;
drop policy if exists "Public Update Invoices" on invoices;

create policy "Authenticated Select Invoices" on invoices
  for select using (auth.uid() is not null);

create policy "Finance/Admin Insert Invoices" on invoices
  for insert with check (
    public.get_my_role() in ('Admin', 'Finance Officer')
  );

create policy "Finance/Admin Update Invoices" on invoices
  for update using (
    public.get_my_role() in ('Admin', 'Finance Officer')
  );

-- ============================================================
-- PAYMENTS: All authenticated can read. Finance/Admin can write.
-- ============================================================
drop policy if exists "Public Select Payments" on payments;
drop policy if exists "Public Insert Payments" on payments;
drop policy if exists "Public Update Payments" on payments;

create policy "Authenticated Select Payments" on payments
  for select using (auth.uid() is not null);

create policy "Finance/Admin Insert Payments" on payments
  for insert with check (
    public.get_my_role() in ('Admin', 'Finance Officer')
  );

create policy "Finance/Admin Update Payments" on payments
  for update using (
    public.get_my_role() in ('Admin', 'Finance Officer')
  );

-- ============================================================
-- STOCK RECORDS: All authenticated can read. Admin/Manager/Factory can write.
-- ============================================================
drop policy if exists "Public Select Stock" on "stockRecords";
drop policy if exists "Public Insert Stock" on "stockRecords";
drop policy if exists "Public Update Stock" on "stockRecords";

create policy "Authenticated Select Stock" on "stockRecords"
  for select using (auth.uid() is not null);

create policy "Admin/Manager/Factory Insert Stock" on "stockRecords"
  for insert with check (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Factory Foreman')
  );

create policy "Admin/Manager/Factory Update Stock" on "stockRecords"
  for update using (
    public.get_my_role() in ('Admin', 'Senior Manager', 'Factory Foreman')
  );

-- ============================================================
-- AUDIT LOGS: All authenticated can read. All authenticated can insert (logging).
-- ============================================================
drop policy if exists "Public Select Audit" on "auditLogs";
drop policy if exists "Public Insert Audit" on "auditLogs";

create policy "Authenticated Select Audit" on "auditLogs"
  for select using (auth.uid() is not null);

create policy "Authenticated Insert Audit" on "auditLogs"
  for insert with check (auth.uid() is not null);
