import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Table types (real schema) ────────────────────────────────────────────────

/** drivers table: driver accounts. Primary key is user_id (text). */
export interface Driver {
  user_id: string;
  truck_photo_url?: string | null;
  license_photo_url?: string | null;
  ccp_receipt_url?: string | null;
  ccp_status?: string | null;
  status: string;          // 'pending' | 'approved' | 'rejected'
  is_online?: boolean;
  created_at: string;
}

/** driver_details table: documents & location info. FK = driver_id → drivers.user_id */
export interface DriverDetails {
  driver_id: string;
  wilaya?: string | null;
  commune?: string | null;
  truck_front_photo_url?: string | null;
  driver_license_url?: string | null;
  truck_video_url?: string | null;
  truck_side_photo_url?: string | null;
  is_legacy_driver?: boolean;
}

/** orders table */
export interface Order {
  id: string;
  user_id: string;
  driver_id: string | null;
  water_volume: string;
  barrel_count: number;
  total_price: number;
  latitude: string;
  longitude: string;
  status: string;
  created_at: string;
}

/** subscription_payments table (UNRESTRICTED — anon can read) */
export interface SubscriptionPayment {
  id: string;
  driver_id: string;
  receipt_image?: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

/** announcements table */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: string;
  badge_text?: string | null;
  is_active: boolean;
  created_at: string;
}

/** ratings_disputes table */
export interface RatingDispute {
  id: string;
  driver_id: string | null;
  rating: number;
  comment: string | null;
  wilaya: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
}

export type PaymentStatus = "pending" | "approved" | "rejected";
export type DisputeStatus = "pending" | "resolved" | "dismissed";
