"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildFeedNotifications,
  loadFeedNotifState,
  saveFeedNotifState,
  type FeedNotificationItem,
  type FeedNotifState,
} from "@/lib/feed-notifications";
import type { Profile, Order, UserGig, Event } from "@/lib/types";
import { resolveTierKey } from "@/lib/types";
import type { WalletActivityItem } from "@/app/actions/wallet-activity";
import type { EventApplication } from "@/lib/hooks/useAppData";

export function useFeedNotifications(params: {
  userId: string | null;
  profile: Profile | null;
  userGigs: UserGig[];
  eventApplications: EventApplication[];
  orders: Order[];
  walletActivity: WalletActivityItem[];
  events: Event[];
  isReady: boolean;
}) {
  const [state, setState] = useState<FeedNotifState>(() => ({
    seenIds: new Set(),
    tierFloor: "guest",
  }));

  useEffect(() => {
    if (!params.userId) {
      setState({ seenIds: new Set(), tierFloor: "guest" });
      return;
    }
    setState(loadFeedNotifState(params.userId));
  }, [params.userId]);

  const userTier = resolveTierKey(params.profile?.tier ?? "guest");

  const items = useMemo(() => {
    if (!params.isReady || !params.userId) return [];
    return buildFeedNotifications({
      userId: params.userId,
      profile: params.profile,
      userTier,
      userGigs: params.userGigs,
      eventApplications: params.eventApplications,
      orders: params.orders,
      walletActivity: params.walletActivity,
      events: params.events,
      state,
    });
  }, [
    params.isReady,
    params.userId,
    params.profile,
    userTier,
    params.userGigs,
    params.eventApplications,
    params.orders,
    params.walletActivity,
    params.events,
    state,
  ]);

  const unreadCount = items.length;

  const markRead = useCallback(
    (id: string) => {
      if (!params.userId) return;
      setState((prev) => {
        const nextSeen = new Set(prev.seenIds);
        nextSeen.add(id);
        let tierFloor = prev.tierFloor;
        if (id.startsWith("tier:") && params.profile?.tier) {
          tierFloor = resolveTierKey(params.profile.tier);
        }
        const next: FeedNotifState = { seenIds: nextSeen, tierFloor };
        saveFeedNotifState(params.userId!, next);
        return next;
      });
    },
    [params.userId, params.profile?.tier],
  );

  const markAllRead = useCallback(
    (currentItems: FeedNotificationItem[]) => {
      if (!params.userId) return;
      setState((prev) => {
        const nextSeen = new Set(prev.seenIds);
        for (const it of currentItems) nextSeen.add(it.id);
        const next: FeedNotifState = {
          seenIds: nextSeen,
          tierFloor: resolveTierKey(params.profile?.tier ?? "guest"),
        };
        saveFeedNotifState(params.userId!, next);
        return next;
      });
    },
    [params.userId, params.profile?.tier],
  );

  return { items, unreadCount, markRead, markAllRead };
}
