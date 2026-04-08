"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Zap,
  Sparkles,
  AlertTriangle,
  FileUp,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { submitW9Document } from "@/app/actions/w9-upload";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { resolveTierKey } from "@/lib/types";
import { TierBadge } from "../tier-badge";
import { TierXpProgress } from "../tier-xp-progress";
import type { WalletActivityItem } from "@/app/actions/wallet-activity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  requestWithdrawal,
  getAnnualPayout,
} from "@/app/actions/wallet";
import {
  createWalletTopUpSession,
  isWalletStripeEnabled,
  syncWalletTopUpFromStripeSession,
} from "@/app/actions/stripe-wallet";
import { toast } from "sonner";

const WITHDRAW_METHODS = ["PayPal", "Venmo", "Zelle"] as const;
const FEE_RATE = 0.03;
const FEE_MIN = 0.5;
const MIN_AMOUNT = 20;
const W9_WARNING = 500;
const W9_THRESHOLD = 600;

function calcFee(amount: number) {
  const amt = Math.max(0, Number(amount));
  const fee = Math.max(amt * FEE_RATE, FEE_MIN);
  const net = Math.round((amt - fee) * 100) / 100;
  return { fee, netAmount: net };
}

const MIN_TOPUP = 5;
const MAX_TOPUP = 500;

