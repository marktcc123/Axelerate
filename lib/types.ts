/**
 * Axelerate 平台 - 严谨类型系统
 * 基于 Supabase Schema，严格分离 Public / Private 数据
 */

// =============================================================================
// ENUMS (与 DB Schema 对齐)
// =============================================================================

export type UserTier = "guest" | "student" | "staff" | "city_manager" | "partner";
export type GigType = "o2o_delivery" | "ugc_post" | "offline_event";
export type GigStatus = "active" | "closed";
export type UserGigStatus = "pending" | "approved" | "submitted" | "rejected" | "completed" | "paid";
export type TransactionType =
  | "gig_reward"
  | "withdrawal"
  | "purchase"
  | "referral_bonus"
  | "wallet_deposit";
export type TransactionStatus = "pending" | "cleared" | "failed";

// =============================================================================
// PUBLIC TYPES (游客可见)
// =============================================================================

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  is_featured: boolean;
  description?: string | null;
  category?: string | null;
  /** 与 Shopify Product.vendor 对齐，用于 Webhook 幂等匹配 */
  shopify_vendor?: string | null;
  /** Admin: show brand internship proof card in Axelerate Career when user qualifies */
  career_internship_proof_enabled?: boolean;
  /** Admin: show brand referral lane in Axelerate Career when user qualifies */
  career_referral_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  brand_id: string;
  /** Shopify Admin 数字 ID，Webhook 同步时写入 */
  shopify_product_id?: number | null;
  /** in_app | dropshipping 等 */
  fulfillment_type?: string | null;
  /** 上架状态：active | draft 等 */
  status?: string | null;
  /** Feed 首页 TRENDING：有任意 true 时仅展示精选；全 false 时按创建时间取前 12 */
  is_featured?: boolean;
  title: string;
  description: string | null;
  price_credits: number;
  stock_count: number;
  image_url: string | null;
  original_price: number | null;
  discount_price: number | null;
  drop_time: string | null;
  category?: string | null;
  is_drop?: boolean;
  /** Supabase: show in Perks Shop Friday Night Drop banner (carousel); countdown uses this row's drop_time */
  show_in_friday_night_drop?: boolean;
  min_tier_required: UserTier;
  max_per_user: number | null;
  /** 关键功能点 (Bullet Points) */
  features?: string[] | null;
  /** 技术规格 (JSON，含 `shopify_variants` / `shopify_options` 等) */
  specifications?: Record<string, unknown> | null;
  /** A+ 图文详情 HTML */
  long_description_html?: string | null;
  /** 多角度图片 URL 数组 */
  images?: string[] | null;
  /** 品牌店铺链接 */
  brand_link_url?: string | null;
  created_at?: string;
  updated_at?: string;
  brand?: Brand;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at?: string;
  /** 快照：Mark@UCLA，避免 profiles RLS 导致读不到他人 campus */
  reviewer_badge?: string | null;
  profile?: { full_name: string | null; avatar_url: string | null; campus?: string | null };
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  gallery_url?: string | null;
  location?: string | null;
  event_date?: string | null;
  min_tier_required?: UserTier;
  /** 兼容部分 DB 使用 min_tier 列名 */
  min_tier?: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Gig {
  id: string;
  brand_id: string;
  title: string;
  type: GigType;
  reward_cash: number;
  reward_credits: number;
  /** XP 经验值奖励 (游戏化) */
  xp_reward?: number;
  spots_total: number;
  spots_left: number;
  status: GigStatus;
  description?: string | null;
  deadline?: string | null;
  location?: string | null;
  date?: string | null;
  gallery_url?: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  brand?: Brand;
}

// =============================================================================
// PRIVATE TYPES (登录用户可见)
// =============================================================================

/** 10 个验证步骤 (HFC 风格) */
export interface VerificationSteps {
  has_avatar: boolean;
  has_resume: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  added_school: boolean;
  added_skills: boolean;
  added_interests: boolean;
  added_portfolio: boolean;
  followed_brands: boolean;
  answered_questions: boolean;
}

export const DEFAULT_VERIFICATION_STEPS: VerificationSteps = {
  has_avatar: false,
  has_resume: false,
  phone_verified: false,
  email_verified: false,
  added_school: false,
  added_skills: false,
  added_interests: false,
  added_portfolio: false,
  followed_brands: false,
  answered_questions: false,
};

export const VERIFICATION_STEP_KEYS: (keyof VerificationSteps)[] = [
  "has_avatar",
  "has_resume",
  "phone_verified",
  "email_verified",
  "added_school",
  "added_skills",
  "added_interests",
  "added_portfolio",
  "followed_brands",
  "answered_questions",
];

