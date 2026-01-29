
-- Run this script in the Supabase SQL Editor to sync your database with the latest changes.

-- 1. Create the new quote_items table (if it doesn't exist)
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

-- 2. Enable Row Level Security
alter table "quote_items" enable row level security;

-- 3. Create RLS Policies for quote_items
-- (Dropping first to avoid conflicts if they already exist from partial runs)
drop policy if exists "Public Select QuoteItems" on "quote_items";
drop policy if exists "Public Insert QuoteItems" on "quote_items";
drop policy if exists "Public Update QuoteItems" on "quote_items";
drop policy if exists "Public Delete QuoteItems" on "quote_items";

create policy "Public Select QuoteItems" on "quote_items" for select using (true);
create policy "Public Insert QuoteItems" on "quote_items" for insert with check (true);
create policy "Public Update QuoteItems" on "quote_items" for update using (true);
create policy "Public Delete QuoteItems" on "quote_items" for delete using (true);

-- 4. OPTIONAL: Data Migration
-- If you have existing quotes with items in a JSONB 'items' column, run this block to migrate them.
-- If your 'quotes' table does not have an 'items' column, this part will be skipped or error out safely.

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'quotes' and column_name = 'items') then
    -- Insert JSON items into the new table
    insert into quote_items (
        id, "quoteId", "productId", "productName", width, height, pieces, depth, wastage, "pricePerSqm", "discountPercent", "totalSqm", "totalPriceRaw", "pricePlusWaste"
    )
    select
        coalesce(item->>'id', md5(random()::text || clock_timestamp()::text)::uuid::text), -- Generate ID if missing
        q.id,
        item->>'productId',
        item->>'productName',
        coalesce((item->>'width')::numeric, 0),
        coalesce((item->>'height')::numeric, 0),
        coalesce((item->>'pieces')::numeric, 0),
        coalesce((item->>'depth')::numeric, 0.03),
        coalesce((item->>'wastage')::numeric, 0),
        coalesce((item->>'pricePerSqm')::numeric, 0),
        coalesce((item->>'discountPercent')::numeric, 0),
        coalesce((item->>'totalSqm')::numeric, 0),
        coalesce((item->>'totalPriceRaw')::numeric, 0),
        coalesce((item->>'pricePlusWaste')::numeric, 0)
    from
        quotes q,
        jsonb_array_elements(q.items) as item
    where
        not exists (select 1 from quote_items where "quoteId" = q.id);
        
    -- Optional: You can drop the items column from quotes after verifying data
    -- alter table quotes drop column items;
  end if;
exception
  when others then
    raise notice 'Migration skipped or failed: %', SQLERRM;
end $$;
