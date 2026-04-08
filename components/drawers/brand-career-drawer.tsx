"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Lock,
  Loader2,
  Sparkles,
  TrendingUp,
  Download,
  Clock,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { createClient } from "@/lib/supabase/client";
import {
  brandCertRewardKey,
  brandReferralRewardKey,
  CAREER_BRAND_THRESHOLD,
  CAREER_GENERAL_THRESHOLD,
  careerRewardNeedsCertificatePdf,
  computeCareerStats,
  generalCertRewardKey,
} from "@/lib/career-rewards";
import {
  requestCareerReward,
  getCareerCertificateDownloadUrl,
} from "@/app/actions/career-rewards";

type RowLite = {
  id: string;
  reward_key: string;
  status: string;
  certificate_pdf_path: string | null;
};

type Phase = "locked" | "eligible" | "pending" | "fulfilled";

function neoCardClass(opts: { active: boolean; fulfilled: boolean; pending: boolean }) {
  const { active, fulfilled, pending } = opts;
  return cn(
    "relative overflow-hidden rounded-2xl border-2 p-4 transition-all",
    fulfilled
      ? "border-emerald-500/60 bg-emerald-500/5 shadow-[3px_3px_0_0_rgba(16,185,129,0.35)] dark:border-emerald-400/50"
      : pending
        ? "border-amber-500/50 bg-amber-500/5 shadow-[3px_3px_0_0_rgba(245,158,11,0.25)]"
        : active
          ? "border-brand-primary bg-brand-primary/5 shadow-[4px_4px_0_0_rgba(var(--theme-primary-rgb),0.45)] dark:shadow-[4px_4px_0_0_rgba(167,139,250,0.35)]"
          : "border-border bg-muted/30 opacity-80 grayscale dark:border-white/15 dark:bg-white/[0.04]",
  );
}

function phaseFor(row: RowLite | undefined, eligible: boolean): Phase {
  if (!eligible) return "locked";
  if (!row) return "eligible";
  if (row.status === "pending") return "pending";
  if (row.status === "approved") return "fulfilled";
  return "eligible";
}

