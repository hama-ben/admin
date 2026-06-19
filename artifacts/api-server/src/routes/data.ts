import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SUPABASE_URL = "https://aeoyteruvcxqimwusrey.supabase.co";
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set — data routes will fail");
}

function adminClient() {
  if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// GET /api/data/dashboard
router.get("/dashboard", async (_req, res) => {
  try {
    const db = adminClient();

    const [
      { count: totalUsers },
      { count: totalConsumers },
      { count: totalDrivers },
      { count: ordersCompleted },
      { count: pendingVerifications },
      { count: activeDrivers },
    ] = await Promise.all([
      db.from("users").select("*", { count: "exact", head: true }),
      db.from("users").select("*", { count: "exact", head: true }).eq("user_type", "مستهلك"),
      db.from("users").select("*", { count: "exact", head: true }).eq("user_type", "سائق"),
      db.from("orders").select("*", { count: "exact", head: true }).eq("status", "تم التوصيل"),
      db.from("drivers").select("*", { count: "exact", head: true }).eq("status", "pending"),
      db.from("drivers").select("*", { count: "exact", head: true }).eq("status", "approved").eq("is_online", true),
    ]);

    const { data: completedOrders } = await db
      .from("orders")
      .select("total_price")
      .eq("status", "تم التوصيل");
    const totalRevenue = (completedOrders ?? []).reduce((s, o) => s + Number(o.total_price), 0);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders } = await db
      .from("orders")
      .select("created_at")
      .gte("created_at", since);

    const daily: Record<string, number> = {};
    (recentOrders ?? []).forEach((o) => {
      const d = o.created_at.slice(0, 10);
      daily[d] = (daily[d] || 0) + 1;
    });
    const chartData = Object.entries(daily)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalUsers: totalUsers ?? 0,
      totalConsumers: totalConsumers ?? 0,
      totalDrivers: totalDrivers ?? 0,
      ordersCompleted: ordersCompleted ?? 0,
      pendingVerifications: pendingVerifications ?? 0,
      activeDrivers: activeDrivers ?? 0,
      totalRevenue,
      chartData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/drivers/pending
router.get("/drivers/pending", async (_req, res) => {
  try {
    const db = adminClient();
    // Get all pending drivers from drivers table, join user info
    const { data: pendingDrivers, error } = await db
      .from("drivers")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!pendingDrivers || pendingDrivers.length === 0) {
      res.json([]);
      return;
    }

    const userIds = pendingDrivers.map((d: any) => d.user_id);
    const { data: users } = await db
      .from("users")
      .select("id, name, phone, wilaya, commune, account_status, user_type")
      .in("id", userIds);

    const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    const { data: details } = await db
      .from("driver_details")
      .select("*")
      .in("driver_id", userIds);
    const detailsMap = new Map((details ?? []).map((d: any) => [d.driver_id, d]));

    const enriched = pendingDrivers.map((d: any) => ({
      ...d,
      user: usersMap.get(d.user_id) ?? null,
      details: detailsMap.get(d.user_id) ?? null,
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/data/drivers/:userId/status
router.patch("/drivers/:userId/status", async (req, res) => {
  try {
    const db = adminClient();
    const { userId } = req.params;
    const { status } = req.body as { status: string };

    const { error } = await db
      .from("drivers")
      .update({ status })
      .eq("user_id", userId);

    if (error) throw error;

    if (status === "approved") {
      await db
        .from("users")
        .update({ account_status: "active" })
        .eq("id", userId);
    } else if (status === "rejected") {
      await db
        .from("users")
        .update({ account_status: "rejected" })
        .eq("id", userId);
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/users
router.get("/users", async (req, res) => {
  try {
    const db = adminClient();
    const { role, search, wilaya, page = "0", pageSize = "20" } = req.query as Record<string, string>;

    let query = db.from("users").select("*", { count: "exact" });

    if (role === "driver") query = query.eq("user_type", "سائق");
    else if (role === "consumer") query = query.eq("user_type", "مستهلك");
    if (wilaya && wilaya !== "all") query = query.eq("wilaya", wilaya);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    query = query
      .order("id", { ascending: false })
      .range(p * ps, (p + 1) * ps - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ data: data ?? [], count: count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/orders
router.get("/orders", async (req, res) => {
  try {
    const db = adminClient();
    const { status, dateFrom, dateTo, page = "0", pageSize = "20" } = req.query as Record<string, string>;

    let query = db.from("orders").select("*", { count: "exact" });
    if (status && status !== "all") query = query.eq("status", status);
    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      query = query.lte("created_at", to.toISOString());
    }
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    query = query
      .order("created_at", { ascending: false })
      .range(p * ps, (p + 1) * ps - 1);

    const { data: rawOrders, count, error } = await query;
    if (error) throw error;
    if (!rawOrders || rawOrders.length === 0) {
      res.json({ data: [], count: 0 });
      return;
    }

    const userIdSet = new Set<string>();
    rawOrders.forEach((o: any) => {
      if (o.user_id) userIdSet.add(o.user_id);
      if (o.driver_id) userIdSet.add(o.driver_id);
    });
    const { data: users } = await db
      .from("users")
      .select("id, name, phone, wilaya")
      .in("id", Array.from(userIdSet));
    const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    const data = rawOrders.map((o: any) => ({
      ...o,
      customerUser: o.user_id ? usersMap.get(o.user_id) ?? null : null,
      driverUser: o.driver_id ? usersMap.get(o.driver_id) ?? null : null,
    }));

    res.json({ data, count: count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/payments
router.get("/payments", async (req, res) => {
  try {
    const db = adminClient();
    const { status } = req.query as { status?: string };

    let query = db.from("subscription_payments").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data: payments, error } = await query;
    if (error) throw error;
    if (!payments || payments.length === 0) {
      res.json([]);
      return;
    }

    const driverIds = [...new Set(payments.map((p: any) => p.driver_id).filter(Boolean))];
    const { data: users } = await db
      .from("users")
      .select("id, name, phone, wilaya, subscription_expires_at")
      .in("id", driverIds);
    const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    const data = payments.map((p: any) => ({
      ...p,
      driver: usersMap.get(p.driver_id) ?? null,
    }));

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/payments/summary
router.get("/payments/summary", async (_req, res) => {
  try {
    const db = adminClient();
    const { data: approved, error } = await db
      .from("subscription_payments")
      .select("driver_id, status")
      .eq("status", "approved");
    if (error) throw error;

    const driverIds = [...new Set((approved ?? []).map((p: any) => p.driver_id).filter(Boolean))];
    const { data: users } = await db
      .from("users")
      .select("id, wilaya")
      .in("id", driverIds);
    const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    const byWilaya: Record<string, number> = {};
    (approved ?? []).forEach((p: any) => {
      const w = usersMap.get(p.driver_id)?.wilaya || "Unknown";
      byWilaya[w] = (byWilaya[w] || 0) + 1;
    });

    res.json({
      approvedCount: approved?.length ?? 0,
      totalRevenue: (approved?.length ?? 0) * 1000,
      wilayaRevenue: Object.entries(byWilaya)
        .map(([wilaya, count]) => ({ wilaya, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/data/payments/:id
router.patch("/payments/:id", async (req, res) => {
  try {
    const db = adminClient();
    const { id } = req.params;
    const { status, driver_id, subscription_expires_at } = req.body;

    const { error } = await db
      .from("subscription_payments")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    if (status === "approved" && driver_id) {
      const base = subscription_expires_at ? Math.max(new Date(subscription_expires_at).getTime(), Date.now()) : Date.now();
      const newExpiry = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .from("users")
        .update({ subscription_expires_at: newExpiry, account_status: "active" })
        .eq("id", driver_id);
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/disputes
router.get("/disputes", async (_req, res) => {
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("ratings_disputes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      res.json([]);
      return;
    }

    const driverIds = [...new Set(data.map((d: any) => d.driver_id).filter(Boolean))];
    const { data: users } = await db
      .from("users")
      .select("id, name, phone, wilaya, user_type")
      .in("id", driverIds);
    const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

    res.json(data.map((d: any) => ({
      ...d,
      user: usersMap.get(d.driver_id) ?? null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/data/disputes/:id
router.patch("/disputes/:id", async (req, res) => {
  try {
    const db = adminClient();
    const { status } = req.body;
    const { error } = await db
      .from("ratings_disputes")
      .update({ status })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/disputes/pending-count
router.get("/disputes/pending-count", async (_req, res) => {
  try {
    const db = adminClient();
    const { count, error } = await db
      .from("ratings_disputes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) throw error;
    res.json({ count: count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/data/announcements
router.get("/announcements", async (_req, res) => {
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/data/announcements
router.post("/announcements", async (req, res) => {
  try {
    const db = adminClient();
    const { title, content, badge_text, target_audience } = req.body;
    const { data, error } = await db
      .from("announcements")
      .insert({ title, content, badge_text, target_audience, is_active: true })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
