"use client";

import { useEffect } from "react";
import { Ticket, ChevronRight, RefreshCw } from "lucide-react";
import { useAppDataContext } from "@/lib/context/app-data-context";
import type { Event } from "@/lib/types";
import { getTierLabel } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EventTicket } from "@/components/profile/event-ticket";

interface EventApplicationWithEvent {
  id: string;
  event_id: string;
  status: string; // 'pending' | 'approved' | 'attended' | 'rejected'
  created_at: string;
  event?: Event | null; // singular form only
}

function EmptyEvents({ onExploreEvents }: { onExploreEvents: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
        <Ticket className="h-12 w-12 text-gray-500" strokeWidth={1.5} />
      </div>
      <h3 className="mb-2 text-lg font-black uppercase tracking-tight text-white">
        Your social calendar is looking empty
      </h3>
      <p className="mb-6 max-w-[260px] text-sm text-gray-400">
        Dive into the hype.
      </p>
      <button
        onClick={onExploreEvents}
        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--theme-primary)] bg-[var(--theme-primary)]/20 px-6 py-3 text-sm font-bold text-[var(--theme-primary)] shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)] transition-all hover:bg-[var(--theme-primary)]/30 hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.4)]"
      >
        Discover Events
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MyEventsDrawer({
  onExploreEvents,
}: {
  onExploreEvents?: () => void;
}) {
  const {
    user,
    profile,
    themeSchool,
    eventApplications,
    events,
    isLoadingPrivate,
    refetchPrivate,
  } = useAppDataContext();

  // 打开 My Events 时强制重新拉取，击穿缓存（silent 避免骨架屏闪烁）
  useEffect(() => {
    if (user?.id) refetchPrivate({ silent: true });
  }, [user?.id, refetchPrivate]);

  const applicationsWithEvents: EventApplicationWithEvent[] = eventApplications
    .map((app: any) => {
      const eventDetail = app.event;
      const resolvedEvent =
        (Array.isArray(eventDetail) ? eventDetail[0] : eventDetail) ??
        events.find((e) => e.id === app.event_id) ??
        null;
      return { ...app, event: resolvedEvent };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const userTierLabel = profile?.tier
    ? getTierLabel(profile.tier).toUpperCase()
    : "GUEST";

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to view your event applications
        </p>
      </div>
    );
  }

  if (isLoadingPrivate) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (applicationsWithEvents.length === 0) {
    return <EmptyEvents onExploreEvents={onExploreEvents ?? (() => {})} />;
  }

  const handleRefresh = () => refetchPrivate({ silent: false });

  return (
    <div className="flex min-w-0 w-full min-h-[200px] flex-1 flex-col gap-4 overflow-y-auto pb-8 text-white">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {applicationsWithEvents.length} application
          {applicationsWithEvents.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoadingPrivate}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label="Refresh event applications"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoadingPrivate ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="flex w-full min-h-[200px] flex-1 flex-col gap-4">
        {applicationsWithEvents.map((application, index) => (
          <EventTicket
            key={application.id || `app-${application.event_id}-${index}`}
            application={application}
            userTier={userTierLabel}
            eventsFallback={events}
            themePrimaryColor={themeSchool?.primary_color}
          />
        ))}
      </div>
    </div>
  );
}
