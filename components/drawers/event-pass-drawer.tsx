"use client";

import { QrCode, MapPin, CalendarDays, User } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { X } from "lucide-react";
import type { UserGig } from "@/lib/types";

interface EventPassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userGig: UserGig | null;
  userName?: string | null;
}

export function EventPassDrawer({ isOpen, onClose, userGig, userName }: EventPassDrawerProps) {
  if (!userGig?.gig) return null;

  const gig = userGig.gig;
  const ticketId = userGig.id?.slice(0, 8) ?? "——";

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950">
        <DrawerHeader className="border-b border-border px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Offline Event Pass
            </DrawerTitle>
            <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-foreground shadow-sm dark:border-transparent dark:bg-white/10">
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>
          <h2 className="mt-2 text-lg font-black text-foreground dark:text-white">
            {gig.title ?? "Event"}
          </h2>
        </DrawerHeader>

        <div className="px-4 pb-8 pt-6">
          {/* Ticket Body - Glowing Card */}
          <div
            className="relative overflow-hidden rounded-2xl border-2 border-[var(--theme-primary)]/50 bg-card p-6 shadow-md dark:bg-black/60 dark:shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.25)]"
            style={{
              boxShadow: `0 0 15px rgba(var(--theme-primary-rgb), 0.25), 0 0 30px rgba(var(--theme-primary-rgb), 0.1)`,
            }}
          >
            {/* QR Code Placeholder */}
            <div className="relative mx-auto flex w-[140px] items-center justify-center rounded-xl bg-white/95 p-3">
              <QrCode size={120} className="text-zinc-900" strokeWidth={1.5} />
              {/* Scan line animation */}
              <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-scan bg-[var(--theme-primary)]/60" />
            </div>

            {/* User Identity */}
            <div className="mt-6 flex items-center gap-3 rounded-xl border-2 border-border bg-muted/50 px-4 py-3 dark:border-white/10 dark:bg-black/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)]/20">
                <User className="h-5 w-5 text-[var(--theme-primary)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground dark:text-white">
                  {userName ?? "Guest"}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Ticket ID: {ticketId}
                </p>
              </div>
            </div>

            {/* Event Details */}
            <div className="mt-4 space-y-3">
              {gig.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Location
                    </p>
                    <p className="text-sm text-foreground dark:text-zinc-200">{gig.location}</p>
                  </div>
                </div>
              )}
              {(gig.date || gig.deadline) && (
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Date
                    </p>
                    <p className="text-sm text-foreground dark:text-zinc-200">
                      {gig.date ?? gig.deadline ?? "—"}
                    </p>
                  </div>
                </div>
              )}
              {gig.description && (
                <div className="rounded-lg border-2 border-border bg-muted/40 p-3 dark:border-white/5 dark:bg-black/20">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Event Details
                  </p>
                  <p className="whitespace-pre-wrap text-xs text-foreground/90 dark:text-zinc-300">
                    {gig.description}
                  </p>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                style={{ animationDuration: "1.5s" }}
              />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Ready for check-in. Show this pass to the staff.
              </span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
