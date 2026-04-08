"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Users,
  Copy,
  CheckCircle2,
  XCircle,
  Shield,
  Share2,
  Link2,
  QrCode,
  TrendingUp,
  ShieldAlert,
  Clock,
  Gift,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { generateReferralCode } from "@/lib/referral-code";
import { DrawerScreenHeader } from "@/components/drawers/drawer-screen-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { redeemReferralSignupCode } from "@/app/actions/redeem-referral-code";

const blockReasonLabels: Record<string, string> = {
  "address-match": "Shipping address matches ambassador",
  "not-new-user": "Buyer is not a new user",
  "inventory-cap": "Monthly purchase limit exceeded",
};

function formatReferralPts(n: number): string {
  const v = Math.round(Number(n));
  return `${v.toLocaleString()} pts`;
}

function referredDisplayName(ref: ReferralRow): string {
  const raw = ref.referred_profile?.full_name?.trim();
  if (raw) return raw;
  const tail = ref.referred_id.replace(/-/g, "").slice(-6).toUpperCase();
  return tail ? `Member · ${tail}` : "Member";
}

interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  reward_amount: number;
  reward_xp?: number | null;
  status: "pending" | "approved" | "blocked";
  blocked_reason: string | null;
  created_at: string;
  referred_profile?: { full_name: string | null } | null;
}

