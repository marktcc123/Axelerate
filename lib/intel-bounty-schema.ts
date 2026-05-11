/** Shared option strings for Syndicate Intel Bounty (validated on claim). */
export const INTEL_Q1_MONTHLY_BUDGET = [
  "Under $50",
  "$50-$150",
  "$150-$300",
  "$300+",
] as const;

export const INTEL_Q2_DISCOVERY = [
  "TikTok FYP",
  "Instagram",
  "Campus Word-of-Mouth",
  "YouTube Gurus",
] as const;

export const INTEL_Q3_CHECKOUT_TRIGGER = [
  "Elite Student Discounts",
  "Limited Edition FOMO",
  "Authentic Creator Reviews",
  "God-tier Aesthetics",
] as const;

export const INTEL_Q4_BRAND_RED_FLAG = [
  'Cringe "How do you do fellow kids" ads',
  "Overpriced hype",
  "Fake brand values",
  "Ugly design",
] as const;

export type IntelQ1Value = (typeof INTEL_Q1_MONTHLY_BUDGET)[number];
export type IntelQ2Value = (typeof INTEL_Q2_DISCOVERY)[number];
export type IntelQ3Value = (typeof INTEL_Q3_CHECKOUT_TRIGGER)[number];
export type IntelQ4Value = (typeof INTEL_Q4_BRAND_RED_FLAG)[number];
