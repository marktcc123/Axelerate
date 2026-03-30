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
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  brand_id: string;
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
  min_tier_required: UserTier;
  max_per_user: number | null;
  /** 关键功能点 (Bullet Points) */
  features?: string[] | null;
  /** 技术规格 (JSON) */
  specifications?: Record<string, string> | null;
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

export const TIER_CONFIG: Record<
  UserTier,
  { label: string; minXp: number; color: string }
> = {
  guest: { label: "Guest", minXp: 0, color: "hsl(0 0% 60%)" },
  student: { label: "Scout", minXp: 0, color: "hsl(330 81% 60%)" },
  staff: { label: "Staff", minXp: 200, color: "hsl(270 70% 60%)" },
  city_manager: {
    label: "City Manager",
    minXp: 2000,
    color: "hsl(0 0% 96%)",
  },
  partner: { label: "Partner", minXp: 500, color: "hsl(270 91% 65%)" },
};

/** 显示名到 UserTier 的映射（兼容 DB 返回的 Member/Elite 等） */
const TIER_LABEL_TO_KEY: Record<string, UserTier> = {
  Member: "student",
  member: "student",
  Elite: "staff",
  elite: "staff",
  "City Manager": "city_manager",
  "city manager": "city_manager",
  city_manager: "city_manager",
  Partner: "partner",
  partner: "partner",
  Guest: "guest",
  guest: "guest",
  Scout: "student",
  scout: "student",
  Staff: "staff",
  staff: "staff",
};

/** 扩展显示标签（Member, Elite, City Manager, Partner） */
const TIER_DISPLAY_LABELS: Record<string, string> = {
  Member: "Member",
  member: "Member",
  Elite: "Elite",
  elite: "Elite",
  "City Manager": "City Manager",
  "city manager": "City Manager",
  city_manager: "City Manager",
  Partner: "Partner",
  partner: "Partner",
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
  Elite: 2,
  elite: 2,
  "City Manager": 3,
  "city manager": 3,
  Partner: 4,
};

export function canAccessEvent(userTier: UserTier, eventMinTier: string | UserTier | undefined): boolean {
  const resolved = resolveTierKey(eventMinTier);
  const userWeight = EVENT_TIER_WEIGHTS[userTier] ?? 0;
  const requiredWeight = EVENT_TIER_WEIGHTS[resolved] ?? 0;
  if (userTier === "partner") return true;
  return userWeight >= requiredWeight;
}

/** 获取下一级所需 XP */
export function getNextTierXp(tier: UserTier): number {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx >= TIER_ORDER.length - 1) return TIER_CONFIG[tier].minXp + 500;
  return TIER_CONFIG[TIER_ORDER[idx + 1]].minXp;
}