export function ReferralsDrawer() {
  const { user, profile, refetchPrivate } = useAppDataContext();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [filter, setFilter] = useState<"all" | "approved" | "blocked">("all");
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [congratsCredits, setCongratsCredits] = useState(2000);

  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Generate and persist referral_code when missing
  useEffect(() => {
    if (!user?.id || !profile) return;

    const existing = profile.referral_code;
    if (existing && existing.length > 0) {
      setCode(existing);
      return;
    }

    const generated = generateReferralCode(
      profile.full_name,
      profile.campus,
      profile.created_at ?? user.created_at
    );

    const saveCode = async () => {
      setSavingCode(true);
      const { error } = await supabase
        .from("profiles")
        .update({ referral_code: generated })
        .eq("id", user.id);

      if (!error) {
        setCode(generated);
        refetchPrivate();
      } else {
        setCode(generated);
      }
      setSavingCode(false);
    };

    saveCode();
  }, [user?.id, profile?.id, profile?.referral_code, profile?.full_name, profile?.campus, profile?.created_at, refetchPrivate]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchRefs = async () => {
      setLoadingRefs(true);
      const { data, error } = await supabase
        .from("referrals")
        .select(
          `
          *,
          referred_profile:profiles!referrals_referred_id_fkey (
            full_name
          )
        `,
        )
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[ReferralsDrawer] fetch referrals", error);
        setReferrals([]);
      } else {
        setReferrals((data as ReferralRow[]) ?? []);
      }
      setLoadingRefs(false);
    };
    fetchRefs();
  }, [user?.id]);

  const displayCode = code ?? profile?.referral_code ?? (savingCode ? "Generating..." : "—");
  const codeReady =
    Boolean(displayCode) &&
    displayCode !== "—" &&
    displayCode !== "Generating...";

  const referralUrl = useMemo(() => {
    if (
      !displayCode ||
      displayCode === "—" ||
      displayCode === "Generating..."
    ) {
      return "";
    }
    const base =
      origin ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://axelerate.app";
    return `${base}/r/${encodeURIComponent(displayCode.trim())}`;
  }, [displayCode, origin]);

  const approvedRefs = referrals.filter((r) => r.status === "approved");
  const blockedRefs = referrals.filter((r) => r.status === "blocked");
  const totalEarned = approvedRefs.reduce((s, r) => s + Number(r.reward_amount), 0);
  const totalBlocked = blockedRefs.reduce((s, r) => s + Number(r.reward_amount), 0);
  const filteredRefs =
    filter === "all"
      ? referrals
      : referrals.filter((r) => r.status === filter);

  const handleCopy = () => {
    if (!codeReady || typeof displayCode !== "string") return;
    navigator.clipboard.writeText(displayCode.trim());
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = redeemInput.trim();
    if (!code || redeemBusy) return;
    setRedeemBusy(true);
    const res = await redeemReferralSignupCode(code);
    setRedeemBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCongratsCredits(res.refereeCredits);
    setRedeemInput("");
    setCongratsOpen(true);
    toast.success("Referral code applied");
    await refetchPrivate({ silent: true });
  };

  const handleShareLink = async () => {
    if (!referralUrl) {
      toast.error("Link not ready yet");
      return;
    }
    setShareBusy(true);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on Axelerate",
          text: "Sign up with my referral link.",
          url: referralUrl,
        });
        setShareBusy(false);
        return;
      } catch (e) {
        const err = e as { name?: string };
        if (err?.name === "AbortError") {
          setShareBusy(false);
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy — try selecting the link below");
    }
    setShareBusy(false);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to invite friends</p>
      </div>
    );
  }

  const hasRedeemed = Boolean(profile?.referred_by);

  return (
    <div className="min-w-0 pb-4">
      <DrawerScreenHeader
        kickerIcon={<Users className="h-4 w-4 shrink-0" aria-hidden />}
        kicker="Ambassador program"
        title="Referrals"
      />

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950/80">
        <div className="mb-2 flex items-center gap-2">
          <Ticket className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Redeem a referral code
          </h3>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          New to Axelerate? Enter a friend&apos;s code{" "}
          <span className="font-semibold text-foreground">once</span>. We verify it against
          real accounts. You&apos;ll receive{" "}
          <span className="font-semibold text-foreground">2,000 credits</span>; your friend
          gets <span className="font-semibold text-foreground">1,000 credits</span> and{" "}
          <span className="font-semibold text-foreground">100 XP</span>.
        </p>
        {hasRedeemed ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <p className="text-xs font-medium leading-snug text-emerald-200/90">
              You&apos;ve already redeemed a referral code. Thanks for joining through the
              community.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleRedeemSubmit(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="referral-redeem-input" className="sr-only">
                Referral code
              </label>
              <input
                id="referral-redeem-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Enter code (e.g. AX123ABC)"
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value)}
                disabled={redeemBusy}
                className="w-full rounded-xl border-2 border-border bg-muted/30 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-primary/50 focus:outline-none disabled:opacity-60 dark:border-white/10 dark:bg-black/30"
              />
            </div>
            <button
              type="submit"
              disabled={redeemBusy || !redeemInput.trim()}
              className="shrink-0 rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {redeemBusy ? "Checking…" : "Redeem"}
            </button>
          </form>
        )}
      </div>

      <Dialog open={congratsOpen} onOpenChange={setCongratsOpen}>
        <DialogContent className="z-[240] max-w-sm border-2 border-border bg-card dark:border-white/10 dark:bg-zinc-950">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/15 ring-2 ring-brand-primary/30">
              <Gift className="h-7 w-7 text-brand-primary" aria-hidden />
            </div>
            <DialogTitle className="text-center font-display text-xl font-black tracking-tight">
              Welcome aboard
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              Your referral code was applied successfully.{" "}
              <span className="font-semibold text-foreground">
                {congratsCredits.toLocaleString()} credits
              </span>{" "}
              have been added to your account as a new-member reward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <button
              type="button"
              onClick={() => setCongratsOpen(false)}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-95 sm:w-auto sm:px-8"
            >
              Let&apos;s go
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5">
        <p className="mb-2 text-xs font-medium tracking-tight text-muted-foreground">
          Your referral code
        </p>
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-tight text-brand-primary">
            {displayCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!codeReady}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all active:scale-[0.95]",
              copied
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
            )}
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-card/50 p-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs font-mono text-foreground" title={referralUrl || undefined}>
            {referralUrl || (codeReady ? "…" : "Generating link…")}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void handleShareLink()}
            disabled={!referralUrl || shareBusy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 text-xs font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5 shrink-0" />
            {shareBusy ? "…" : "Share link"}
          </button>
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            disabled={!referralUrl}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:border-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={showQr ? "Hide QR code" : "Show QR code"}
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
        </div>

        {showQr && referralUrl ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 animate-slide-up">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <QRCodeSVG
                value={referralUrl}
                size={140}
                level="M"
                marginSize={2}
                title="Referral link QR code"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">Scan to open your referral link</p>
          </div>
        ) : null}
        {showQr && !referralUrl ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Generating your code…</p>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium tracking-tight text-muted-foreground">Earned credits</span>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-400">
            {formatReferralPts(totalEarned)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{approvedRefs.length} approved</p>
        </div>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-medium tracking-tight text-muted-foreground">Blocked</span>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-destructive">
            {formatReferralPts(totalBlocked)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{blockedRefs.length} flagged</p>
        </div>
      </div>
      <p className="mb-6 text-xs text-muted-foreground">
        Totals are in platform points (pts), the same currency as Perks Shop credits — not cash.
      </p>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0 text-brand-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Fair-use rules</h3>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p>
              Rewards apply when referred users place their{" "}
              <span className="font-medium text-foreground">first qualifying order</span> as new
              customers, as determined by our systems.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p>
              If the buyer&apos;s shipping address matches yours, the referral earns{" "}
              <span className="font-medium text-destructive">0 pts</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "approved", "blocked"] as const).map((f) => {
          const count = f === "all" ? referrals.length : f === "approved" ? approvedRefs.length : blockedRefs.length;
          return (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium tracking-tight transition-all",
                filter === f
                  ? "bg-brand-primary text-white"
                  : "border border-border bg-card text-secondary-foreground"
              )}
            >
              {f === "all" ? "All" : f === "approved" ? "Earned" : "Blocked"}
              <span className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                filter === f ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {loadingRefs ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          filteredRefs.map((ref) => (
            <div
              key={ref.id}
              className={cn(
                "rounded-xl border p-3 transition-all",
                ref.status === "blocked" ? "border-destructive/20 bg-destructive/5" : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold",
                      ref.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
                      ref.status === "blocked" ? "bg-destructive/10 text-destructive" :
                      "bg-secondary text-muted-foreground"
                    )}
                  >
                    {ref.status === "approved" ? <CheckCircle2 className="h-4 w-4" /> :
                     ref.status === "blocked" ? <XCircle className="h-4 w-4" /> :
                     <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {referredDisplayName(ref)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ref.status === "pending"
                        ? "Pending review"
                        : ref.status === "blocked"
                          ? "Blocked referral"
                          : "Used your code"}
                      {" · "}
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                    {ref.status === "blocked" && ref.blocked_reason && (
                      <div className="mt-1 text-xs text-destructive">
                        {blockReasonLabels[ref.blocked_reason] ?? ref.blocked_reason}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      ref.status === "approved"
                        ? "text-emerald-400"
                        : ref.status === "blocked"
                          ? "text-destructive line-through"
                          : "text-foreground"
                    )}
                  >
                    {ref.status === "blocked"
                      ? "0 pts"
                      : ref.status === "pending"
                        ? "—"
                        : `+${formatReferralPts(Number(ref.reward_amount))}`}
                  </p>
                  {ref.status === "approved" && Math.round(Number(ref.reward_xp ?? 0)) > 0 ? (
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-violet-300">
                      +{Math.round(Number(ref.reward_xp))} XP
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}

        {!loadingRefs && filteredRefs.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm font-bold text-foreground">No referrals found</p>
            <p className="text-xs text-muted-foreground">Share your code to start earning!</p>
          </div>
        )}
      </div>
    </div>
  );
}
