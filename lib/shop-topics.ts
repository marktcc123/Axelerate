import { cn } from "@/lib/utils";

/** 顶栏「All」专题 */
export const SHOP_TOPIC_ALL = "all";

/** 将 DB 中的 slug 转为展示用标题，如 k-beauty → K-Beauty */
export function humanizeShopTopicSlug(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function hashSlugToBucket(slug: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h % buckets;
}

const TAB_BASE =
  "flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 outline-none";

const TOPIC_IDLE = cn(
  TAB_BASE,
  "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted dark:bg-white/5"
);

/** 渐变 + 文本色 + 边框（选中态除钢印外的主体） */
type TopicPalette = {
  border: string;
  gradient: string;
  text: string;
  /** 与语义绑定的额外光效（如美妆柔光） */
  semanticExtra?: string;
};

const BRUTAL_STAMP = "shadow-[4px_4px_0_rgb(0_0_0)]";

/**
 * 从 slug 各段（提示词）做语义匹配：先匹配更具体的规则。
 * 规则按「整段 haystack + 分词」扫描英文 / 常见场景词。
 */
const SEMANTIC_PALETTE_RULES: {
  test: (haystack: string, tokens: string[]) => boolean;
  palette: TopicPalette;
}[] = [
  {
    test: (h) =>
      /beauty|skincare|makeup|cosmetic|glow|kbeauty|serum|lip|lash/i.test(h),
    palette: {
      border: "border-pink-400",
      gradient: "bg-gradient-to-r from-pink-500 to-fuchsia-600",
      text: "text-white",
      semanticExtra:
        "shadow-[4px_4px_0_rgb(0_0_0),0_0_0_2px_rgba(244,114,182,0.65),0_0_18px_rgba(236,72,153,0.45)]",
    },
  },
  {
    test: (h) => /hip|hop|rap|beat|vinyl|dj|studio|808|trap/i.test(h),
    palette: {
      border: "border-amber-400",
      gradient: "bg-gradient-to-r from-amber-500 to-orange-600",
      text: "text-black",
      semanticExtra: "animate-pulse-glow",
    },
  },
  {
    test: (h) => /street|urban|skate|graffiti|vault|sneaker|concrete/i.test(h),
    palette: {
      border: "border-cyan-400",
      gradient: "bg-gradient-to-r from-sky-600 to-cyan-400",
      text: "text-white",
      semanticExtra: "shadow-[0_0_22px_rgba(34,211,238,0.45)]",
    },
  },
  {
    test: (h) => /campus|study|edu|lab|exam|lecture|essay|club/i.test(h),
    palette: {
      border: "border-emerald-400",
      gradient: "bg-gradient-to-r from-emerald-600 to-teal-500",
      text: "text-white",
    },
  },
  {
    test: (h) =>
      /food|snack|bite|taste|kitchen|boba|coffee|latte|matcha/i.test(h),
    palette: {
      border: "border-orange-400",
      gradient: "bg-gradient-to-r from-orange-500 to-amber-500",
      text: "text-white",
    },
  },
  {
    test: (h) => /sport|fit|gym|run|lift|yoga|game|score/i.test(h),
    palette: {
      border: "border-red-400",
      gradient: "bg-gradient-to-r from-red-600 to-rose-500",
      text: "text-white",
    },
  },
  {
    test: (h) => /tech|code|dev|data|ai|gpu|cloud|startup|saas/i.test(h),
    palette: {
      border: "border-indigo-400",
      gradient: "bg-gradient-to-r from-indigo-600 to-violet-500",
      text: "text-white",
    },
  },
  {
    test: (h) => /art|design|gallery|museum|creative|pixel|studioart/i.test(h),
    palette: {
      border: "border-purple-400",
      gradient: "bg-gradient-to-r from-purple-600 to-pink-500",
      text: "text-white",
    },
  },
  {
    test: (h) => /luxe|gold|vip|prime|elite|crown|royal/i.test(h),
    palette: {
      border: "border-yellow-400",
      gradient: "bg-gradient-to-r from-yellow-500 to-amber-600",
      text: "text-black",
    },
  },
  {
    test: (h) => /summer|beach|sun|palm|tropic|heat/i.test(h),
    palette: {
      border: "border-yellow-300",
      gradient: "bg-gradient-to-r from-amber-400 to-orange-400",
      text: "text-black",
    },
  },
  {
    test: (h) => /winter|snow|frost|arctic|ice|polar/i.test(h),
    palette: {
      border: "border-sky-200",
      gradient: "bg-gradient-to-r from-sky-500 to-cyan-300",
      text: "text-slate-900",
    },
  },
  {
    test: (h) => /ocean|aqua|marine|wave|surf|deep/i.test(h),
    palette: {
      border: "border-blue-400",
      gradient: "bg-gradient-to-r from-blue-700 to-cyan-500",
      text: "text-white",
    },
  },
  {
    test: (h) =>
      /forest|nature|plant|earth|organic|green/i.test(h),
    palette: {
      border: "border-green-500",
      gradient: "bg-gradient-to-r from-green-700 to-lime-500",
      text: "text-white",
    },
  },
  {
    test: (h) =>
      /night|noir|midnight|shadow|darkmode|afterdark/i.test(h),
    palette: {
      border: "border-slate-500",
      gradient: "bg-gradient-to-r from-slate-900 to-purple-950",
      text: "text-white",
      semanticExtra: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
    },
  },
];

/** 无语义命中时：哈希轮换的纯色相 */
const HASH_ONLY_PALETTES: TopicPalette[] = [
  {
    border: "border-violet-400",
    gradient: "bg-gradient-to-r from-violet-600 to-indigo-500",
    text: "text-white",
  },
  {
    border: "border-rose-400",
    gradient: "bg-gradient-to-r from-rose-500 to-orange-500",
    text: "text-white",
  },
  {
    border: "border-blue-400",
    gradient: "bg-gradient-to-r from-blue-600 to-blue-400",
    text: "text-white",
  },
  {
    border: "border-lime-400",
    gradient: "bg-gradient-to-r from-lime-600 to-green-500",
    text: "text-black",
  },
  {
    border: "border-fuchsia-400",
    gradient: "bg-gradient-to-r from-fuchsia-600 to-pink-500",
    text: "text-white",
  },
  {
    border: "border-teal-400",
    gradient: "bg-gradient-to-r from-teal-600 to-cyan-500",
    text: "text-white",
  },
  {
    border: "border-orange-400",
    gradient: "bg-gradient-to-r from-orange-600 to-red-500",
    text: "text-white",
  },
  {
    border: "border-slate-300",
    gradient: "bg-gradient-to-r from-slate-700 to-slate-500",
    text: "text-white",
  },
];

function slugHaystackAndTokens(key: string): { haystack: string; tokens: string[] } {
  const lower = key.trim().toLowerCase();
  const tokens = lower.split(/[-_\s]+/).filter(Boolean);
  const haystack = `${lower} ${tokens.join(" ")}`;
  return { haystack, tokens };
}

function pickSemanticPalette(key: string): TopicPalette | null {
  const { haystack, tokens } = slugHaystackAndTokens(key);
  for (const rule of SEMANTIC_PALETTE_RULES) {
    if (rule.test(haystack, tokens)) return rule.palette;
  }
  return null;
}

/**
 * 附加在配色上的「特效提示词」层：任意 slug 中含这些词会叠效果。
 * （与语义配色独立，可组合。）
 */
function slugExtraEffectClasses(key: string): string {
  const h = key.toLowerCase();
  const bits: string[] = [];

  if (/neon|cyber|holo|laser|matrix|chrome/i.test(h)) {
    bits.push(
      "shadow-[0_0_24px_rgba(168,85,247,0.55),0_0_40px_rgba(59,130,246,0.25)]"
    );
  }
  if (/pulse|heartbeat|beat|thump|bpm/i.test(h)) {
    bits.push("animate-pulse-glow");
  }
  if (/shimmer|sparkle|glitter/i.test(h)) {
    bits.push("brightness-110 saturate-150");
  }
  if (/chill|soft|mist|airy|cloud/i.test(h)) {
    bits.push("opacity-95");
  }
  if (/retro|vhs|tape|80s|90s/i.test(h)) {
    bits.push("contrast-110 hue-rotate-15");
  }

  return bits.length ? cn(...bits) : "";
}

function paletteToActiveClasses(p: TopicPalette): string {
  if (p.semanticExtra?.includes("shadow-[4px_4px_0")) {
    return cn(TAB_BASE, p.border, p.gradient, p.text, p.semanticExtra);
  }
  return cn(TAB_BASE, p.border, p.gradient, p.text, BRUTAL_STAMP, p.semanticExtra);
}

function inferActiveStyleFromSlug(key: string): string {
  const semantic = pickSemanticPalette(key);
  let base: string;
  if (semantic) {
    base = paletteToActiveClasses(semantic);
  } else {
    const idx = hashSlugToBucket(key, HASH_ONLY_PALETTES.length);
    const p = HASH_ONLY_PALETTES[idx]!;
    base = cn(
      TAB_BASE,
      p.border,
      p.gradient,
      p.text,
      BRUTAL_STAMP,
      p.semanticExtra
    );
  }
  const extra = slugExtraEffectClasses(key);
  return cn(base, extra);
}

export function shopTopicTabClassNames(slug: string, selected: boolean): string {
  if (slug === SHOP_TOPIC_ALL) {
    return cn(
      TAB_BASE,
      selected
        ? "border-border bg-brand-primary text-white shadow-[4px_4px_0_rgb(0_0_0)]"
        : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10"
    );
  }

  if (!selected) return TOPIC_IDLE;

  return inferActiveStyleFromSlug(slug.trim().toLowerCase());
}
