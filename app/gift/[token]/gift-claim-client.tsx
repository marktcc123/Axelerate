"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import Confetti from "react-confetti";
import { toast } from "sonner";
import { Gift, Sparkles, Loader2, PartyPopper, ArrowRight, PackageOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LazyLoginPrompt } from "@/components/auth/lazy-login-prompt";
import { cn } from "@/lib/utils";
import { claimPerksGift } from "@/app/actions/gift-checkout";

export type GiftLandingPreviewPayload = {
  claimed: boolean;
  title: string;
  imageUrl: string | null;
  brandName: string | null;
};

export function GiftClaimExperience({
  token,
  preview,
}: {
  token: string;
  preview: GiftLandingPreviewPayload;
}) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [busy, startTransition] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const redirectPath =
    typeof window !== "undefined" ? `/gift/${encodeURIComponent(token)}` : "";

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSessionUserId(data.session?.user?.id ?? null);
      setLoadingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onClaim = () => {
    startTransition(async () => {
      const res = await claimPerksGift(token);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Gift unlocked — it’s in your orders.");
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 6500);
    });
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#07060b]">
      {celebrate ? (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          <Confetti
            width={typeof window !== "undefined" ? window.innerWidth : 400}
            height={typeof window !== "undefined" ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={420}
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute -left-[20%] top-[-20%] h-[520px] w-[520px] rounded-full bg-violet-600/35 blur-[120px]" />
      <div className="pointer-events-none absolute -right-[10%] bottom-[-25%] h-[560px] w-[560px] rounded-full bg-fuchsia-500/25 blur-[130px]" />
      <div className="pointer-events-none absolute left-1/2 top-[15%] h-[340px] w-[340px] -translate-x-1/2 rounded-full bg-amber-400/12 blur-[100px]" />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-12 pt-10 sm:pt-14">
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/?tab=shop"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/80 backdrop-blur-md transition-colors hover:bg-white/10"
          >
            Axelerate
          </Link>
          <Gift className="h-9 w-9 text-fuchsia-300 drop-shadow-[0_0_18px_rgba(232,121,249,0.55)]" />
        </div>

        <section
          className={cn(
            "relative rounded-[2rem] border-2 border-white/12 bg-white/[0.06] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-violet-500/15 before:to-transparent"
          )}
        >
          <div className="relative mx-auto mb-6 flex justify-center">
            <div className="relative grid h-[200px] w-[200px] place-items-center overflow-hidden rounded-[1.65rem] border-4 border-brand-primary shadow-[0_0_42px_rgba(var(--theme-primary-rgb),0.45)]">
              {preview.imageUrl ?
                <Image
                  src={preview.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
              : <Sparkles className="h-20 w-20 text-brand-primary/80" />}
            </div>
            <span className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-amber-200 shadow-lg">
              <PartyPopper className="h-4 w-4" aria-hidden />
              Surprise inside
            </span>
          </div>

          {preview.brandName ?
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-violet-200/85">
              {preview.brandName}
            </p>
          : null}

          <h1 className="mb-4 text-center text-2xl font-black uppercase tracking-tight text-white sm:text-[1.85rem] sm:leading-tight">
            {preview.title}
          </h1>
          <p className="mb-8 text-center text-sm leading-relaxed text-white/72">
            A friend hooked you up on Axelerate. Log in once to unwrap this perk — shipping and
            fulfillment kick off through your Axelerate order.
          </p>

          {preview.claimed ?
            <div className="rounded-2xl border border-white/14 bg-black/35 px-4 py-8 text-center">
              <PackageOpen className="mx-auto mb-3 h-11 w-11 text-muted-foreground" aria-hidden />
              <p className="font-bold text-white">Already claimed</p>
              <p className="mt-2 text-sm text-white/60">
                Ask your friend if they shared the wrong link — each gift unlocks exactly once.
              </p>
            </div>
          : loadingSession ?
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/55">Checking session</span>
            </div>
          : sessionUserId ?
            <div className="space-y-5">
              <button
                type="button"
                disabled={busy}
                onClick={onClaim}
                className={cn(
                  "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-[var(--theme-primary)] bg-gradient-to-br from-brand-primary via-violet-500 to-fuchsia-500 py-4 text-lg font-black uppercase tracking-wide text-black shadow-[0_0_40px_rgba(var(--theme-primary-rgb),0.45)] transition-transform active:scale-[0.98]",
                  busy && "opacity-70"
                )}
              >
                <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.45),transparent)] opacity-40 transition-opacity group-hover:opacity-70 motion-safe:animate-pulse" />
                {busy ?
                  <Loader2 className="relative h-6 w-6 animate-spin" />
                : <Sparkles className="relative h-6 w-6" />}
                <span className="relative">Unwrap gift</span>
                <ArrowRight className="relative h-6 w-6" aria-hidden />
              </button>

              <p className="text-center text-[11px] text-white/52">
                We’ll attach this to{" "}
                <Link href="/my-orders" className="font-bold underline decoration-violet-400/70">
                  My Orders
                </Link>
                {" — "}zero charge for this pickup.
              </p>
            </div>
          : <div className="rounded-2xl border border-white/14 bg-black/40 p-1">
              <LazyLoginPrompt variant="default" redirectPath={redirectPath} />
            </div>
          }

          {!preview.claimed && !loadingSession ?
            <p className="mt-8 text-center text-[11px] text-white/42">
              By continuing you agree we’ll create an Axelerate order for fulfillment only — no spam,
              student-first drops.
            </p>
          : null}
        </section>

        <p className="mt-12 text-center text-[10px] uppercase tracking-[0.25em] text-white/30">
          · Axelerate Perks Gift · {token.slice(0, 12)}···
        </p>
      </main>
    </div>
  );
}
