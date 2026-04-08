"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { useFeedNotifications } from "@/hooks/useFeedNotifications";
import {
  formatFeedNotifTime,
  type FeedNotificationNavAction,
} from "@/lib/feed-notifications";

interface FeedNotificationsBellProps {
  onNavigate?: (action: FeedNotificationNavAction) => void;
  /** When logged out, open login / profile tab */
  onRequestLogin?: () => void;
}

export function FeedNotificationsBell({
  onNavigate,
  onRequestLogin,
}: FeedNotificationsBellProps) {
  const {
    user,
    profile,
    userGigs,
    eventApplications,
    orders,
    walletActivity,
    events,
    isLoadingPrivate,
  } = useAppDataContext();

  const isReady = !user?.id || !isLoadingPrivate;

  const { items, unreadCount, markRead, markAllRead } = useFeedNotifications({
    userId: user?.id ?? null,
    profile,
    userGigs,
    eventApplications,
    orders,
    walletActivity,
    events,
    isReady,
  });

  const [open, setOpen] = useState(false);

  const handleItemClick = (id: string, nav?: FeedNotificationNavAction) => {
    setOpen(false);
    markRead(id);
    if (nav && onNavigate) onNavigate(nav);
  };

  const guestCopy = !user?.id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/50 backdrop-blur-sm transition-colors hover:bg-muted",
            "data-[state=open]:ring-2 data-[state=open]:ring-brand-primary/40",
          )}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-foreground" strokeWidth={2.25} />
          {!guestCopy && unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[120] w-[min(calc(100vw-2rem),22rem)] max-h-[min(70vh,24rem)] overflow-hidden border-2 border-border bg-card p-0 shadow-xl dark:border-white/10"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5 dark:border-white/10">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Activity
          </p>
          {!guestCopy && items.length > 0 && (
            <button
              type="button"
              onClick={() => markAllRead(items)}
              className="text-[11px] font-semibold text-brand-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain">
          {guestCopy ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-bold text-foreground">
                Stay in the loop
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Log in to see gig updates, orders, wallet activity, and campus
                events in one place.
              </p>
              {onRequestLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRequestLogin();
                  }}
                  className="mt-4 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"
                >
                  Go to profile
                </button>
              )}
            </div>
          ) : !isReady ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. New gig, order, and wallet updates will
              show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border dark:divide-white/10">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(it.id, it.nav)}
                    className="flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 dark:hover:bg-white/5"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.6)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground">
                        {it.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {it.body}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                        {formatFeedNotifTime(it.at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
