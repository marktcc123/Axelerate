"use client";

import { motion } from "framer-motion";
import { Home, Briefcase, ShoppingBag, UserRound } from "lucide-react";

const TABS = [
  {
    icon: Home,
    tabLabel: "Feed",
    title: "The drop",
    body: "Discover Axelerating Brands. Tap into active gigs, scroll the Trending Rewards, and secure your spot at Exclusive Events.",
  },
  {
    icon: Briefcase,
    tabLabel: "My gigs",
    title: "The hustle",
    body: "Your personal command center. Track every application and submission. See exactly when your money is hitting your wallet.",
  },
  {
    icon: ShoppingBag,
    tabLabel: "Perks shop",
    title: "The vault",
    body: "Cash in your Credits. Cop exclusive Friday Night Drops, limited-edition SKUs, and brand gear you actually want. Earn it. Flex it.",
  },
  {
    icon: UserRound,
    tabLabel: "Profile",
    title: "Your rep",
    body: "Track your balance, manage your payouts, and watch your rank soar as you stack XP to the next tier.",
  },
];

const item = {
  hidden: { opacity: 0, y: 22 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.45 },
  }),
};

export function LandingAppMap() {
  return (
    <section
      id="app-map"
      className="border-b-2 border-border bg-muted/30 py-16 dark:bg-white/[0.03] md:py-24"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45 }}
          className="mb-14 max-w-3xl md:mb-16"
        >
          <h2 className="font-display text-4xl uppercase leading-[0.92] tracking-[-0.02em] text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Your creator arsenal.
          </h2>
          <p className="mt-6 max-w-2xl font-mono text-sm font-medium leading-relaxed tracking-tight text-muted-foreground md:mt-7 md:text-[0.95rem] md:leading-7">
            Everything you need to manage your brand collabs, track your cash, and claim your rewards.
            All in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <motion.article
                key={tab.title}
                custom={i}
                variants={item}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                className="rounded-2xl border-2 border-border bg-card p-5 pt-6 shadow-sm transition-colors hover:border-primary/35 dark:border-white/10 dark:bg-zinc-900/80 md:p-6"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-brand-primary/10 text-brand-primary dark:border-white/10">
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {tab.tabLabel}
                </p>
                <h3 className="font-display mt-2 text-xl uppercase tracking-tight text-foreground sm:text-2xl">
                  {tab.title}
                </h3>
                <p className="mt-3 font-mono text-xs font-medium leading-relaxed tracking-tight text-muted-foreground sm:text-[0.8125rem] sm:leading-5">
                  {tab.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
