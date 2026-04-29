"use client";

import { motion } from "framer-motion";
import TextType from "@/components/TextType";
import GradientText from "@/components/ui/gradient-text";
import {
  BackgroundEffect,
  GRAINIENT_STUDIO_COLORS,
} from "@/components/ui/background-effect";

/** Neo-brutalist 钢印：Splash 全屏居中；手机端 clamp 下限抬高 */
const HERO_TITLE_LINE =
  "w-full text-center text-[clamp(2.875rem,12vw,7.75rem)] font-black uppercase leading-[0.87] tracking-[-0.04em] text-white [text-shadow:4px_4px_0_rgb(0_0_0)] sm:leading-[0.9]";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div
      className="app-landing fixed inset-0 isolate z-50 flex cursor-pointer flex-col overflow-y-auto overscroll-y-contain bg-black text-white [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={onComplete}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <div className="h-full min-h-full w-full opacity-[0.42] dark:opacity-[0.55]">
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

      <div
        className="pointer-events-none fixed inset-4 z-10 rounded-3xl border-2 border-white/15 shadow-sm"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[100dvh] w-full flex-1 flex-col">
        <motion.div
          className="flex flex-1 flex-col justify-center px-5 py-5 md:px-8 md:py-7"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          <div className="pointer-events-none z-10 flex w-full max-w-none flex-col items-center text-center text-white md:-mt-[2vh]">
            <div className="mb-2.5 flex justify-center md:mb-3">
              <GradientText
                colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
                animationSpeed={8}
                showBorder={false}
                className="rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none text-lg font-black tracking-[0.38em] md:text-2xl md:tracking-[0.4em]"
              >
                AXELERATE
              </GradientText>
            </div>
            <div className="-mx-1 mb-6 flex w-full max-w-[100vw] justify-center overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <p className="inline-block min-w-max max-w-none text-center font-mono text-[0.6875rem] font-bold uppercase leading-none tracking-[0.08em] text-purple-100/95 drop-shadow-[0_2px_14px_rgb(0_0_0/0.75)] sm:text-xs sm:tracking-[0.14em] md:text-sm md:tracking-[0.2em]">
                YOUR BACKSTAGE PASS TO GLOBAL BRANDS &amp; EXCLUSIVE PERKS
              </p>
            </div>

            <h1 className="flex w-full max-w-none flex-col items-center px-0">
              <div className={HERO_TITLE_LINE}>COP DROPS.</div>
              <div className={HERO_TITLE_LINE}>CREATE IMPACT.</div>
              <div className={HERO_TITLE_LINE}>CASH OUT.</div>
            </h1>

            <p className="mx-auto mb-5 mt-8 max-w-2xl text-center font-sans text-[0.875rem] font-medium leading-relaxed tracking-tight text-white/[0.93] md:mb-6 md:text-base [&>span]:block [&>span:not(:first-child)]:mt-3">
              <span>
                The #1 pioneer Gen-Z Launchpad connecting the premiere campus ecosystem of retail,
                marketing, and professional growth.
              </span>
              <span className="font-semibold text-white">Your impact starts here.</span>
            </p>

            <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-2 font-mono text-base text-white/80 md:mt-6 md:text-2xl">
              <span className="font-bold tracking-wide text-white">AXELERATE your </span>
              <TextType
                as="span"
                text=""
                texts={[ "Network.", "Leadership.", "Influence.", "Resume.", "Growth.", "Success.", "Happiness.", "Creativity.", "Impact.", "Career.", "Future.", "Experience.", "Cash flow.", "Hustle."] }
                typingSpeed={75}
                pauseDuration={2000}
                deletingSpeed={50}
                showCursor
                cursorCharacter="_"
                cursorBlinkDuration={0.5}
                initialDelay={500}
                className="inline-flex items-baseline text-[var(--primary)] font-bold drop-shadow-lg"
                contentClassName="text-[var(--primary)] font-bold drop-shadow-lg"
                cursorClassName="text-[var(--primary)]/60"
              />
            </div>
          </div>
        </motion.div>

        <div className="pointer-events-none flex w-full shrink-0 flex-col items-center px-6 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8">
          <motion.span
            className="mb-2 block select-none font-mono text-lg leading-none text-white/65 md:text-xl"
            aria-hidden
            animate={{ y: [0, 5, 0] }}
            transition={{
              repeat: Infinity,
              duration: 2.8,
              ease: "easeInOut",
            }}
          >
            ↓
          </motion.span>
          <motion.p
            className="text-center font-mono text-[11px] tracking-[0.28em] text-white md:text-sm"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{
              repeat: Infinity,
              duration: 5.5,
              ease: "easeInOut",
            }}
          >
            TAP ANYWHERE TO CONTINUE
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
