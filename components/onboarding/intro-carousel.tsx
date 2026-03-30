"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Briefcase, Ticket, ChevronRight } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const springSnappy = { type: "spring" as const, stiffness: 400, damping: 30 };

const SLIDES = [
  {
    id: 0,
    title: "COP EXCLUSIVE DROPS",
    description: "Access viral K-Beauty, tech, and streetwear at the absolute lowest prices on the internet. Verified students only.",
    icon: ShoppingBag,
  },
  {
    id: 1,
    title: "BUILD BRANDS. GET PAID.",
    description: "Complete paid UGC missions for top global brands. Build a killer resume with real marketing experience and cash out instantly.",
    icon: Briefcase,
  },
  {
    id: 2,
    title: "VIP EVENT ACCESS",
    description: "Score exclusive invites to offline pop-ups, VIP parties, and brand launches in your city. Step into the inner circle.",
    icon: Ticket,
  },
];

interface IntroCarouselProps {
  onGetStarted: () => void;
}

export function IntroCarousel({ onGetStarted }: IntroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [exiting, setExiting] = useState(false);
  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  const handleGetStarted = () => {
    setExiting(true);
    setTimeout(onGetStarted, 600);
  };

  const handleNext = () => {
    if (currentSlide >= SLIDES.length - 1) {
      handleGetStarted();
      return;
    }
    setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
  };

  if (!slide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-pulse rounded-full bg-brand-primary/20" />
      </div>
    );
  }

  return (
    <motion.div
      className="flex min-h-dvh flex-col bg-transparent"
      initial={false}
      animate={exiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Slide content — 文案与 SLIDES 数据保持不变；样式适配渐变背景 */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 40 }}
            animate={exiting ? { opacity: 0, scale: 0.9, y: -60 } : { opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -80, x: "-50%" }}
            transition={spring}
            className="flex w-full max-w-sm flex-col items-center text-center"
          >
            {/* Icon with pink glow */}
            <motion.div
              className="mb-8 flex h-32 w-32 items-center justify-center rounded-3xl border-2 border-white/20 bg-white/10 shadow-md backdrop-blur-md dark:border-brand-primary/30 dark:bg-brand-primary/10"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: [
                  "0 0 40px rgba(var(--theme-primary-rgb),0.3)",
                  "0 0 56px rgba(var(--theme-primary-rgb),0.5)",
                  "0 0 40px rgba(var(--theme-primary-rgb),0.3)",
                ],
              }}
              transition={{
                scale: { type: "spring", stiffness: 200, damping: 20, delay: 0.1 },
                opacity: { duration: 0.4, delay: 0.1 },
                boxShadow: { duration: 2.5, repeat: Infinity, repeatType: "reverse" },
              }}
            >
              <slide.icon className="h-14 w-14 text-brand-primary drop-shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.6)]" strokeWidth={1.5} />
            </motion.div>

            <h2 className="mb-4 text-balance text-3xl font-extrabold uppercase tracking-tighter text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-4xl">
              {slide.title}
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: fixed action area - dots + CTA */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 pb-[max(3rem,env(safe-area-inset-bottom))]">
        {/* Progress dots */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className="h-2 rounded-full transition-colors hover:opacity-80"
              aria-label={`Go to slide ${i + 1}`}
            >
              <motion.div
                className="h-2 rounded-full"
                animate={{
                  width: i === currentSlide ? 24 : 8,
                  backgroundColor: i === currentSlide ? "rgba(var(--theme-primary-rgb),1)" : "rgba(255,255,255,0.35)",
                  boxShadow: i === currentSlide ? "0 0 12px rgba(var(--theme-primary-rgb),0.5)" : "none",
                }}
                transition={springSnappy}
              />
            </button>
          ))}
        </div>

        {/* CTA: Next (slides 0-1) or Get Started (slide 2) */}
        <div className="flex w-full max-w-sm justify-center">
          <AnimatePresence mode="wait">
            {!isLast ? (
              <motion.button
                key="next"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={spring}
                onClick={handleNext}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-white/40 bg-white/10 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-sm transition-all hover:border-brand-primary hover:bg-brand-primary/20 hover:text-white hover:shadow-[0_0_32px_rgba(var(--theme-primary-rgb),0.35)] active:scale-[0.98]"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            ) : (
              <motion.button
                key="getstarted"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={spring}
                onClick={handleGetStarted}
                className="btn-primary-glow flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-brand-primary py-5 font-mono text-lg font-bold uppercase tracking-wider text-white shadow-[0_0_40px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(var(--theme-primary-rgb),0.5)] active:scale-[0.98]"
              >
                Get Started
                <ChevronRight className="h-6 w-6" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
