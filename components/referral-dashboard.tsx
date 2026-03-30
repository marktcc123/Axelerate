"use client";

import { useState } from "react";
import {
  Users,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  DollarSign,
  Share2,
  Link2,
  QrCode,
  TrendingUp,
  ShieldAlert,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockUser, mockReferrals } from "@/lib/data";
import type { Referral } from "@/lib/data";

const blockReasonLabels: Record<string, string> = {
  "address-match": "Address matches ambassador",
  "not-new-user": "Buyer is not a new user",
  "inventory-cap": "Monthly purchase limit exceeded",
};

export function ReferralDashboard() {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [filter, setFilter] = useState<"all" | "approved" | "blocked">("all");

  const referrals = mockReferrals;
  const approvedRefs = referrals.filter((r) => r.status === "approved");
  const blockedRefs = referrals.filter((r) => r.status === "blocked");
  const totalEarned = approvedRefs.reduce((s, r) => s + r.commissionAmount, 0);
  const totalBlocked = blockedRefs.reduce((s, r) => s + (r.orderAmount * r.commissionRate), 0);

  const filteredRefs = filter === "all"
    ? referrals
    : referrals.filter((r) => r.status === filter);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-4">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Ambassador Program
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
          Referrals
        </h1>
        <p className="text-sm text-muted-foreground">
          Earn 1000 credits + 100 xp for every new user you refer!
        </p>
      </header>

      {/* Referral Code Card */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Your Referral Code
        </p>
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-2xl font-black tracking-widest text-primary">
            {mockUser.referralCode}
          </span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all active:scale-[0.95]",
              copied
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-card/50 p-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs font-mono text-foreground">
            axelerate.app/r/{mockUser.referralCode}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all active:scale-[0.98]">
            <Share2 className="h-3.5 w-3.5" />
            Share Link
          </button>
          <button
            onClick={() => setShowQr(!showQr)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/30"
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
        </div>

        {showQr && (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 animate-slide-up">
            <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-foreground">
              <QrCode className="h-16 w-16 text-background" />
            </div>
            <p className="text-[10px] text-muted-foreground">Scan to refer a friend</p>
          </div>
        )}
      </div>

      {/* Earnings & Fraud Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Earned</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">${totalEarned.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{approvedRefs.length} approved referrals</p>
        </div>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Blocked</span>
          </div>
          <p className="text-2xl font-black text-destructive">${totalBlocked.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{blockedRefs.length} flagged referrals</p>
        </div>
      </div>

      {/* Anti-Fraud Rules */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Anti-Fraud Rules
          </h3>
        </div>
        <div className="flex flex-col gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Commission triggers only on <span className="font-bold text-foreground">first orders from new users</span></span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Buyer address matching your address = <span className="font-bold text-destructive">$0 commission</span></span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Max <span className="font-bold text-foreground">3 units per SKU/month</span> for ambassadors</span>
          </div>
        </div>
      </div>

      {/* Inventory Cap Tracker */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Monthly Purchase Limit
            </h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            Max 3 per SKU
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Glow Starter Kit</span>
              <span className="font-bold text-foreground">
                {mockUser.monthlyPurchases["sk-1"] || 0}/3
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((mockUser.monthlyPurchases["sk-1"] || 0) / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(["all", "approved", "blocked"] as const).map((f) => {
          const count = f === "all" ? referrals.length : f === "approved" ? approvedRefs.length : blockedRefs.length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-secondary-foreground"
              )}
            >
              {f === "all" ? "All" : f === "approved" ? "Earned" : "Blocked"}
              <span className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                filter === f
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Referral List */}
      <div className="flex flex-col gap-2">
        {filteredRefs.map((ref, i) => (
          <ReferralRow key={ref.id} referral={ref} index={i} />
        ))}

        {filteredRefs.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm font-bold text-foreground">No referrals found</p>
            <p className="text-xs text-muted-foreground">Share your code to start earning!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralRow({ referral, index }: { referral: Referral; index: number }) {
  const isBlocked = referral.status === "blocked";
  const isApproved = referral.status === "approved";

  return (
    <div
      className={cn(
        "animate-slide-up rounded-xl border p-3 transition-all",
        isBlocked ? "border-destructive/20 bg-destructive/5" : "border-border bg-card"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black",
            isApproved ? "bg-emerald-400/10 text-emerald-400" :
            isBlocked ? "bg-destructive/10 text-destructive" :
            "bg-secondary text-muted-foreground"
          )}>
            {isApproved ? <CheckCircle2 className="h-4 w-4" /> :
             isBlocked ? <XCircle className="h-4 w-4" /> :
             <Clock className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground">{referral.buyerName}</p>
              {isBlocked && (
                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
                  Blocked
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Order ${referral.orderAmount} -- {referral.createdAt}
            </p>
            {isBlocked && referral.blockReason && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {blockReasonLabels[referral.blockReason]}
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className={cn(
            "text-sm font-black",
            isApproved ? "text-emerald-400" : isBlocked ? "text-destructive line-through" : "text-foreground"
          )}>
            {isBlocked ? "$0.00" : `+$${referral.commissionAmount.toFixed(2)}`}
          </p>
          <p className="text-[9px] text-muted-foreground">{(referral.commissionRate * 100).toFixed(0)}% rate</p>
        </div>
      </div>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