export const VERIFICATION_STEP_LABELS: Record<keyof VerificationSteps, string> = {
  has_avatar: "Add a profile picture",
  has_resume: "Upload your resume",
  phone_verified: "Verify your phone number",
  email_verified: "Verify your email",
  added_school: "Add your school and graduation year",
  added_skills: "Add 3 skills to your profile",
  added_interests: "Add 3 Interests to your profile",
  added_portfolio: "Add a portfolio item",
  followed_brands: "Follow 5 brands",
  answered_questions: "Answer 3 interview questions",
};

/** profiles.shipping_address JSON（与设置页字段一致） */
export interface ShippingAddressJson {
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
}

/**
 * 游戏化快照：与 `profiles.xp` / `profiles.tier` 一致（Supabase Auth 的 `User` 不含这两项，请用 Profile）。
 */
export interface UserGameStats {
  xp: number;
  /** 与 DB `user_tier` 枚举一致的 key */
  tier: UserTier;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  campus: string | null;
  campus_theme?: string | null;
  app_theme?: string | null;
  cash_balance: number;
  credit_balance: number;
  is_runner: boolean;
  tiktok_handle: string | null;
  ig_handle: string | null;
  xp: number;
  tier: UserTier;
  referral_code: string | null;
  /** Set once: referrer profile id after redeeming a friend’s code (signup bonus). */
  referred_by?: string | null;
  is_w9_verified?: boolean;
  /** Storage 路径，如 `{userId}/w9.pdf` */
  w9_document_path?: string | null;
  w9_submitted_at?: string | null;
  annual_payout_total?: number;
  verification_steps?: VerificationSteps | null;
  graduation_year?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  resume_url?: string | null;
  portfolio_url?: string | null;
  /** verification: phone_verified */
  phone?: string | null;
  /** verification: followed_brands (comma-separated list) */
  followed_brands_list?: string | null;
  /** verification: answered_questions */
  interview_answers?: string | null;
  /** Public LinkedIn profile URL (career drawer share / open) */
  linkedin_url?: string | null;
  /** 收货地址 JSON */
  shipping_address?: ShippingAddressJson | Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserGig {
  id: string;
  user_id: string;
  gig_id: string;
  status: UserGigStatus;
  progress_percent: number;
  applied_at: string;
  ugc_link?: string | null;
  platform?: string | null;
  notes?: string | null;
  updated_at?: string;
  gig?: Gig & { brand?: Brand };
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  clears_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/** 订单 items JSON 结构 */
export interface OrderItemRaw {
  id: string;
  quantity: number;
  /** 例如 dropshipping 行：与 Shopify 变体 GID 对齐 */
  orderType?: string;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount?: number;
  /** 实付美金，新订单使用此字段 */
  cash_paid?: number;
  credits_used?: number;
  items: OrderItemRaw[];
  status: string;
  tracking_number?: string | null;
  /** 用户取消原因 */
  cancel_reason?: string | null;
  /** 取消申请：none | pending | approved | rejected */
  cancel_request_status?: string | null;
  cancel_request_reason?: string | null;
  /** Admin 拒绝取消/退货时给用户的说明 */
  admin_rejection_message?: string | null;
  /** 售后：none | requested | approved | rejected 等，以 DB 约定为准 */
  return_status?: string | null;
  return_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

// =============================================================================
// UI 辅助：Gig 展示用 (含 brand 名称)
// =============================================================================

export type GigDisplayType = "digital" | "physical";

/** 将 DB gig.type 映射为 UI 展示类型 */
export function gigTypeToDisplay(type: GigType): GigDisplayType {
  return type === "ugc_post" ? "digital" : "physical";
}

/** 格式化 Gig 报酬展示 */
export function formatGigPay(gig: Gig): string {
  if (gig.reward_cash > 0 && gig.reward_credits > 0) {
    return `$${gig.reward_cash} + ${gig.reward_credits} pts`;
  }
  if (gig.reward_cash > 0) return `$${gig.reward_cash}`;
  if (gig.reward_credits > 0) return `${gig.reward_credits} pts`;
  return "—";
}

/** 获取 Gig 品牌名称 */
export function getGigBrandName(gig: Gig & { brand?: Brand }): string {
  return gig.brand?.name ?? "—";
}

// =============================================================================
// TIER 配置 (用于 Badge、解锁逻辑)
// =============================================================================

export const TIER_ORDER: UserTier[] = [
  "guest",
  "student",
  "staff",
  "city_manager",
  "partner",
];

/** 高奢俱乐部风展示：DB key 不变，仅 label / 视觉焕新 */
export const TIER_CONFIG: Record<
  UserTier,
  {
    label: string;
    minXp: number;
    /** 兼容旧组件（渐变等非 Tailwind 场景） */
    color: string;
    /** Neo-brutalism 勋章：粗边框 + 高对比填充 */
    badgeClass: string;
  }
> = {
  guest: {
    label: "Guest",
    minXp: 0,
    color: "hsl(240 4% 46%)",
    badgeClass:
      "bg-zinc-500 text-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,1)]",
  },
  student: {
    label: "Insider",
    minXp: 0,
    color: "hsl(270 91% 65%)",
    badgeClass:
      "bg-brand-primary text-primary-foreground border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,1)]",
  },
  staff: {
    label: "Elite",
    minXp: 1000,
    color: "hsl(152 69% 56%)",
    badgeClass:
      "bg-emerald-400 text-black border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,1)]",
  },
  city_manager: {
    label: "The Plug",
    minXp: 5000,
    color: "hsl(48 96% 53%)",
    badgeClass:
      "bg-yellow-400 text-black border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,1)]",
  },
  partner: {
    label: "Syndicate",
    minXp: 99999,
    color: "hsl(0 84% 60%)",
    badgeClass:
      "bg-red-500 text-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:border-white dark:shadow-[3px_3px_0_0_rgba(255,255,255,1)]",
  },
};

/** 显示名到 UserTier 的映射（兼容 DB 返回的 Member/Elite 等） */
const TIER_LABEL_TO_KEY: Record<string, UserTier> = {
  Member: "student",
  member: "student",
  Insider: "student",
  insider: "student",
  Elite: "staff",
  elite: "staff",
  "City Manager": "city_manager",
  "city manager": "city_manager",
  "The Plug": "city_manager",
  "the plug": "city_manager",
  city_manager: "city_manager",
  Partner: "partner",
  partner: "partner",
  Syndicate: "partner",
  syndicate: "partner",
  Guest: "guest",
  guest: "guest",
  Scout: "student",
  scout: "student",
  Staff: "staff",
  staff: "staff",
};

/** 扩展显示标签（Member, Elite, City Manager, Partner） */
const TIER_DISPLAY_LABELS: Record<string, string> = {
  Member: "Insider",
  member: "Insider",
  Insider: "Insider",
  insider: "Insider",
  Elite: "Elite",
  elite: "Elite",
  "City Manager": "The Plug",
  "city manager": "The Plug",
  "The Plug": "The Plug",
  city_manager: "The Plug",
  Partner: "Syndicate",
  partner: "Syndicate",
  Syndicate: "Syndicate",
  syndicate: "Syndicate",
};

/** 将 DB 返回的 tier 字符串解析为 UserTier */
export function resolveTierKey(rawTier: string | undefined | null): UserTier {
  const key = rawTier && TIER_LABEL_TO_KEY[rawTier];
  if (key && key in TIER_CONFIG) return key as UserTier;
  if (rawTier && rawTier in TIER_CONFIG) return rawTier as UserTier;
  return "guest";
}

/** 安全获取 tier 显示文案，带可选链与默认值 */
export function getTierLabel(rawTier: string | undefined | null): string {
  if (rawTier && rawTier in TIER_DISPLAY_LABELS) {
    return TIER_DISPLAY_LABELS[rawTier];
  }
  const tierKey = resolveTierKey(rawTier);
  const config = TIER_CONFIG[tierKey];
  return config?.label ?? "All Access";
}

export function canAccessTier(userTier: UserTier, requiredTier: UserTier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

/** 活动等级权重：Member=1, Elite=2, City Manager=3, Partner=4。Partner 始终可访问 */
export const EVENT_TIER_WEIGHTS: Record<string, number> = {
  guest: 0,
  student: 1,
  staff: 2,
  city_manager: 3,
  partner: 4,
  Member: 1,
  member: 1,
  Insider: 1,
  insider: 1,
  Elite: 2,
  elite: 2,
  "City Manager": 3,
  "city manager": 3,
  "The Plug": 3,
  Partner: 4,
  Syndicate: 4,
  syndicate: 4,
};

export function canAccessEvent(userTier: UserTier, eventMinTier: string | UserTier | undefined): boolean {
  const resolved = resolveTierKey(eventMinTier);
  const userWeight = EVENT_TIER_WEIGHTS[userTier] ?? 0;
  const requiredWeight = EVENT_TIER_WEIGHTS[resolved] ?? 0;
  if (userTier === "partner") return true;
  return userWeight >= requiredWeight;
}

/**
 * 下一档 XP 门槛（跳过与当前 minXp 相同的相邻档，避免 Guest→Insider 同为 0）。
 */
export function getNextTierXp(tier: UserTier): number {
  const idx = TIER_ORDER.indexOf(tier);
  const currentMin = TIER_CONFIG[tier].minXp;
  for (let i = idx + 1; i < TIER_ORDER.length; i++) {
    const nextMin = TIER_CONFIG[TIER_ORDER[i]].minXp;
    if (nextMin > currentMin) return nextMin;
  }
  return TIER_CONFIG[tier].minXp + 500;
}
