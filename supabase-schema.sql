-- Al-Shaibia Admin Panel — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query

-- =========================================
-- TABLES
-- =========================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'driver')),
  wilaya TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers table (linked to users)
CREATE TABLE IF NOT EXISTS public.drivers (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  truck_photo_url TEXT,
  license_photo_url TEXT,
  ccp_receipt_url TEXT,
  ccp_status TEXT DEFAULT 'pending' CHECK (ccp_status IN ('pending', 'approved', 'rejected')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id),
  driver_id UUID REFERENCES public.users(id),
  details TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled', 'Rejected')),
  wilaya TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('Info', 'Warning', 'Success', 'Promo')),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('Everyone', 'Drivers', 'Consumers')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ratings & Disputes table
CREATE TABLE IF NOT EXISTS public.ratings_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  wilaya TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- ENABLE REALTIME (for live subscriptions)
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings_disputes ENABLE ROW LEVEL SECURITY;

-- OPTION A: Allow all access with anon key (simplest for admin-only panel)
-- Use this if your admin panel is the only thing using Supabase.
CREATE POLICY "Allow all for anon" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.drivers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.announcements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.ratings_disputes FOR ALL TO anon USING (true) WITH CHECK (true);

-- =========================================
-- STORAGE BUCKETS (for photo uploads)
-- =========================================
-- Run these separately in Supabase Dashboard → Storage → New bucket
-- Or uncomment if using the SQL editor with storage extension:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('driver-docs', 'driver-docs', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);
