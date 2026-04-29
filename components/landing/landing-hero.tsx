"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const MARQUEE_PARTS = [
  "AXELERATE",
  "FEED",
  "MY GIGS",
  "PERKS SHOP",
  "FRIDAY NIGHT DROP",
  "LEVEL PROGRESS",
  "EXCLUSIVE EVENTS",
  "TRENDING REWARDS",
  "AXELERATING BRANDS",
];

const LANDING_TITLE_LINE =
  "w-full text-left text-[clamp(2.5rem,10.5vw,6.25rem)] font-black uppercase leading-[0.87] tracking-[-0.04em] text-white [text-shadow:4px_4px_0_rgb(0_0_0)] sm:leading-[0.9] dark:text-white";

export function LandingHero() {
  const sequence = [0, 0.06, 0.14, 0.26, 0.36];

  return (
    <header className="relative z-10 border-b-2 border-border">
      <div className="landing-marquee bg-muted/70 dark:bg-white/5">
        <div className="landing-marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex">
              {MARQUEE_PARTS.map((t) => (
                <span key={`${dup}-${t}`} className="landing-marquee-item flex items-center gap-3 text-foreground">
                  <span className="text-brand-primary" aria-hidden>
                    ★
                  </span>
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-[min(92dvh,820px)] grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-0 border-b-2 border-border px-6 py-8 md:border-b-0 md:border-r-2 md:border-border md:px-10 md:py-10 lg:px-14">
          <div className="-mx-1 mb-6 w-[calc(100%+0.5rem)] overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <motion.p
              className="inline-block min-w-max text-left font-mono text-[0.6875rem] font-bold uppercase leading-none tracking-[0.06em] text-purple-200 drop-shadow-[0_2px_12px_rgb(0_0_0/0.55)] dark:text-purple-100/95 sm:text-xs sm:tracking-[0.12em] md:text-sm md:tracking-[0.2em]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: sequence[0] }}
            >
              YOUR BACKSTAGE PASS TO GLOBAL BRANDS &amp; EXCLUSIVE PERKS
            </motion.p>
          </div>

          <motion.div
            className="max-w-none"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: sequence[1] }}
          >
            <h1 className="flex w-full flex-col items-start text-left font-display">
              <div className={LANDING_TITLE_LINE}>COP DROPS.</div>
              <div className={LANDING_TITLE_LINE}>CREATE IMPACT.</div>
              <div className={LANDING_TITLE_LINE}>CASH OUT.</div>
            </h1>
          </motion.div>

          <motion.div
            className="mt-8 max-w-2xl text-left md:mb-6"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: sequence[2] }}
          >
            <p className="font-mono text-sm font-medium leading-relaxed tracking-tight text-white md:text-[0.98rem] md:leading-relaxed [&>span]:block">
              <span className="text-white/93">
                The #1 pioneer Gen-Z Launchpad connecting the premiere campus ecosystem of retail,
                marketing, and professional growth.
              </span>
              <span className="mt-3 block font-semibold leading-relaxed text-white md:mt-3.5">
                Your impact starts here.
              </span>
            </p>
          </motion.div>

          <motion.div
            className="mt-6 flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start md:mt-8"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: sequence[4] }}
          >
            <a
              href="#get-started"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-border bg-brand-primary px-8 py-4 text-center font-mono text-xs font-black uppercase tracking-[0.2em] text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] dark:border-white/10 sm:text-sm sm:tracking-[0.18em]"
            >
              Start your hustle
            </a>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border-2 border-border bg-muted/50 px-8 py-4 text-center font-mono text-xs font-black uppercase tracking-[0.18em] text-foreground transition-all hover:border-primary/40 dark:border-white/10 dark:bg-white/5 sm:text-sm"
            >
              How it works
            </a>
          </motion.div>
        </div>

        <div className="relative min-h-[300px] md:min-h-0">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="feed-image-scrim pointer-events-none absolute inset-0" aria-hidden />
          </div>
          <div className="absolute bottom-6 left-6 max-w-[240px] rounded-2xl border-2 border-border bg-card/95 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/90 md:bottom-10 md:left-10">
            <div className="mb-2 flex items-center gap-2 text-brand-primary">
              <Sparkles className="h-4 w-4" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Live in app
              </span>
            </div>
            <p className="font-display text-2xl tracking-tight text-foreground"></p>
            <p className="font-mono text-xs leading-relaxed text-muted-foreground">
              Active missions &amp; payouts moving through Axelerate
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
