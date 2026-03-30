"use client";

import { motion } from "framer-motion";
import TextType from "@/components/TextType";
import GradientText from "@/components/ui/gradient-text";
import {
  BackgroundEffect,
  GRAINIENT_STUDIO_COLORS,
} from "@/components/ui/background-effect";

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
          className="flex flex-1 flex-col items-center justify-center py-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          <div className="flex max-w-full flex-col items-center justify-center px-6 text-center text-white pointer-events-none z-10 md:mt-[-5vh]">
            <div className="mb-4">
              <GradientText
                colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
                animationSpeed={8}
                showBorder={false}
                className="rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none text-xl font-black tracking-[0.4em] md:text-2xl"
              >
                AXELERATE
              </GradientText>
            </div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-white/70 md:text-sm">
              CONNECTING CAMPUS CREATORS WITH TOP BRANDS
            </p>

            <h1 className="mb-8 text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white drop-shadow-2xl md:text-7xl lg:text-[6.5rem]">
              TURN YOUR INFLUENCE
              <br />
              INTO CASH &amp; PERKS.
            </h1>

            <p className="mx-auto mb-10 max-w-2xl font-sans text-base font-medium leading-relaxed text-white/90 md:text-lg">
              The pioneer campus platform empowering creators to grow with top brands, experience
              exclusive drops, and earn.
            </p>

            <div className="mt-10 flex items-center justify-center gap-2 font-mono text-xl text-white/80 md:text-2xl">
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

        <div className="pointer-events-none shrink-0 px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs font-mono tracking-[0.3em] text-white/50 animate-pulse md:text-sm">
          TAP ANYWHERE TO CONTINUE
        </div>
      </div>
    </motion.div>
  );
}
