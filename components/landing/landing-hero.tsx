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

      <div className="grid min-h-[min(100dvh,880px)] grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-7 border-b-2 border-border px-6 py-12 md:gap-8 md:border-b-0 md:border-r-2 md:border-border md:px-10 lg:px-14">
          <motion.p
            className="max-w-xl font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.28em] text-muted-foreground sm:text-xs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: sequence[0] }}
          >
            Connecting students with top brands
          </motion.p>

          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: sequence[1] }}
          >
            <h1 className="font-display text-5xl leading-[0.88] tracking-[-0.02em] text-foreground sm:text-6xl md:text-7xl lg:text-8xl xl:text-[5.5rem]">
              <span className="block">Make moves.</span>
              <span className="mt-1 block bg-gradient-to-r from-brand-primary via-purple-500 to-purple-400 bg-clip-text text-transparent sm:mt-1.5">
                Get paid.
              </span>
              <span className="mt-1 block sm:mt-1.5">Unlock perks.</span>
            </h1>
          </motion.div>

          <motion.div
            className="max-w-xl space-y-4"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: sequence[2] }}
          >
            <p className="font-mono text-sm font-medium leading-relaxed tracking-tight text-foreground md:text-[0.95rem] md:leading-7">
              Turn your campus influence into cash. Complete digital UGC drops for top brands, attend to
              exclusive offline pop-ups, and stack XP to level up your lifestyle.
            </p>
            <p className="font-mono text-xs font-medium leading-relaxed tracking-tight text-muted-foreground md:text-sm md:leading-6">
              Earn money, unlocal perks, level up, exclusively for Students.
            </p>
          </motion.div>

          <motion.div
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
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
