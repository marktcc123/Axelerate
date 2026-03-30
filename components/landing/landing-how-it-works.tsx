"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    badge: "Discover",
    badgeClass: "bg-brand-primary/20 text-foreground border border-brand-primary/40",
    title: "Scroll the drop",
    body: "Browse active gigs from top-tier brands—from K-Beauty TikTok hauls to local tech pop-ups. Find the missions that match your vibe.",
  },
  {
    n: "02",
    badge: "Execute",
    badgeClass: "bg-secondary/25 text-foreground border border-border",
    title: "Secure the bag",
    body: "Apply, get approved, and do your thing. Post the content, show up at the event, submit your proof, and watch your status flip from Pending to Paid.",
  },
  {
    n: "03",
    badge: "Collect",
    badgeClass: "bg-muted text-foreground border border-border",
    title: "Cash, credits, XP",
    body: "Get paid in real cash. Stack Credits to redeem exclusive gear in the Perks Shop. Earn XP to climb the ranks and unlock high-paying VIP missions.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b-2 border-border bg-foreground py-20 text-background md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mb-16 max-w-3xl md:mb-20"
        >
          <h2 className="font-display text-5xl uppercase leading-[0.9] tracking-[-0.02em] sm:text-6xl md:text-7xl lg:text-8xl">
            From feed
            <br />
            to payout.
          </h2>
          <p className="mt-7 max-w-xl font-mono text-sm font-medium leading-relaxed tracking-tight text-background/80 md:mt-8 md:text-[0.95rem] md:leading-7">
            No fluff, no complicated point systems. Just a straight line from discovering cool brands to
            securing the bag.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {STEPS.map((s) => (
            <motion.article
              key={s.n}
              variants={item}
              className="relative overflow-hidden rounded-2xl border-2 border-background/25 bg-background/10 p-6 pt-7 backdrop-blur-sm md:p-7"
            >
              <span className="landing-step-number pointer-events-none absolute right-2 top-2 text-background/90">
                {s.n}
              </span>
              <span
                className={`relative z-[1] inline-block rounded-full px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] ${s.badgeClass}`}
              >
                {s.badge}
              </span>
              <h3 className="font-display relative z-[1] mt-6 text-2xl uppercase tracking-tight sm:text-3xl">
                {s.title}
              </h3>
              <p className="relative z-[1] mt-4 font-mono text-sm font-medium leading-relaxed tracking-tight text-background/85">
                {s.body}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
