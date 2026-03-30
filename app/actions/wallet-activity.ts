"use server";

import { createClient } from "@/lib/supabase/server";

export type WalletActivityItem = {
  key: string;
  ts: string;
  title: string;
  subtitle?: string;
  cashDelta: number | null;
  creditsDelta: number | null;
  xpDelta: number | null;
  statusLabel?: string;
  adminNote?: string | null;
  kind: "transaction" | "order" | "withdrawal" | "wallet_event";
};

const TX_LABELS: Record<string, string> = {
  gig_reward: "Gig reward",
  withdrawal: "Withdrawal",
  purchase: "Purchase",
  referral_bonus: "Referral bonus",
  wallet_deposit: "Wallet top-up",
};

function mapTransaction(t: {
  id: string;
  type: string;
  amount: number | string;
  status: string;
  clears_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}): WalletActivityItem {
  const amt = Number(t.amount);
  const meta = t.metadata ?? {};
  const extra =
    typeof meta.label === "string"
      ? meta.label
      : typeof meta.description === "string"
        ? meta.description
        : null;
  let cashDelta: number | null = Number.isFinite(amt) ? amt : null;
  if (cashDelta != null) {
    if (t.type === "purchase" || t.type === "withdrawal") {
      if (cashDelta > 0) cashDelta = -cashDelta;
    }
  }
  const cr = meta.credits_used ?? meta.credits_delta;
  const creditsDelta =
    typeof cr === "number"
      ? cr
      : typeof cr === "string" && cr !== ""
        ? Number(cr)
        : null;
  const xpM = meta.xp_delta ?? meta.xp;
  const xpDelta =
    typeof xpM === "number"
      ? xpM
      : typeof xpM === "string" && xpM !== ""
        ? Number(xpM)
        : null;
  return {
    key: `tx:${t.id}`,
    ts: t.created_at,
    title: TX_LABELS[t.type] ?? t.type,
    subtitle: extra ?? (t.clears_at ? `Clears: ${new Date(t.clears_at).toLocaleString()}` : undefined),
    cashDelta,
    creditsDelta: Number.isFinite(creditsDelta ?? NaN) ? creditsDelta : null,
    xpDelta: Number.isFinite(xpDelta ?? NaN) ? xpDelta : null,
    statusLabel: t.status,
    kind: "transaction",
  };
}

function mapOrder(
  o: {
    id: string;
    cash_paid?: number | string | null;
    credits_used?: number | string | null;
    items?: unknown;
    status: string;
    created_at: string;
  },
  productTitles: Map<string, string>
): WalletActivityItem {
  const items = (o.items ?? []) as { id?: string; quantity?: number }[];
  const parts = items
    .map((it) => {
      const title = it.id ? productTitles.get(it.id) : undefined;
      const name = title ?? it.id ?? "?";
      return `${name} ×${it.quantity ?? 1}`;
    })
    .slice(0, 4);
  const more = items.length > 4 ? ` +${items.length - 4} more` : "";
  const cash = Number(o.cash_paid ?? 0);
  const cr = Number(o.credits_used ?? 0);
  return {
    key: `order:${o.id}`,
    ts: o.created_at,
    title: "Perks Shop",
    subtitle: parts.length ? `${parts.join(", ")}${more}` : `Order ${o.id.slice(0, 8)}…`,
    cashDelta: cash > 0 ? -cash : null,
    creditsDelta: cr > 0 ? -cr : null,
    xpDelta: null,
    statusLabel: o.status,
    kind: "order",
  };
}

function mapWithdrawal(w: Record<string, unknown>): WalletActivityItem {
  const id = String(w.id);
  const amt = Number(w.amount);
  const status = String(w.status ?? "").toLowerCase();
  let title = "Withdrawal";
  if (status === "pending") title = "Withdrawal (pending review)";
  else if (status === "completed") title = "Withdrawal (paid out)";
  else if (status === "rejected") title = "Withdrawal (rejected)";
  const cashDelta =
    status === "rejected" ? amt : Number.isFinite(amt) ? -amt : null;
  const adminMsg = w.admin_message;
  const adminNote =
    typeof adminMsg === "string" && adminMsg.trim() ? adminMsg.trim() : null;
  return {
    key: `wd:${id}`,
    ts: String(w.created_at),
    title,
    subtitle: `${w.method} · Net $${Number(w.net_amount ?? amt).toFixed(2)} (fee $${Number(w.fee ?? 0).toFixed(2)})`,
    cashDelta,
    creditsDelta: null,
    xpDelta: null,
    statusLabel: String(w.status),
    adminNote,
    kind: "withdrawal",
  };
}

function mapWalletEvent(e: {
  id: string;
  title: string;
  detail?: string | null;
  cash_delta?: number | string | null;
  credits_delta?: number | string | null;
  xp_delta?: number | string | null;
  admin_note?: string | null;
  created_at: string;
}): WalletActivityItem {
  return {
    key: `we:${e.id}`,
    ts: e.created_at,
    title: e.title,
    subtitle: e.detail ?? undefined,
    cashDelta:
      e.cash_delta != null && e.cash_delta !== ""
        ? Number(e.cash_delta)
        : null,
    creditsDelta:
      e.credits_delta != null && e.credits_delta !== ""
        ? Number(e.credits_delta)
        : null,
    xpDelta:
      e.xp_delta != null && e.xp_delta !== "" ? Number(e.xp_delta) : null,
    adminNote: e.admin_note?.trim() || null,
    kind: "wallet_event",
  };
}

/** 合并 transactions / orders / withdrawals / user_wallet_events，按时间倒序 */
export async function getWalletActivity(): Promise<WalletActivityItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }
  const userId = user.id;

  const [txRes, ordRes, wdRes, evRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("orders")
      .select("id, cash_paid, credits_used, items, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("user_wallet_events")
      .select(
        "id, title, detail, cash_delta, credits_delta, xp_delta, admin_note, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const items: WalletActivityItem[] = [];

  if (!txRes.error && txRes.data) {
    for (const t of txRes.data) {
      items.push(mapTransaction(t as Parameters<typeof mapTransaction>[0]));
    }
  }

  const productIds = new Set<string>();
  if (!ordRes.error && ordRes.data) {
    for (const o of ordRes.data) {
      const arr = (o.items ?? []) as { id?: string }[];
      for (const it of arr) {
        if (it.id) productIds.add(it.id);
      }
    }
  }
  let productTitles = new Map<string, string>();
  if (productIds.size > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, title")
      .in("id", [...productIds]);
    for (const p of prods ?? []) {
      productTitles.set((p as { id: string }).id, (p as { title: string }).title);
    }
  }

  if (!ordRes.error && ordRes.data) {
    for (const o of ordRes.data) {
      items.push(mapOrder(o as Parameters<typeof mapOrder>[0], productTitles));
    }
  }

  if (!wdRes.error && wdRes.data) {
    for (const w of wdRes.data) {
      items.push(mapWithdrawal(w as Record<string, unknown>));
    }
  }

  if (!evRes.error && evRes.data) {
    for (const e of evRes.data) {
      items.push(mapWalletEvent(e as Parameters<typeof mapWalletEvent>[0]));
    }
  }

  const seen = new Set<string>();
  const deduped: WalletActivityItem[] = [];
  for (const it of items) {
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    deduped.push(it);
  }

  deduped.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );

  return deduped.slice(0, 100);
}
