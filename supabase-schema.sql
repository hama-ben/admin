-- =============================================================
-- AL-SHAIBIA ADMIN PANEL — SUPABASE SCHEMA
-- Supabase Dashboard → SQL Editor → New Query → paste → Run
-- =============================================================


-- =============================================================
-- SECTION 1: TABLES
-- Order matters: public.users must exist before any table that
-- references it via a foreign key (drivers, orders, payments,
-- ratings_disputes).
-- =============================================================

-- 1a. Users (consumers + drivers)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('consumer', 'driver')),
  wilaya      TEXT,
  is_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. Drivers (extends users — one row per driver)
CREATE TABLE IF NOT EXISTS public.drivers (
  user_id           UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  truck_photo_url   TEXT,
  license_photo_url TEXT,
  ccp_receipt_url   TEXT,
  ccp_status        TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (ccp_status IN ('pending', 'approved', 'rejected')),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  is_online         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1c. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  driver_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  details     TEXT        NOT NULL,
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending', 'Completed', 'Cancelled', 'Rejected')),
  wilaya      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1d. Payments (subscription receipts from drivers)
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  receipt_url TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1e. Announcements (no FK — standalone content)
CREATE TABLE IF NOT EXISTS public.announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  badge_type      TEXT        NOT NULL CHECK (badge_type IN ('Info', 'Warning', 'Success', 'Promo')),
  target_audience TEXT        NOT NULL CHECK (target_audience IN ('Everyone', 'Drivers', 'Consumers')),
  message         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1f. Ratings & Disputes
CREATE TABLE IF NOT EXISTS public.ratings_disputes (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  rating    INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment   TEXT,
  wilaya    TEXT,
  status    TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- SECTION 2: ROW LEVEL SECURITY (RLS)
-- The admin dashboard uses the anon key, so policies grant
-- full SELECT / INSERT / UPDATE / DELETE to the anon role.
-- If you later add Supabase Auth for admin login, also add
-- policies for the `authenticated` role below.
-- =============================================================

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings_disputes ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "admin_anon_all_users"
  ON public.users FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- drivers
CREATE POLICY "admin_anon_all_drivers"
  ON public.drivers FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- orders
CREATE POLICY "admin_anon_all_orders"
  ON public.orders FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- payments
CREATE POLICY "admin_anon_all_payments"
  ON public.payments FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- announcements
CREATE POLICY "admin_anon_all_announcements"
  ON public.announcements FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- ratings_disputes
CREATE POLICY "admin_anon_all_disputes"
  ON public.ratings_disputes FOR ALL TO anon
  USING (true) WITH CHECK (true);


-- =============================================================
-- SECTION 3: REALTIME PUBLICATION
-- Enables live Supabase subscriptions used by:
--   - Dashboard (users signups, driver counts)
--   - Driver Queue (new pending drivers appear instantly)
--   - Orders (live order status changes)
-- =============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;


-- =============================================================
-- SECTION 4: STORAGE BUCKETS & POLICIES
-- Two buckets:
--   driver-documents  — truck photos, license photos, CCP receipts
--   receipts          — standalone payment receipt uploads
-- Both are public so the admin dashboard can display images
-- directly via their storage URLs without auth headers.
-- =============================================================

-- Create buckets (safe to re-run: INSERT … ON CONFLICT DO NOTHING)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('driver-documents', 'driver-documents', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', true)
  ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow anon to upload files into driver-documents
CREATE POLICY "anon_upload_driver_documents"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'driver-documents');

-- Allow anon to read files from driver-documents
CREATE POLICY "anon_read_driver_documents"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'driver-documents');

-- Allow anon to upload files into receipts
CREATE POLICY "anon_upload_receipts"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'receipts');

-- Allow anon to read files from receipts
CREATE POLICY "anon_read_receipts"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'receipts');

-- Allow anon to update/delete their own uploaded files (optional)
CREATE POLICY "anon_update_driver_documents"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'driver-documents');

CREATE POLICY "anon_update_receipts"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'receipts');
