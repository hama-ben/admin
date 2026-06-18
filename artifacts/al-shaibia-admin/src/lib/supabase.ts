import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "consumer" | "driver";
export type DriverStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type BadgeType = "Info" | "Warning" | "Success" | "Promo";
export type TargetAudience = "Everyone" | "Drivers" | "Consumers";
export type OrderStatus = "Pending" | "Completed" | "Cancelled" | "Rejected";
export type DisputeStatus = "pending" | "resolved" | "dismissed";

export interface User {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  wilaya: string;
  is_verified: boolean;
  created_at: string;
}

export interface Driver {
  user_id: string;
  truck_photo_url: string | null;
  license_photo_url: string | null;
  ccp_receipt_url: string | null;
  ccp_status: PaymentStatus | null;
  status: DriverStatus;
  is_online: boolean;
  users?: User;
}

export interface Order {
  id: string;
  customer_id: string;
  driver_id: string | null;
  details: string;
  price: number;
  status: OrderStatus;
  wilaya: string;
  created_at: string;
  customer?: User;
  driver?: User;
}

export interface Payment {
  id: string;
  driver_id: string;
  amount: number;
  receipt_url: string | null;
  status: PaymentStatus;
  created_at: string;
  driver?: User;
}

export interface Announcement {
  id: string;
  title: string;
  badge_type: BadgeType;
  target_audience: TargetAudience;
  message: string;
  created_at: string;
}

export interface RatingDispute {
  id: string;
  driver_id: string;
  rating: number;
  comment: string | null;
  wilaya: string;
  status: DisputeStatus;
  created_at: string;
  driver?: User;
}

export interface DashboardStats {
  totalUsers: number;
  totalConsumers: number;
  totalDrivers: number;
  ordersCompleted: number;
  totalRevenue: number;
  activeDrivers: number;
  pendingVerifications: number;
}

export interface SignupDataPoint {
  date: string;
  count: number;
}
