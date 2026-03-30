"use client";

import { motion } from "framer-motion";

type TierKey = "guest" | "student" | "partner";

const SHOWCASE_ORDER: TierKey[] = ["guest", "student", "partner"];

const TIER_COPY: Record<
  TierKey,
  { headline: string; tierTag: string; body: string; cta: string }
> = {
  guest: {
    headline: "The window shopper",
    tierTag: "Guest",
    body: "Look around. See the high-paying gigs and Friday Night Drops you're missing out on. Ready to get paid? Upgrade with one tap.",
    cta: "Browse as guest",
  },
  student: {
    headline: "The hustler",
    tierTag: "Scout",
    body: "The starting line. Apply to active gigs, earn real cash, stack XP, and start building your creator portfolio.",
    cta: "Start earning XP",
  },
  partner: {
    headline: "The inner circle",
    tierTag: "Partner",
    body: "Priority access. Get first dibs on VIP events, co-creation tracks, and the highest-paying brand missions on campus. Invite only.",
    cta: "Partner track",
  },
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

function headerBlock(tier: TierKey): string {
  if (tier === "guest") {
    return "border-b-2 border-border bg-muted/80 text-foreground dark:bg-white/10";
  }
  if (tier === "student") {
    return "border-b-2 border-border bg-gradient-to-r from-brand-primary/90 to-purple-600/90 text-primary-foreground";
  }
  return "border-b-2 border-border bg-secondary/90 text-secondary-foreground";
}

export function LandingTierShowcase() {
  return (
    <section className="border-b-2 border-border py-20 pb-24 md:py-28 md:pb-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-16 max-w-3xl md:mb-20"
        >
          <h2 className="font-display text-5xl uppercase leading-[0.9] tracking-[-0.02em] sm:text-6xl md:text-7xl lg:text-8xl">
            Level up.
            <br />
            Unlock the vault.
          </h2>
          <p className="mt-7 max-w-xl font-mono text-sm font-medium leading-relaxed tracking-tight text-muted-foreground md:mt-8 md:text-[0.95rem] md:leading-7">
            This isn&apos;t just a gig app, it&apos;s a ladder. The more you execute, the higher you climb,
            the better the rewards.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 items-start gap-5 md:grid-cols-3 md:gap-6"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {SHOWCASE_ORDER.map((key) => {
            const featured = key === "student";
            const copy = TIER_COPY[key];
            return (
              <motion.article
                key={key}
                variants={item}
                className={`flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm transition-all hover:border-primary/35 dark:border-white/10 dark:bg-zinc-900/80 ${
                  featured ? "md:z-[2] md:-translate-y-3 md:scale-[1.04]" : ""
                }`}
              >
                <div className={`px-5 py-5 md:px-6 md:py-5 ${headerBlock(key)}`}>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] opacity-90">
                    {copy.tierTag}
                  </p>
                  <h3 className="font-display mt-2 text-2xl uppercase leading-[0.95] tracking-tight sm:text-3xl">
                    {copy.headline}
                  </h3>
                </div>
                <p className="flex-1 p-5 font-mono text-xs font-medium leading-relaxed tracking-tight text-muted-foreground sm:p-6 sm:text-sm sm:leading-6">
                  {copy.body}
                </p>
                <div className="border-t-2 border-border p-5 dark:border-white/10 sm:px-6">
                  <button
                    type="button"
                    className={`w-full rounded-2xl border-2 border-border py-3.5 text-center font-mono text-[10px] font-black uppercase tracking-[0.18em] transition-all active:scale-[0.98] dark:border-white/10 sm:text-xs ${
                      featured
                        ? "bg-brand-primary text-primary-foreground shadow-sm hover:opacity-95"
                        : "bg-muted/60 text-foreground hover:bg-muted dark:bg-white/5"
                    }`}
                  >
                    {copy.cta}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
