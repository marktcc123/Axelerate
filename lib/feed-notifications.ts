import type { Order, Profile, UserGig, UserTier, Event } from "@/lib/types";
import {
  TIER_CONFIG,
  TIER_ORDER,
  resolveTierKey,
} from "@/lib/types";
import type { WalletActivityItem } from "@/app/actions/wallet-activity";
import type { EventApplication } from "@/lib/hooks/useAppData";

export type FeedNotificationNavAction =
  | { kind: "drawer"; key: "wallet" | "orders" | "events" | "ugc" }
  | { kind: "tab"; tab: "feed" | "gigs" | "shop" | "profile" }
  | { kind: "scroll"; id: string };

export interface FeedNotificationItem {
  id: string;
  title: string;
  body: string;
  at: string;
  nav?: FeedNotificationNavAction;
}

export interface FeedNotifState {
  seenIds: Set<string>;
  /** Highest tier the user has dismissed tier alerts through (not including higher tiers). */
  tierFloor: UserTier;
}

const STORAGE_KEY = (userId: string) => `axelerate_feed_notif_state_v1:${userId}`;

const MS_14D = 14 * 24 * 60 * 60 * 1000;
const MS_10D = 10 * 24 * 60 * 60 * 1000;

export function loadFeedNotifState(userId: string): FeedNotifState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return { seenIds: new Set(), tierFloor: "guest" };
    const j = JSON.parse(raw) as { seenIds?: string[]; tierFloor?: string };
    return {
      seenIds: new Set(Array.isArray(j.seenIds) ? j.seenIds : []),
      tierFloor: resolveTierKey((j.tierFloor as UserTier) ?? "guest"),
    };
  } catch {
    return { seenIds: new Set(), tierFloor: "guest" };
  }
}

export function saveFeedNotifState(userId: string, state: FeedNotifState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY(userId),
      JSON.stringify({
        seenIds: [...state.seenIds],
        tierFloor: state.tierFloor,
      }),
    );
  } catch {
    /* ignore */
  }
}

function tierIndex(t: UserTier): number {
  const i = TIER_ORDER.indexOf(t);
  return i < 0 ? 0 : i;
}

function within(ms: number, iso: string | undefined | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ms;
}

function gigTitle(ug: UserGig): string {
  return ug.gig?.title?.trim() || "Your gig";
}

const ORDER_STATUS_COPY: Record<string, string> = {
  processing: "is being processed",
  shipped: "has shipped",
  completed: "is complete",
  cancelled: "was cancelled",
  canceled: "was cancelled",
};

function orderBody(status: string): string {
  const s = status.toLowerCase().trim();
  return `Order ${ORDER_STATUS_COPY[s] ?? `updated (${status})`}.`;
}

const GIG_STATUS_TITLE: Partial<Record<UserGig["status"], string>> = {
  approved: "Gig approved",
  submitted: "Submission received",
  rejected: "Gig not approved",
  completed: "Gig completed",
  paid: "Payout sent",
};

