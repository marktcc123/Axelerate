/**
 * XP 阶梯、晋升进度与 1-5-20 游戏化权重（与 profiles.xp / profiles.tier 对齐）
 */

import type { UserTier } from "./types";
import { TIER_CONFIG, TIER_ORDER, getNextTierXp } from "./types";

/** 微动作 / 轻量 / 标准 任务 XP 投放（供服务端或未来任务系统引用） */
export const XP_ACTION_WEIGHTS = {
  micro: 1,
  light: 5,
  heavy: 20,
} as const;

/**
 * 在写入新的 XP 总值后，计算应持久化的 `profiles.tier`（只升不降）。
 * - **Guest**：仅凭 XP 不升段（须验证成为 Insider）。
 * - **Insider (student)**：XP ≥ Elite 门槛 → **staff**。
 * - **Elite (staff)**：XP 到 The Plug 门槛也**不**自动升 **city_manager**（须 Admin）。
 * - **The Plug (city_manager)**：XP ≥ Syndicate 门槛 → **partner**。
 */
export function promoteTierForXp(currentTier: UserTier, xp: number): UserTier {
  if (currentTier === "partner") return "partner";
  if (currentTier === "guest") return "guest";

  if (currentTier === "student") {
    return xp >= TIER_CONFIG.staff.minXp ? "staff" : "student";
  }

  if (currentTier === "staff") {
    return "staff";
  }

  if (currentTier === "city_manager") {
    return xp >= TIER_CONFIG.partner.minXp ? "partner" : "city_manager";
  }

  return currentTier;
}

export type TierProgressResult = {
  /** 当前段位到下一 XP 门槛的进度 0–100 */
  progressPercent: number;
  currentXp: number;
  currentTier: UserTier;
  /** 下一档 XP 阈值（达到后由业务/Admin 处理段位，尤其是 The Plug） */
  nextThresholdXp: number | null;
  /** 进度条语义上的「下一档」展示名 */
  nextTierLabel: string | null;
  nextTierKey: UserTier | null;
  /** 距离下一阈值还差多少 XP */
  xpRemaining: number;
  /** XP ≥ 5000 且仍为 Elite(staff)：不自动升为 The Plug，需 Admin */
  plugPromotionPending: boolean;
  /** 副文案 */
  caption: string;
};

/**
 * 根据当前 XP + 数据库段位计算进度条与文案。
 * The Plug：仅当 Admin 将 tier 升为 city_manager 后才视为已晋升；XP 到 5000 不自动升级。
 */
export function calculateNextTier(
  currentXp: number,
  currentTier: UserTier
): TierProgressResult {
  const tier = currentTier;

  if (tier === "partner") {
    return {
      progressPercent: 100,
      currentXp,
      currentTier: tier,
      nextThresholdXp: null,
      nextTierLabel: null,
      nextTierKey: null,
      xpRemaining: 0,
      plugPromotionPending: false,
      caption: "Syndicate tier — you’re at the top of the club.",
    };
  }

  const plugThreshold = TIER_CONFIG.city_manager.minXp;

  if (tier === "staff" && currentXp >= plugThreshold) {
    return {
      progressPercent: 100,
      currentXp,
      currentTier: tier,
      nextThresholdXp: plugThreshold,
      nextTierLabel: TIER_CONFIG.city_manager.label,
      nextTierKey: "city_manager",
      xpRemaining: 0,
      plugPromotionPending: true,
      caption:
        "You’ve hit the XP bar for The Plug. Nominated — waiting on Admin to unlock your rank.",
    };
  }

  const nextThreshold = getNextTierXp(tier);
  const floor = TIER_CONFIG[tier].minXp;
  const span = Math.max(1, nextThreshold - floor);
  const clampedXp = Math.max(floor, currentXp);
  const progressPercent = Math.min(
    100,
    Math.round(((clampedXp - floor) / span) * 100)
  );
  const xpRemaining = Math.max(0, nextThreshold - currentXp);

  let nextTierKey: UserTier = tier;
  for (const k of TIER_ORDER) {
    if (TIER_CONFIG[k].minXp === nextThreshold) {
      nextTierKey = k;
      break;
    }
  }

  const nextTierLabel = TIER_CONFIG[nextTierKey].label;

  let caption = `${xpRemaining.toLocaleString()} XP to ${nextTierLabel}.`;
  if (tier === "guest") {
    caption = `${xpRemaining.toLocaleString()} XP toward ${nextTierLabel} — verify to roll as Insider first.`;
  }

  return {
    progressPercent,
    currentXp,
    currentTier: tier,
    nextThresholdXp: nextThreshold,
    nextTierLabel,
    nextTierKey,
    xpRemaining,
    plugPromotionPending: false,
    caption,
  };
}
