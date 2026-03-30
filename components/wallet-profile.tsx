"use client";

import React from "react"

import { useState } from "react";
import {
  DollarSign,
  ArrowUpRight,
  Clock,
  Star,
  Shield,
  Flame,
  Heart,
  Award,
  TrendingUp,
  ChevronRight,
  FileText,
  ExternalLink,
  Linkedin,
  Download,
  Trophy,
  CheckCircle2,
  Sparkles,
  Coins,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mockUser,
  mockTransactions,
  TIER_CONFIG,
  BADGES,
  VERIFICATION_LEVELS,
} from "@/lib/data";
import type { Certificate } from "@/lib/data";
import { TierBadge } from "./tier-badge";

const badgeIcons: Record<string, React.ElementType> = {
  star: Star,
  trophy: Trophy,
  shield: Shield,
  clock: Clock,
  heart: Heart,
  flame: Flame,
};

function CertificateCard({
  cert,
  index,
}: {
  cert: Certificate;
  index: number;
}) {
  const [showLinkedIn, setShowLinkedIn] = useState(false);

  return (
    <div
      className="animate-slide-up rounded-2xl border border-border bg-card p-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
            <FileText className="h-5 w-5 text-brand-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">{cert.title}</h4>
            <p className="text-[10px] text-muted-foreground">{cert.brand}</p>
          </div>
        </div>
        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-primary">
          Verified
        </span>
      </div>

      <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {cert.issuedDate}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {cert.gigsCompleted} gigs
        </span>
      </div>

      <div className="mb-3 rounded-xl bg-secondary/50 p-3">
        <p className="text-[11px] text-muted-foreground">Campaign</p>
        <p className="text-xs font-bold text-foreground">
          {cert.campaignName}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowLinkedIn(!showLinkedIn)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#f5f5f5] transition-all active:scale-[0.97]"
        >
          <Linkedin className="h-3.5 w-3.5" />
          Add to LinkedIn
        </button>
        <button className="flex items-center justify-center rounded-xl border border-border bg-transparent px-3 py-2.5 text-foreground transition-all hover:border-brand-primary/30">
          <Share2 className="h-4 w-4" />
        </button>
        <button className="flex items-center justify-center rounded-xl border border-border bg-transparent px-3 py-2.5 text-foreground transition-all hover:border-brand-primary/30">
          <Download className="h-4 w-4" />
        </button>
      </div>

      {showLinkedIn && (
        <div className="mt-3 animate-slide-up rounded-xl border border-[#0A66C2]/20 bg-[#0A66C2]/5 p-3">
          <p className="mb-2 text-[11px] font-bold text-foreground">
            LinkedIn Certification Details:
          </p>
          <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <p>
              <span className="font-bold text-foreground">Name:</span>{" "}
              {cert.title}
            </p>
            <p>
              <span className="font-bold text-foreground">
                Issuing Organization:
              </span>{" "}
              Axelerate x {cert.brand}
            </p>
            <p>
              <span className="font-bold text-foreground">Issue Date:</span>{" "}
              {cert.issuedDate}
            </p>
            <p>
              <span className="font-bold text-foreground">Credential ID:</span>{" "}
              AXL-{cert.id.toUpperCase()}
            </p>
          </div>
          <a
            href="#"
            className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#0A66C2]"
          >
            Open LinkedIn
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

export function WalletProfile() {
  const [activeSection, setActiveSection] = useState<
    "wallet" | "resume" | "badges"
  >("wallet");

  const isCashWallet = mockUser.walletType === "cash";

  return (
    <div className="pb-4">
      {/* Profile Header */}
      <header className="mb-6 px-1">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary text-2xl font-black text-white">
            {mockUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
              {mockUser.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mockUser.username} &middot; {mockUser.university}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <TierBadge tier={mockUser.tier} size="sm" />
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Level {mockUser.verificationLevel} -{" "}
                {VERIFICATION_LEVELS[mockUser.verificationLevel].label}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Section Toggle */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-border bg-card p-1">
        {(["wallet", "resume", "badges"] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
              activeSection === section
                ? "bg-brand-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {section === "wallet"
              ? "Wallet"
              : section === "resume"
                ? "Resume"
                : "Badges"}
          </button>
        ))}
      </div>

      {/* === WALLET SECTION === */}
      {activeSection === "wallet" && (
        <div>
          {/* XP Progress */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Level Progress
              </span>
              <span className="font-mono text-xs font-bold text-brand-primary">
                {mockUser.xp} / {mockUser.nextTierXp} XP
              </span>
            </div>
            <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{
                  width: `${(mockUser.xp / mockUser.nextTierXp) * 100}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {mockUser.nextTierXp - mockUser.xp} XP until{" "}
              {TIER_CONFIG["city-manager"].label}
            </p>
          </div>

          {/* Balance Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            {isCashWallet ? (
              <>
                <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5 text-brand-primary" />
                    Cash Available
                  </div>
                  <p className="text-3xl font-black tracking-tight text-brand-primary">
                    ${mockUser.availableBalance}
                  </p>
                  <button className="mt-3 flex items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Withdraw
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Pending
                  </div>
                  <p className="text-3xl font-black tracking-tight text-foreground">
                    ${mockUser.pendingBalance}
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Clears in 3-5 days
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="h-3.5 w-3.5 text-brand-primary" />
                    Points Balance
                  </div>
                  <p className="text-3xl font-black tracking-tight text-brand-primary">
                    {mockUser.pointsBalance}
                  </p>
                  <button className="mt-3 flex items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110">
                    <Sparkles className="h-3.5 w-3.5" />
                    Redeem
                  </button>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Earned Total
                  </div>
                  <p className="text-3xl font-black tracking-tight text-foreground">
                    {(mockUser.pointsBalance + 2200).toLocaleString()}
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    Lifetime points
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Total Stats */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {isCashWallet ? "Total Earned" : "Total Value Earned"}
                </p>
                <p className="text-2xl font-black text-foreground">
                  {isCashWallet
                    ? `$${mockUser.totalEarned.toLocaleString()}`
                    : `${(mockUser.pointsBalance + 2200).toLocaleString()} pts`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Gigs Done</p>
                <p className="text-2xl font-black text-foreground">
                  {mockUser.gigsCompleted}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mb-6">
            <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </h2>
            <div className="flex flex-col gap-1">
              {mockTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        tx.status === "paid"
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-purple-500/10 text-purple-400"
                      )}
                    >
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {tx.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {tx.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground">
                      {isCashWallet ? `+$${tx.amount}` : `+${tx.amount * 10} pts`}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase",
                        tx.status === "paid"
                          ? "text-emerald-400"
                          : "text-purple-400"
                      )}
                    >
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brands Portfolio */}
          <div>
            <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Brands Portfolio
            </h2>
            <div className="flex flex-wrap gap-2">
              {mockUser.brandsWorkedWith.map((brand) => (
                <span
                  key={brand}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === RESUME SECTION === */}
      {activeSection === "resume" && (
        <div>
          {/* Resume Header */}
          <div className="mb-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-primary" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                Axelerate Resume
              </h2>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Auto-generated marketing certificates from your completed
              campaigns. Share with employers or add directly to LinkedIn.
            </p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-brand-primary" />
                {mockUser.certificates.length} Certificates
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-brand-primary" />
                {mockUser.gigsCompleted} Gigs Completed
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-brand-primary" />
                {mockUser.brandsWorkedWith.length} Brands
              </span>
            </div>
          </div>

          {/* Certificates */}
          <h3 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Certificates
          </h3>
          <div className="flex flex-col gap-3">
            {mockUser.certificates.map((cert, i) => (
              <CertificateCard key={cert.id} cert={cert} index={i} />
            ))}
          </div>

          {/* Influence Score */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10">
                  <TrendingUp className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Influence Score
                  </p>
                  <p className="text-2xl font-black text-foreground">
                    {mockUser.influenceScore}
                    <span className="text-sm text-muted-foreground">/100</span>
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              This score is visible to Brand Managers when selecting staff for
              events and campaigns.
            </p>
          </div>
        </div>
      )}

      {/* === BADGES SECTION === */}
      {activeSection === "badges" && (
        <div>
          <div className="mb-6 rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-brand-primary" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                Your Badges
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Earned badges are visible to Brand Managers and appear on your
              public profile when they select staff.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {BADGES.map((badge, i) => {
              const earned = mockUser.badges.includes(badge.id);
              const Icon = badgeIcons[badge.icon] || Award;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "animate-slide-up flex items-center gap-4 rounded-2xl border p-4 transition-all",
                    earned
                      ? "border-brand-primary/30 bg-brand-primary/5"
                      : "border-border bg-card opacity-50"
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      earned ? "bg-brand-primary/10" : "bg-secondary"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        earned ? "text-brand-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          "text-sm font-bold",
                          earned ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {badge.label}
                      </h4>
                      {earned && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand-primary" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {earned
                        ? "Visible to Brand Managers"
                        : "Complete more gigs to earn this badge"}
                    </p>
                  </div>
                  {earned && (
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-primary">
                      Earned
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