const W9_MAX_BYTES = 5 * 1024 * 1024;
const W9_ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function WalletDrawer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topupToastHandled = useRef(false);
  const { user, profile, transactions, walletActivity, isLoadingPrivate, refetchPrivate } =
    useAppDataContext();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [w9UploadOpen, setW9UploadOpen] = useState(false);
  const [annualPayout, setAnnualPayout] = useState<number | null>(null);
  const [stripeTopUpEnabled, setStripeTopUpEnabled] = useState(false);

  useEffect(() => {
    void isWalletStripeEnabled().then(setStripeTopUpEnabled);
  }, []);

  useEffect(() => {
    if (user?.id) {
      getAnnualPayout(user.id).then(setAnnualPayout);
    } else {
      setAnnualPayout(null);
    }
  }, [user?.id]);

  useEffect(() => {
    const w = searchParams.get("wallet_topup");
    if (w !== "success" && w !== "cancelled") return;
    if (topupToastHandled.current) return;
    topupToastHandled.current = true;

    const run = async () => {
      if (w === "success") {
        const sid = searchParams.get("session_id");
        if (sid) {
          const res = await syncWalletTopUpFromStripeSession(sid);
          if (!res.ok) {
            toast.error(res.error);
          } else if (res.credited) {
            toast.success("Funds added to your wallet.");
          } else {
            toast.message("Payment is still processing. Balance may update shortly.");
          }
        } else {
          toast.success("Funds added to your wallet.");
        }
        await refetchPrivate();
      } else {
        toast.message("Top-up was cancelled.");
      }
      router.replace("/?tab=profile", { scroll: false });
    };

    void run();
  }, [searchParams, router, refetchPrivate]);

  const pending = transactions.filter((t) => t.status === "pending");
  const cleared = transactions.filter((t) => t.status === "cleared");
  const pendingAmount = pending.reduce((s, t) => s + Number(t.amount), 0);
  const clearedAmount = cleared.reduce((s, t) => s + Number(t.amount), 0);
  const cashBalance = Number(profile?.cash_balance ?? 0);
  const creditBalance = profile?.credit_balance ?? 0;
  const userTier = resolveTierKey(profile?.tier ?? "guest");

  if (!profile && !isLoadingPrivate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view your wallet</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-4">
      <header className="mb-6 min-w-0 px-1">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-fluid-lg font-bold text-white sm:h-16 sm:w-16">
            {(profile?.full_name ?? "U")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-fluid-xl font-bold tracking-tight text-foreground">
              {profile?.full_name ?? "User"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile?.campus ?? "—"}
              <span className="mt-0.5 block text-xs text-muted-foreground/90">Wallet & activity</span>
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <TierBadge tier={userTier} size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* XP Progress */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <TierXpProgress
          xp={profile?.xp ?? 0}
          tier={userTier}
          variant="wallet"
        />
      </div>

      {/* $500 Yellow Warning */}
      {annualPayout != null && annualPayout >= W9_WARNING && annualPayout < W9_THRESHOLD && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-medium text-amber-200">
            Tax Compliance: You are approaching the $600 IRS threshold. Please
            be prepared to provide W-9 info for continued payouts.
          </p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
            <span className="truncate">Cash Available</span>
          </div>
          <p className="min-w-0 text-fluid-lg font-bold tabular-nums tracking-tight text-brand-primary">
            ${cashBalance.toFixed(2)}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {annualPayout != null &&
            annualPayout >= W9_THRESHOLD &&
            !profile?.is_w9_verified ? (
              <>
                {profile?.w9_submitted_at && (
                  <p className="text-[10px] font-medium text-amber-200/90">
                    W-9 on file — pending team verification. You can replace the file below if
                    needed.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setW9UploadOpen(true)}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-all hover:bg-amber-500/30 active:scale-95"
                  >
                    <FileUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">
                      {profile?.w9_submitted_at ? "Replace W-9" : "Upload W-9"}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawOpen(true)}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  Withdraw
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-all hover:bg-brand-primary/20 active:scale-95"
            >
              <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
              Add Funds
            </button>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Pending
          </div>
          <p className="min-w-0 text-fluid-lg font-bold tabular-nums tracking-tight text-foreground">
            ${pendingAmount.toFixed(2)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {pending.some((t) => t.clears_at) ? "Clears in 3–5 business days" : "—"}
          </p>
        </div>
      </div>

      {/* Credits */}
      <div className="mb-6 min-w-0 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
          Credits
        </div>
        <p className="min-w-0 text-fluid-lg font-bold tabular-nums text-foreground">
          {Number(creditBalance).toLocaleString()}{" "}
          <span className="text-fluid-base font-medium text-brand-primary/80">pts</span>
        </p>
      </div>

      {/* Recent activity: transactions, orders, withdrawals, payouts */}
      <div className="mb-6">
        <h2 className="mb-3 px-1 text-sm font-semibold tracking-tight text-foreground">
          Recent activity
        </h2>
        <div className="flex flex-col gap-1">
          {isLoadingPrivate ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : walletActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No activity yet
            </div>
          ) : (
            walletActivity.map((row) => <ActivityRow key={row.key} row={row} />)
          )}
        </div>
      </div>

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        userId={user?.id ?? null}
        cashBalance={cashBalance}
        onSuccess={() => {
          refetchPrivate();
          setWithdrawOpen(false);
        }}
        onRequireW9={() => {
          setWithdrawOpen(false);
          setW9UploadOpen(true);
        }}
      />

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        userId={user?.id ?? null}
        stripeEnabled={stripeTopUpEnabled}
      />

      <W9UploadDialog
        open={w9UploadOpen}
        onOpenChange={setW9UploadOpen}
        userId={user?.id ?? null}
        w9Verified={profile?.is_w9_verified === true}
        w9SubmittedAt={profile?.w9_submitted_at ?? null}
        onUploaded={() => void refetchPrivate()}
      />
    </div>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  userId,
  cashBalance,
  onSuccess,
  onRequireW9,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  cashBalance: number;
  onSuccess: () => void;
  onRequireW9?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"PayPal" | "Venmo" | "Zelle">("PayPal");
  const [accountInfo, setAccountInfo] = useState("");
  const [isPending, startTransition] = useTransition();

  const amt = parseFloat(amount) || 0;
  const { fee, netAmount } = calcFee(amt);
  const isValid = amt >= MIN_AMOUNT && amt <= cashBalance && accountInfo.trim();

  const handleSubmit = () => {
    if (!userId || !isValid) return;
    startTransition(async () => {
      const result = await requestWithdrawal(amt, method, accountInfo.trim());
      if (result.success) {
        toast.success("Withdrawal request submitted!");

        if (result.requiresW9) {
          toast.warning(
            "Tax Compliance: Since your annual earnings exceed $600, a W-9 form is required for further payouts.",
            { duration: 8000 }
          );
        }
        setAmount("");
        setAccountInfo("");
        onSuccess();
      } else {
        if (result.code === "REQUIRE_W9") {
          onRequireW9?.();
        }
        if (result.code === "W9_PENDING") {
          toast.warning(result.error, { duration: 10000 });
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setAmount("");
      setAccountInfo("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground dark:text-white">
            Withdraw
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Payout to your <span className="font-semibold text-foreground">PayPal, Venmo, or Zelle</span>{" "}
            (team processes requests manually). Min $20. Fee: 3% or $0.50, whichever is higher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Amount to Withdraw
            </label>
            <input
              type="number"
              min={MIN_AMOUNT}
              max={cashBalance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="20.00"
              className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-white focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
            />
          </div>

          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Amount to Withdraw</span>
              <span className="font-bold text-foreground dark:text-white">${amt.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-xs">
              <span className="text-muted-foreground">Service Fee</span>
              <span className="font-bold text-foreground dark:text-white">${fee.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="font-bold text-brand-primary">You will receive (Net)</span>
              <span className="font-black text-brand-primary">${netAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-foreground focus:border-brand-primary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {WITHDRAW_METHODS.map((m) => (
                <option key={m} value={m} className="bg-card dark:bg-zinc-900">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Account (Email or Phone)
            </label>
            <input
              type="text"
              value={accountInfo}
              onChange={(e) => setAccountInfo(e.target.value)}
              placeholder="your@email.com or +1234567890"
              className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-white focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid || isPending || !userId}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-black uppercase tracking-wider transition-all active:scale-[0.98]",
              isValid && userId && !isPending
                ? "bg-brand-primary text-white shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)] hover:bg-brand-primary"
                : "cursor-not-allowed bg-muted text-muted-foreground dark:bg-white/5"
            )}
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              "Submit Withdrawal"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DepositDialog({
  open,
  onOpenChange,
  userId,
  stripeEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  stripeEnabled: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const amt = parseFloat(amount) || 0;
  const valid =
    amt >= MIN_TOPUP &&
    amt <= MAX_TOPUP &&
    Number.isFinite(amt) &&
    Boolean(userId);

  const handleOpenChange = (next: boolean) => {
    if (!next) setAmount("");
    onOpenChange(next);
  };

  const handleStripeTopUp = () => {
    if (!valid || !stripeEnabled) return;
    startTransition(async () => {
      const res = await createWalletTopUpSession(amt);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.url;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground dark:text-white">
            Add Funds
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Top up cash balance with a card via Stripe (${MIN_TOPUP}–${MAX_TOPUP} per top-up). Funds credit
            your wallet for Perks Shop checkout.
          </DialogDescription>
        </DialogHeader>
        {!stripeEnabled ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 py-10 dark:border-white/10">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-center text-sm font-medium text-foreground dark:text-white">
              Card top-up is not configured
            </p>
            <p className="mt-2 max-w-sm text-center text-xs text-muted-foreground">
              Set <code className="rounded bg-muted px-1">STRIPE_SECRET_KEY</code> on the server to enable
              Stripe.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Amount (USD)
              </label>
              <input
                type="number"
                min={MIN_TOPUP}
                max={MAX_TOPUP}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${MIN_TOPUP}.00`}
                className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-white focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
              />
            </div>
            <button
              type="button"
              onClick={handleStripeTopUp}
              disabled={!valid || isPending}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-black uppercase tracking-wider transition-all active:scale-[0.98]",
                valid && !isPending
                  ? "bg-brand-primary text-white shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)]"
                  : "cursor-not-allowed bg-muted text-muted-foreground dark:bg-white/5"
              )}
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Redirecting…
                </>
              ) : (
                "Continue with Stripe"
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function W9UploadDialog({
  open,
  onOpenChange,
  userId,
  w9Verified,
  w9SubmittedAt,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  w9Verified: boolean;
  w9SubmittedAt: string | null;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next && uploading) return;
    onOpenChange(next);
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) {
      if (!userId) toast.error("Please sign in.");
      return;
    }
    if (!W9_ALLOWED_MIME.has(file.type)) {
      toast.error("Use a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > W9_MAX_BYTES) {
      toast.error("File must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await submitW9Document(fd);
    setUploading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }

    toast.success("W-9 uploaded. Our team will verify it shortly.");
    onUploaded();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground dark:text-white">
            Upload W-9 Form
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            IRS requires Form W-9 for payouts over $600/year. Upload a clear scan or PDF of your
            signed W-9. Accepted: PDF, JPG, PNG (max 5 MB).
          </DialogDescription>
        </DialogHeader>

        {w9Verified ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-10">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-center text-sm font-bold text-foreground dark:text-white">
              Your W-9 is verified
            </p>
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              You can submit withdrawals. Upload again only if your tax information changed.
            </p>
            <button
              type="button"
              disabled={uploading || !userId}
              onClick={pickFile}
              className="mt-2 rounded-xl border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 dark:border-white/15"
            >
              Replace file
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {w9SubmittedAt && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                Submitted {new Date(w9SubmittedAt).toLocaleString()} — waiting for verification.
                Upload again to replace the file.
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              disabled={uploading || !userId}
              onClick={pickFile}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 py-10 text-sm font-bold transition-all",
                uploading || !userId
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-amber-500/60 hover:bg-amber-500/10 active:scale-[0.99]"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                  Uploading…
                </>
              ) : (
                <>
                  <FileUp className="h-5 w-5 text-amber-400" />
                  Choose PDF or image
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-muted-foreground">
              Files are stored privately. Only you and authorized staff can access them.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function fmtCashDelta(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function ActivityRow({ row }: { row: WalletActivityItem }) {
  const cashLine = fmtCashDelta(row.cashDelta);
  const creditLine =
    row.creditsDelta != null &&
    Number.isFinite(row.creditsDelta) &&
    row.creditsDelta !== 0
      ? `${row.creditsDelta > 0 ? "+" : ""}${row.creditsDelta} pts`
      : null;
  const xpLine =
    row.xpDelta != null && Number.isFinite(row.xpDelta) && row.xpDelta !== 0
      ? `${row.xpDelta > 0 ? "+" : ""}${row.xpDelta} XP`
      : null;
  const iconPositive =
    (row.cashDelta ?? 0) > 0 ||
    (row.creditsDelta ?? 0) > 0 ||
    (row.xpDelta ?? 0) > 0;
  const iconNegative =
    (row.cashDelta ?? 0) < 0 ||
    (row.creditsDelta ?? 0) < 0 ||
    (row.xpDelta ?? 0) < 0;
  const st = (row.statusLabel ?? "").toLowerCase();

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-card">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            iconPositive && !iconNegative
              ? "bg-emerald-400/10 text-emerald-400"
              : iconNegative && !iconPositive
                ? "bg-rose-500/10 text-rose-400"
                : iconPositive && iconNegative
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-purple-500/10 text-purple-400"
          )}
        >
          <DollarSign className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{row.title}</p>
          {row.subtitle ? (
            <p className="text-sm text-muted-foreground">{row.subtitle}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {new Date(row.ts).toLocaleString()}
          </p>
          {row.adminNote ? (
            <p className="mt-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs leading-snug text-amber-100">
              <span className="font-medium text-amber-200/90">Note:</span>{" "}
              {row.adminNote}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 space-y-0.5 text-right">
        {cashLine ? (
          <p className="text-sm font-bold tabular-nums text-foreground">{cashLine}</p>
        ) : null}
        {creditLine ? (
          <p className="text-xs font-semibold tabular-nums text-brand-primary/90">{creditLine}</p>
        ) : null}
        {xpLine ? (
          <p className="text-xs font-semibold tabular-nums text-muted-foreground">{xpLine}</p>
        ) : null}
        {!cashLine && !creditLine && !xpLine ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : null}
        {row.statusLabel ? (
          <p
            className={cn(
              "text-xs font-medium capitalize tracking-tight",
              st === "cleared" || st === "completed"
                ? "text-emerald-400"
                : st === "rejected"
                  ? "text-rose-400"
                  : "text-purple-400"
            )}
          >
            {row.statusLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
