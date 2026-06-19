import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface DriverDetails {
  driver_id: string;
  wilaya?: string;
  commune?: string;
  truck_front_photo_url?: string | null;
  driver_license_url?: string | null;
  truck_video_url?: string | null;
  truck_side_photo_url?: string | null;
  is_legacy_driver?: boolean;
}

export interface PendingDriver extends User {
  driver_details?: DriverDetails[];
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
  customer?: User | null;
  driver?: User | null;
}

export interface SubscriptionPayment {
  id: string;
  driver_id: string;
  status: PaymentStatus;
  created_at: string;
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
  target_user_id?: string | null;
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

export async function insertTargetedAnnouncement(
  title: string,
  content: string,
  badgeText: BadgeType,
  targetUserId: string
) {
  const payload: any = {
    title,
    content,
    target_audience: "Drivers",
    badge_text: badgeText,
    is_active: true,
    target_user_id: targetUserId,
  };
  const { error } = await supabase.from("announcements").insert(payload);
  return error;
}