function normalizeLinkedIn(href: string): string {
  const t = href.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

export function BrandCareerDrawer() {
  const { user, userGigs, brands, profile, refetchPrivate } = useAppDataContext();
  const [rowsByKey, setRowsByKey] = useState<Map<string, RowLite>>(new Map());
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const supabase = createClient();

  const brandMeta = useMemo(() => {
    const m = new Map<
      string,
      { name: string; internship: boolean; referral: boolean }
    >();
    for (const b of brands) {
      const id = b.id.toLowerCase();
      m.set(id, {
        name: b.name?.trim() || "Partner brand",
        internship: b.career_internship_proof_enabled === true,
        referral: b.career_referral_enabled === true,
      });
    }
    return m;
  }, [brands]);

  const stats = useMemo(() => {
    const raw = computeCareerStats(userGigs);
    const enriched = raw.brands.map((b) => ({
      ...b,
      brandName: brandMeta.get(b.brandId.toLowerCase())?.name ?? b.brandName,
    }));
    return { totalCompleted: raw.totalCompleted, brands: enriched };
  }, [userGigs, brandMeta]);

  const reloadRows = useCallback(async () => {
    if (!user?.id) {
      setRowsByKey(new Map());
      setLoadingClaims(false);
      return;
    }
    setLoadingClaims(true);
    const { data, error } = await supabase
      .from("career_rewards")
      .select("id, reward_key, status, certificate_pdf_path")
      .eq("user_id", user.id);

    if (error) {
      console.warn("[BrandCareerDrawer] career_rewards", error);
      setRowsByKey(new Map());
    } else {
      const map = new Map<string, RowLite>();
      for (const r of data ?? []) {
        map.set(r.reward_key as string, {
          id: r.id as string,
          reward_key: r.reward_key as string,
          status: (r.status as string) || "pending",
          certificate_pdf_path: (r.certificate_pdf_path as string | null) ?? null,
        });
      }
      setRowsByKey(map);
    }
    setLoadingClaims(false);
  }, [supabase, user?.id]);

  useEffect(() => {
    void reloadRows();
  }, [reloadRows]);

  const generalKey = generalCertRewardKey();
  const generalRow = rowsByKey.get(generalKey);
  const generalEligible = stats.totalCompleted >= CAREER_GENERAL_THRESHOLD;
  const generalPhase = phaseFor(generalRow, generalEligible);

  const progressPct = Math.min(
    100,
    Math.round((stats.totalCompleted / CAREER_GENERAL_THRESHOLD) * 100),
  );

  const handleRequest = async (rewardKey: string) => {
    if (claimingKey) return;
    setClaimingKey(rewardKey);
    const res = await requestCareerReward(rewardKey);
    setClaimingKey(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Submitted — our team will review shortly.");
    await reloadRows();
    void refetchPrivate({ silent: true });
  };

  const handleDownload = async (rewardId: string) => {
    setDownloadingId(rewardId);
    const res = await getCareerCertificateDownloadUrl(rewardId);
    setDownloadingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  };

  const handleLinkedIn = () => {
    const raw = profile?.linkedin_url?.trim();
    const site =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://axelerate.app";
    if (raw) {
      window.open(normalizeLinkedIn(raw), "_blank", "noopener,noreferrer");
      return;
    }
    const share = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(site)}`;
    window.open(share, "_blank", "noopener,noreferrer");
    toast.message("Add your LinkedIn URL in Settings for a direct profile link.");
  };

  const renderApprovedActions = (row: RowLite, rewardKey: string) => {
    const needPdf = careerRewardNeedsCertificatePdf(rewardKey);
    const hasPdf = Boolean(row.certificate_pdf_path?.trim());
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {needPdf && hasPdf ? (
          <button
            type="button"
            disabled={downloadingId === row.id}
            onClick={() => void handleDownload(row.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-card px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 dark:border-white"
          >
            {downloadingId === row.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Download certificate
          </button>
        ) : null}
        {needPdf && !hasPdf ? (
          <p className="text-[10px] text-muted-foreground">Certificate file pending from ops.</p>
        ) : null}
        <button
          type="button"
          onClick={handleLinkedIn}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#0A66C2] bg-[#0A66C2]/10 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-[#0A66C2] shadow-[2px_2px_0_0_rgba(10,102,194,0.35)] active:translate-x-px active:translate-y-px dark:text-[#70b5f9]"
        >
          <Linkedin className="h-3.5 w-3.5" aria-hidden />
          LinkedIn
        </button>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view career rewards</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-6">
      <header className="mb-6 px-1 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border-2 border-foreground/20 bg-muted/50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:border-white/20 dark:bg-white/5">
          <Sparkles className="h-3 w-3 text-brand-primary" aria-hidden />
          Grow &amp; Earn
        </div>
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-foreground dark:text-white">
          Secure the Bag
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Your career starts here — receipts included.
        </p>
      </header>

      <div
        className={cn(
          "mb-6 rounded-2xl border-2 border-foreground/15 bg-card p-4",
          "shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] dark:border-white/20 dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.08)]",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Career run rate
          </span>
          <span className="font-mono text-xs font-black text-brand-primary">
            {stats.totalCompleted}/{CAREER_GENERAL_THRESHOLD} gigs
          </span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full border-2 border-border bg-muted dark:border-white/10 dark:bg-black/40">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary to-purple-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Finish <span className="font-semibold text-foreground">{CAREER_GENERAL_THRESHOLD}</span>{" "}
          completed gigs platform-wide to request{" "}
          <span className="font-semibold text-foreground">Axelerate Internship Proof</span>. Brand
          lanes (when enabled per partner) unlock at{" "}
          <span className="font-semibold text-foreground">{CAREER_BRAND_THRESHOLD}</span> finished
          wins.
        </p>
      </div>

      <h3 className="mb-3 px-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Rewards deck
      </h3>

      <div className="flex flex-col gap-4">
        <article
          className={neoCardClass({
            active: generalPhase === "eligible",
            fulfilled: generalPhase === "fulfilled",
            pending: generalPhase === "pending",
          })}
        >
          {generalPhase === "fulfilled" ? (
            <div
              className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-emerald-500 bg-emerald-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300"
              aria-hidden
            >
              Approved
            </div>
          ) : null}
          {generalPhase === "pending" ? (
            <div
              className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-amber-500 bg-amber-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
              aria-hidden
            >
              Pending
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/20 bg-background dark:border-white/20",
                generalPhase === "locked" && "opacity-60",
              )}
            >
              {generalPhase === "locked" ? (
                <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
              ) : (
                <TrendingUp className="h-6 w-6 text-brand-primary" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-black uppercase tracking-tight text-foreground">
                Axelerate Internship Proof
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Request your platform-wide proof. Ops reviews, attaches the signed PDF, then you
                download and flex on LinkedIn.
              </p>
              {generalPhase === "locked" ? (
                <p className="mt-2 font-mono text-[10px] font-bold text-muted-foreground">
                  {Math.max(0, CAREER_GENERAL_THRESHOLD - stats.totalCompleted)} more gigs to unlock
                </p>
              ) : null}
              {generalPhase === "eligible" ? (
                <button
                  type="button"
                  disabled={!!claimingKey || loadingClaims}
                  onClick={() => void handleRequest(generalKey)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-black bg-brand-primary px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]"
                >
                  {claimingKey === generalKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Claim certificate
                </button>
              ) : null}
              {generalPhase === "pending" ? (
                <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-200/90">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Under review — you&apos;ll get download + LinkedIn actions once approved.
                </p>
              ) : null}
              {generalPhase === "fulfilled" && generalRow
                ? renderApprovedActions(generalRow, generalKey)
                : null}
            </div>
          </div>
        </article>

        {stats.brands.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground dark:border-white/15">
            No brand stats yet — complete a gig to populate your lanes.
          </p>
        ) : (
          stats.brands.map((b) => {
            const meta = brandMeta.get(b.brandId.toLowerCase());
            const showCert = meta?.internship === true;
            const showRef = meta?.referral === true;
            if (!showCert && !showRef) return null;

            const certK = brandCertRewardKey(b.brandId);
            const refK = brandReferralRewardKey(b.brandId);
            const unlocked = b.count >= CAREER_BRAND_THRESHOLD;
            const certRow = rowsByKey.get(certK);
            const refRow = rowsByKey.get(refK);
            const certPhase = showCert ? phaseFor(certRow, unlocked) : "locked";
            const refPhase = showRef ? phaseFor(refRow, unlocked) : "locked";

            return (
              <div key={b.brandId} className="space-y-3">
                <p className="px-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-primary/90">
                  {b.brandName}
                  <span className="ml-2 text-muted-foreground">
                    · {b.count}/{CAREER_BRAND_THRESHOLD} finished
                  </span>
                </p>

                {showCert ? (
                  <article
                    className={neoCardClass({
                      active: certPhase === "eligible",
                      fulfilled: certPhase === "fulfilled",
                      pending: certPhase === "pending",
                    })}
                  >
                    {certPhase === "fulfilled" ? (
                      <div
                        className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-emerald-500 bg-emerald-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300"
                        aria-hidden
                      >
                        Approved
                      </div>
                    ) : null}
                    {certPhase === "pending" ? (
                      <div
                        className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-amber-500 bg-amber-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
                        aria-hidden
                      >
                        Pending
                      </div>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/20 dark:border-white/20",
                          certPhase === "locked" && "opacity-60 grayscale",
                        )}
                      >
                        {certPhase === "locked" ? (
                          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
                        ) : (
                          <Briefcase className="h-5 w-5 text-brand-primary" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-foreground">Brand track certificate</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Partner-specific internship proof for this brand.
                        </p>
                        {certPhase === "eligible" ? (
                          <button
                            type="button"
                            disabled={!!claimingKey || loadingClaims}
                            onClick={() => void handleRequest(certK)}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-black bg-brand-primary px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 dark:border-white"
                          >
                            {claimingKey === certK ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : null}
                            Request
                          </button>
                        ) : null}
                        {certPhase === "pending" ? (
                          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200/90">
                            Pending team review.
                          </p>
                        ) : null}
                        {certPhase === "fulfilled" && certRow
                          ? renderApprovedActions(certRow, certK)
                          : null}
                      </div>
                    </div>
                  </article>
                ) : null}

                {showRef ? (
                  <article
                    className={neoCardClass({
                      active: refPhase === "eligible",
                      fulfilled: refPhase === "fulfilled",
                      pending: refPhase === "pending",
                    })}
                  >
                    {refPhase === "fulfilled" ? (
                      <div
                        className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-emerald-500 bg-emerald-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300"
                        aria-hidden
                      >
                        Approved
                      </div>
                    ) : null}
                    {refPhase === "pending" ? (
                      <div
                        className="pointer-events-none absolute right-3 top-3 -rotate-12 rounded-md border-2 border-amber-500 bg-amber-500/15 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"
                        aria-hidden
                      >
                        Pending
                      </div>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/20 dark:border-white/20",
                          refPhase === "locked" && "opacity-60 grayscale",
                        )}
                      >
                        {refPhase === "locked" ? (
                          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
                        ) : (
                          <Sparkles className="h-5 w-5 text-brand-primary" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-foreground">Referral lane</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Internal referral opportunity — we confirm, you get the intro flow.
                        </p>
                        {refPhase === "eligible" ? (
                          <button
                            type="button"
                            disabled={!!claimingKey || loadingClaims}
                            onClick={() => void handleRequest(refK)}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-black bg-brand-primary px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 dark:border-white"
                          >
                            {claimingKey === refK ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : null}
                            Request
                          </button>
                        ) : null}
                        {refPhase === "pending" ? (
                          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200/90">
                            Pending team review.
                          </p>
                        ) : null}
                        {refPhase === "fulfilled" && refRow
                          ? renderApprovedActions(refRow, refK)
                          : null}
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
