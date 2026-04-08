"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Users,
  ChevronRight,
  Lock,
  Crown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { TIER_CONFIG, resolveTierKey } from "@/lib/types";

const MOCK_SHIFTS = [
  { id: "s1", title: "Jewelry Pop-Up Staff", brand: "Mejuri", location: "The Grove, LA", date: "Sat, Feb 22", startTime: "2:00 PM", endTime: "6:00 PM", hourlyRate: 35, spotsLeft: 2, totalSpots: 4, status: "open" as const },
  { id: "s2", title: "Art Gallery Host", brand: "Hennessy", location: "DTLA Arts District", date: "Sat, Mar 8", startTime: "7:00 PM", endTime: "11:00 PM", hourlyRate: 50, spotsLeft: 1, totalSpots: 3, status: "open" as const },
  { id: "s3", title: "Beauty Counter Staff", brand: "Rare Beauty", location: "Santa Monica Place", date: "Sun, Mar 15", startTime: "11:00 AM", endTime: "5:00 PM", hourlyRate: 30, spotsLeft: 3, totalSpots: 6, status: "open" as const },
];

export function EliteTracksDrawer() {
  const { user, profile } = useAppDataContext();
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  const tierKey = resolveTierKey(profile?.tier ?? "guest");
  const isUnlocked = ["staff", "city_manager", "partner"].includes(tierKey);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view Elite Tracks</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-brand-primary/30 bg-brand-primary/10">
          <Lock className="h-10 w-10 text-brand-primary" />
        </div>
        <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-foreground">
          Elite Tracks Locked
        </h3>
        <p className="mb-6 max-w-xs text-sm text-muted-foreground">
          Reach{" "}
          <span className="font-bold text-brand-primary">{TIER_CONFIG.staff.label}</span>
          {", "}
          <span className="font-bold text-brand-primary">{TIER_CONFIG.city_manager.label}</span>
          {", or "}
          <span className="font-bold text-brand-primary">{TIER_CONFIG.partner.label}</span>{" "}
          to unlock high-paying event shifts ($30+/hr).
        </p>
        <div className="w-full max-w-xs rounded-xl border border-border bg-card px-4 py-3 text-center">
          <p className="text-xs font-bold text-muted-foreground">Your current tier</p>
          <p className="text-sm font-black text-foreground">{TIER_CONFIG[tierKey].label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-4">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
            Elite Access
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
          Elite Tracks
        </h1>
        <p className="text-sm text-muted-foreground">
          High-paying event shifts for {TIER_CONFIG.staff.label} tier and above
        </p>
      </header>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
        <Crown className="h-5 w-5 text-brand-primary" />
        <div>
          <p className="text-xs font-bold text-foreground">Shift Board</p>
          <p className="text-[10px] text-muted-foreground">$30+/hr premium gigs</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_SHIFTS.map((shift) => {
          const claimed = claimedIds.has(shift.id);
          const isFull = shift.spotsLeft === 0;
          const estTotal = shift.hourlyRate * 4;

          return (
            <div
              key={shift.id}
              className={cn(
                "overflow-hidden rounded-2xl border transition-all",
                claimed ? "border-brand-primary/30 bg-brand-primary/5" :
                isFull ? "border-border/50 bg-card/50 opacity-60" :
                "border-border bg-card"
              )}
            >
              <div className="flex w-full items-start gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-primary/10">
                  <span className="text-[10px] font-bold text-brand-primary">$</span>
                  <span className="text-sm font-black leading-none text-brand-primary">{shift.hourlyRate}</span>
                  <span className="text-[8px] font-bold text-brand-primary/60">/hr</span>
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{shift.title}</h4>
                    {claimed && (
                      <span className="rounded-md bg-brand-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-primary">
                        Claimed
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">{shift.brand}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {shift.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {shift.date}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-secondary/50 p-2.5">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Time</p>
                    <p className="text-xs font-bold text-foreground">{shift.startTime} - {shift.endTime}</p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-2.5">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Est. Total</p>
                    <p className="text-xs font-bold text-emerald-400">${estTotal}</p>
                  </div>
                </div>
                <div className="mb-3 flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Spots</span>
                  </div>
                  <span className="text-xs font-black text-foreground">
                    {shift.spotsLeft}/{shift.totalSpots}
                  </span>
                </div>
                <button
                  onClick={() => !claimed && !isFull && setClaimedIds((p) => new Set([...p, shift.id]))}
                  disabled={claimed || isFull}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all",
                    claimed || isFull || "bg-brand-primary text-white active:scale-[0.98]"
                  )}
                >
                  {claimed ? "Claimed" : isFull ? "Fully Booked" : "Claim Shift"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
