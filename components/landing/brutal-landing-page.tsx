"use client";

import { motion } from "framer-motion";
import {
  BackgroundEffect,
  GRAINIENT_STUDIO_COLORS,
} from "@/components/ui/background-effect";
import { LandingHero } from "./landing-hero";
import { LandingAppMap } from "./landing-app-map";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingTierShowcase } from "./landing-tier-showcase";
import { LandingFooter } from "./landing-footer";

interface BrutalLandingPageProps {
  onGetStarted?: () => void;
}

export function BrutalLandingPage({ onGetStarted }: BrutalLandingPageProps) {
  return (
    <main className="app-landing relative min-h-screen min-h-dvh overflow-x-hidden overflow-y-auto text-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden"
        aria-hidden
      >
        <div className="h-full min-h-full w-full opacity-[0.38] dark:opacity-[0.48]">
          <BackgroundEffect
            {...GRAINIENT_STUDIO_COLORS}
            timeSpeed={0.25}
            colorBalance={0}
            warpStrength={1}
            warpFrequency={5}
            warpSpeed={2}
            warpAmplitude={50}
            blendAngle={0}
            blendSoftness={0.05}
            rotationAmount={500}
            noiseScale={2}
            grainAmount={0.1}
            grainScale={2}
            grainAnimated={false}
            contrast={1.5}
            gamma={1}
            saturation={1}
            centerX={0}
            centerY={0}
            zoom={0.9}
          />
        </div>
      </div>

      <div className="relative z-10">
        <LandingHero />
        <LandingAppMap />
        <LandingHowItWorks />
        <LandingTierShowcase />

        <section
          id="get-started"
          className="border-b-2 border-border px-6 py-16 md:px-10 md:py-20"
        >
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-display text-4xl uppercase leading-[0.92] tracking-[-0.02em] text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Don&apos;t just scroll.
              <br />
              Monetize.
            </h2>
            <p className="mx-auto mt-6 max-w-lg font-mono text-sm font-medium leading-relaxed tracking-tight text-muted-foreground md:mt-7 md:text-[0.95rem] md:leading-7">
              The brands are waiting. The cash is real. Claim your spot on campus today.
            </p>
            {onGetStarted ? (
              <button
                type="button"
                onClick={onGetStarted}
                className="mt-10 w-full max-w-sm rounded-2xl border-2 border-border bg-brand-primary px-10 py-5 text-center font-mono text-xs font-black uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] dark:border-white/10 sm:text-sm"
              >
                Create your account
              </button>
            ) : (
              <a
                href="/"
                className="mt-10 inline-flex w-full max-w-sm items-center justify-center rounded-2xl border-2 border-border bg-brand-primary px-10 py-5 font-mono text-xs font-black uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] dark:border-white/10 sm:text-sm"
              >
                Create your account
              </a>
            )}
          </motion.div>
        </section>

        <LandingFooter />
      </div>
    </main>
  );
}