export function buildFeedNotifications(input: {
  userId: string | null;
  profile: Profile | null;
  userTier: UserTier;
  userGigs: UserGig[];
  eventApplications: EventApplication[];
  orders: Order[];
  walletActivity: WalletActivityItem[];
  events: Event[];
  state: FeedNotifState;
}): FeedNotificationItem[] {
  const { userId, profile, userTier, state } = input;

  if (!userId) {
    return [];
  }

  const items: FeedNotificationItem[] = [];
  const { seenIds, tierFloor } = state;

  if (profile?.tier) {
    const current = resolveTierKey(profile.tier);
    if (tierIndex(current) > tierIndex(tierFloor)) {
      const id = `tier:${current}`;
      if (!seenIds.has(id)) {
        items.push({
          id,
          title: "Rank up",
          body: `You're now ${TIER_CONFIG[current].label}. New perks and drops may be unlocked.`,
          at: profile.updated_at ?? new Date().toISOString(),
          nav: { kind: "tab", tab: "feed" },
        });
      }
    }
  }

  const gigStatuses: UserGig["status"][] = [
    "approved",
    "submitted",
    "rejected",
    "completed",
    "paid",
  ];
  for (const ug of input.userGigs) {
    if (!gigStatuses.includes(ug.status)) continue;
    const id = `ug:${ug.id}:${ug.status}`;
    if (seenIds.has(id)) continue;
    const title = GIG_STATUS_TITLE[ug.status] ?? "Gig update";
    const extra =
      ug.status === "paid"
        ? `${gigTitle(ug)} — check your wallet.`
        : `${gigTitle(ug)}.`;
    items.push({
      id,
      title,
      body: extra,
      at: ug.updated_at ?? ug.applied_at,
      nav: { kind: "tab", tab: "gigs" },
    });
  }

  for (const app of input.eventApplications) {
    const st = String(app.status ?? "").toLowerCase();
    if (!["approved", "attended", "rejected"].includes(st)) continue;
    const id = `ea:${app.id}:${st}`;
    if (seenIds.has(id)) continue;
    const eventTitle = app.event?.title?.trim() || "Event";
    let title = "Event update";
    let body = `${eventTitle}.`;
    if (st === "approved") {
      title = "Event spot confirmed";
      body = `You're in for ${eventTitle}.`;
    } else if (st === "attended") {
      title = "Event check-in";
      body = `Thanks for joining ${eventTitle}.`;
    } else if (st === "rejected") {
      title = "Event application";
      body = `Update on ${eventTitle}.`;
    }
    items.push({
      id,
      title,
      body,
      at: app.created_at,
      nav: { kind: "scroll", id: "events-section" },
    });
  }

  const recentOrders = [...input.orders]
    .filter((o) => within(MS_14D, o.updated_at ?? o.created_at))
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime(),
    )
    .slice(0, 12);

  for (const order of recentOrders) {
    const st = String(order.status ?? "processing").toLowerCase().trim();
    const id = `ord:${order.id}:${st}`;
    if (seenIds.has(id)) continue;
    items.push({
      id,
      title: "Order update",
      body: orderBody(st),
      at: order.updated_at ?? order.created_at,
      nav: { kind: "drawer", key: "orders" },
    });
  }

  const walletSorted = [...input.walletActivity].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
  let walletCount = 0;
  for (const row of walletSorted) {
    if (walletCount >= 10) break;
    const id = `wa:${row.key}`;
    if (seenIds.has(id)) continue;
    if (!within(MS_14D, row.ts)) continue;
    walletCount++;
    const parts: string[] = [];
    if (row.cashDelta != null && row.cashDelta !== 0) {
      parts.push(`Cash ${row.cashDelta > 0 ? "+" : ""}$${Math.abs(row.cashDelta).toFixed(2)}`);
    }
    if (row.creditsDelta != null && row.creditsDelta !== 0) {
      parts.push(`Credits ${row.creditsDelta > 0 ? "+" : ""}${row.creditsDelta}`);
    }
    if (row.xpDelta != null && row.xpDelta !== 0) {
      parts.push(`XP ${row.xpDelta > 0 ? "+" : ""}${row.xpDelta}`);
    }
    items.push({
      id,
      title: row.title,
      body: (row.subtitle ?? parts.join(" · ")) || "Wallet activity",
      at: row.ts,
      nav: { kind: "drawer", key: "wallet" },
    });
  }

  const accessibleEvents = input.events.filter((ev) => {
    const min = resolveTierKey(
      (ev.min_tier_required ?? ev.min_tier ?? "guest") as UserTier,
    );
    return tierIndex(userTier) >= tierIndex(min);
  });
  const freshEvents = [...accessibleEvents]
    .filter((e) => within(MS_10D, e.created_at))
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    )
    .slice(0, 4);

  for (const ev of freshEvents) {
    const id = `evnew:${ev.id}`;
    if (seenIds.has(id)) continue;
    items.push({
      id,
      title: "New campus event",
      body: ev.title,
      at: ev.created_at ?? new Date().toISOString(),
      nav: { kind: "scroll", id: "events-section" },
    });
  }

  items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return items;
}

export function formatFeedNotifTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 45) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
