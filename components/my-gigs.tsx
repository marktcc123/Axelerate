"use client";

import React, { useState } from "react";
import {
  Clock,
  CheckCircle2,
  Send,
  DollarSign,
  Camera,
  MapPin,
  ArrowRight,
  Video,
  Zap,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Ticket,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  gigTypeToDisplay,
  getGigBrandName,
} from "@/lib/types";
import type { Gig, UserGig, UserGigStatus } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";
import { EventPassDrawer } from "./drawers/event-pass-drawer";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "approved" | "submitted" | "rejected" | "completed" | "paid";

const statusConfig: Record<
  UserGigStatus,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    icon: Send,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "text-brand-primary",
    bg: "bg-brand-primary/10",
  },
  submitted: {
    label: "Submitted",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  rejected: {
    label: "Rejected",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  paid: {
    label: "Paid",
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
};

interface MyGigsProps {
  onSelectGig: (gig: Gig) => void;
  onOpenUGC?: (userGig: UserGig) => void;
}

export function MyGigs({ onSelectGig, onOpenUGC }: MyGigsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isEventPassOpen, setIsEventPassOpen] = useState(false);
  const [selectedEventPass, setSelectedEventPass] = useState<UserGig | null>(null);

  const { user, profile, userGigs, isLoadingPrivate, refetchPrivate } = useAppDataContext();

  const safeUserGigs = userGigs ?? [];
  const filteredGigs =
    statusFilter === "all"
      ? safeUserGigs
      : safeUserGigs.filter((ug) => ug.status === statusFilter);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/60 ring-2 ring-border dark:bg-white/5 dark:ring-white/10">
          <Clock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mb-1 text-xl font-bold tracking-tight text-foreground">
          Sign in to view your gigs
        </h2>
        <p className="text-sm text-muted-foreground">
          Track applications, approvals, and earnings
        </p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <header className="mb-6 px-1">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          My Gigs
        </h1>
        <p className="text-sm text-muted-foreground">
          Track your active tasks and applications
        </p>
      </header>

      {isLoadingPrivate ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(
              ["all", "pending", "approved", "submitted", "rejected", "completed", "paid"] as StatusFilter[]
            ).map((s) => {
              const count =
                s === "all"
                  ? safeUserGigs.length
                  : safeUserGigs.filter((g) => g.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-bold uppercase leading-none tracking-wider transition-all",
                    statusFilter === s
                      ? "border-2 border-border bg-brand-primary text-primary-foreground shadow-sm"
                      : "border-2 border-border bg-muted/50 text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  )}
                >
                  {s === "all" ? "All" : statusConfig[s as UserGigStatus]?.label ?? s}
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] leading-none",
                      statusFilter === s
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-border/50 text-muted-foreground dark:bg-white/10 dark:text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(!safeUserGigs || safeUserGigs.length === 0) && !isLoadingPrivate ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-bold text-muted-foreground">No gigs yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apply to gigs from the Feed to see them here
                </p>
              </div>
            ) : (
            <>
            {filteredGigs.map((userGig, i) => {
              const gig = userGig.gig;
              if (!gig) return null;
              const config = statusConfig[userGig.status];
              const StatusIcon = config?.icon ?? Clock;
              const displayType = gigTypeToDisplay(gig.type);

              return (
                <div
                  key={userGig.id}
                  className="animate-slide-up group flex h-full min-h-0 w-full flex-col rounded-2xl border-2 border-border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/35 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/80 dark:hover:border-brand-primary/30 dark:hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.15)]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectGig(gig)}
                    className="w-full shrink-0 text-left"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-bold uppercase leading-none tracking-wider [&_svg]:block",
                              displayType === "digital"
                                ? "bg-brand-primary/15 text-brand-primary"
                                : "bg-purple-500/15 text-purple-700 dark:text-purple-400"
                            )}
                          >
                            <span className="inline-flex size-3 shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:max-h-3 [&_svg]:max-w-3">
                              {displayType === "digital" ? (
                                <Camera aria-hidden strokeWidth={2.25} />
                              ) : (
                                <MapPin aria-hidden strokeWidth={2.25} />
                              )}
                            </span>
                            <span className="flex items-center leading-none">{displayType}</span>
                          </span>
                          <span
                            className={cn(
                              "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-bold uppercase leading-none tracking-wider [&_svg]:block",
                              config?.bg ?? "bg-white/10",
                              config?.color ?? "text-muted-foreground"
                            )}
                          >
                            <span className="inline-flex size-3 shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:max-h-3 [&_svg]:max-w-3">
                              <StatusIcon aria-hidden strokeWidth={2.25} />
                            </span>
                            <span className="flex items-center leading-none">
                              {config?.label ?? userGig.status}
                            </span>
                          </span>
                        </div>
                        <span
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)] text-black transition-all group-hover:translate-x-1 group-hover:shadow-[0_0_15px_var(--theme-primary)] [&_svg]:block"
                          aria-hidden
                        >
                          <ArrowRight className="size-4 max-h-4 max-w-4" strokeWidth={2.25} />
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold leading-snug text-foreground dark:text-white">
                          {userGig.gig?.title ?? "—"}
                        </h3>
                        <p className="text-xs leading-snug text-muted-foreground">
                          {userGig.gig ? getGigBrandName(userGig.gig) : "—"}
                        </p>
                      </div>
                      {gig &&
                        (gig.reward_cash > 0 ||
                          gig.reward_credits > 0 ||
                          (gig.xp_reward ?? 0) > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {gig.reward_cash > 0 && (
                              <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-bold text-emerald-400 [&_svg]:block">
                                <span className="inline-flex size-3 shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:max-h-3 [&_svg]:max-w-3">
                                  <DollarSign aria-hidden strokeWidth={2.25} />
                                </span>
                                <span className="flex items-center tabular-nums leading-none">
                                  {gig.reward_cash}
                                </span>
                              </span>
                            )}
                            {gig.reward_credits > 0 && (
                              <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 text-[10px] font-bold text-amber-400 [&_svg]:block">
                                <span className="inline-flex size-3 shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:max-h-3 [&_svg]:max-w-3">
                                  <Zap aria-hidden strokeWidth={2.25} />
                                </span>
                                <span className="flex items-center tabular-nums leading-none">
                                  {gig.reward_credits} pts
                                </span>
                              </span>
                            )}
                            {(gig.xp_reward ?? 0) > 0 && (
                              <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2 text-[10px] font-bold text-brand-primary [&_svg]:block">
                                <span className="inline-flex size-3 shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:max-h-3 [&_svg]:max-w-3">
                                  <Sparkles aria-hidden strokeWidth={2.25} />
                                </span>
                                <span className="flex items-center tabular-nums leading-none">
                                  {gig.xp_reward} XP
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  </button>

                  <div className="mt-auto flex shrink-0 flex-col gap-2.5 pt-3">
                  {/* Status-specific UI */}
                  {userGig.status === "pending" && (
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2.5">
                      <p className="text-xs font-medium leading-snug text-purple-300">
                        Waiting for Brand Approval
                      </p>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex h-4 items-center justify-between gap-2 text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
                          <span className="flex h-full items-center">Progress</span>
                          <span className="flex h-full items-center tabular-nums normal-case tracking-normal">
                            {userGig.progress_percent ?? 0}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60 dark:bg-black/30">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all"
                            style={{ width: `${userGig.progress_percent ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {userGig.status === "approved" && (
                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex h-4 items-center justify-between gap-2 text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
                          <span className="flex h-full items-center">Progress</span>
                          <span className="flex h-full items-center tabular-nums normal-case tracking-normal">
                            {userGig.progress_percent ?? 0}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60 dark:bg-black/30">
                          <div
                            className="h-full rounded-full bg-brand-primary transition-all"
                            style={{ width: `${userGig.progress_percent ?? 0}%` }}
                          />
                        </div>
                      </div>
                      {gig.type === "ugc_post" && onOpenUGC && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUGC(userGig);
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-brand-primary px-3 py-3 text-xs font-bold uppercase leading-none tracking-wider text-primary-foreground shadow-md transition-all hover:bg-brand-primary active:scale-[0.98] dark:shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)] dark:hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.4)] [&_svg]:block"
                        >
                          <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:max-h-4 [&_svg]:max-w-4">
                            <Video aria-hidden strokeWidth={2.25} />
                          </span>
                          <span className="flex items-center leading-none">Submit UGC</span>
                        </button>
                      )}
                      {gig.type === "offline_event" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            refetchPrivate?.();
                            setSelectedEventPass(userGig);
                            setIsEventPassOpen(true);
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-purple-600 px-3 py-3 text-xs font-bold uppercase leading-none tracking-wider text-white shadow-md transition-all hover:bg-purple-500 active:scale-[0.98] dark:shadow-[0_0_20px_rgba(147,51,234,0.3)] dark:hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] [&_svg]:block"
                        >
                          <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:max-h-4 [&_svg]:max-w-4">
                            <Ticket aria-hidden strokeWidth={2.25} />
                          </span>
                          <span className="flex items-center leading-none">View Event Pass</span>
                        </button>
                      )}
                    </div>
                  )}

                  {userGig.status === "submitted" && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <p className="text-xs font-medium text-amber-300">
                        Under Review
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Pending admin review. We&apos;ll notify you once approved.
                      </p>
                    </div>
                  )}

                  {userGig.status === "rejected" && (
                    <div className="space-y-2">
                      {gig.type === "ugc_post" && (
                        <>
                          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2">
                            <p className="text-xs font-medium text-red-300">
                              Submission Rejected
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              Please review the guidelines and submit a new link.
                            </p>
                          </div>
                          {onOpenUGC && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenUGC(userGig);
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500/50 bg-red-500/10 px-3 py-3 text-xs font-bold uppercase leading-none tracking-wider text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all hover:border-red-500/70 hover:bg-red-500/20 hover:text-red-300 hover:shadow-[0_0_16px_rgba(239,68,68,0.25)] active:scale-[0.98] [&_svg]:block"
                            >
                              <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:max-h-4 [&_svg]:max-w-4">
                                <RotateCcw aria-hidden strokeWidth={2.25} />
                              </span>
                              <span className="flex items-center leading-none">Resubmit UGC</span>
                            </button>
                          )}
                        </>
                      )}
                      {gig.type === "offline_event" && (
                        <span className="block text-center text-xs font-medium text-red-400">
                          Application not approved or event full.
                        </span>
                      )}
                    </div>
                  )}

                  {(userGig.status === "completed" || userGig.status === "paid") && (
                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex h-4 items-center justify-between gap-2 text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
                          <span className="flex h-full items-center">Progress</span>
                          <span className="flex h-full items-center tabular-nums normal-case tracking-normal">
                            100%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60 dark:bg-black/30">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>
                      {(userGig.status === "completed" || userGig.status === "paid") && gig.type === "offline_event" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (gig.gallery_url?.trim()) {
                              window.open(gig.gallery_url, "_blank", "noopener,noreferrer");
                            } else {
                              toast.info("📸 Photos are still being processed and uploaded. Please check back later!");
                            }
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 px-3 py-3 text-xs font-bold uppercase leading-none tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/10 [&_svg]:block"
                        >
                          <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:max-h-4 [&_svg]:max-w-4">
                            <ImageIcon aria-hidden strokeWidth={2.25} />
                          </span>
                          <span className="flex items-center leading-none">View Event Photos</span>
                        </button>
                      )}
                      {(userGig.status === "completed" || userGig.status === "paid") && gig.type === "ugc_post" && onOpenUGC && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUGC(userGig);
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-3 text-xs font-bold uppercase leading-none tracking-wider text-brand-primary transition-all hover:bg-brand-primary/20 [&_svg]:block"
                        >
                          <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:max-h-4 [&_svg]:max-w-4">
                            <Video aria-hidden strokeWidth={2.25} />
                          </span>
                          <span className="flex items-center leading-none">View UGC Status</span>
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}

            {filteredGigs.length === 0 && safeUserGigs.length > 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  No gigs with this status
                </p>
              </div>
            )}
            </>
            )}
          </div>

          <EventPassDrawer
            isOpen={isEventPassOpen}
            onClose={() => {
              setIsEventPassOpen(false);
              setSelectedEventPass(null);
            }}
            userGig={selectedEventPass}
            userName={profile?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0]}
          />
        </>
      )}
    </div>
  );
}
