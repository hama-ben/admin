import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// Anon client — used only for realtime subscriptions (if needed)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// All data queries now go through /api/data/* (Express server with service role key)
// Types kept here for reference

export type DriverStatus = "pending" | "approved" | "rejected" | "active";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type BadgeType = "Info" | "Warning" | "Success" | "Promo";
export type TargetAudience = "Everyone" | "Drivers" | "Consumers";
export type DisputeStatus = "pending" | "resolved" | "dismissed";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  user_type: string;
  wilaya?: string;
  commune?: string;
  account_status?: string;
  subscription_expires_at?: string;
  free_trial_claimed?: boolean;
}

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

export interface SubscriptionPayment {
  id: string;
  driver_id: string;
  receipt_image?: string | null;
  status: PaymentStatus;
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  driver?: User;
  [key: string]: any;
}

export interface Announcement {
  id: string;
  title: string;
  badge_text?: string;
  target_audience: string;
  content: string;
  is_active: boolean;
  created_at: string;
}
