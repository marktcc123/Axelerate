import type { UserGig, UserGigStatus } from "@/lib/types";

/** Gigs finished well enough to count toward career milestones */
export const CAREER_GENERAL_THRESHOLD = 3;
export const CAREER_BRAND_THRESHOLD = 5;

export function isFinishedGigStatus(status: UserGigStatus): boolean {
  return status === "completed" || status === "paid";
}

export function generalCertRewardKey(): string {
  return "general_cert";
}

export function brandCertRewardKey(brandId: string): string {
  return `brand:${brandId.trim().toLowerCase()}:cert`;
}

export function brandReferralRewardKey(brandId: string): string {
  return `brand:${brandId.trim().toLowerCase()}:referral`;
}

export type ParsedCareerRewardKey =
  | { kind: "general_cert" }
  | { kind: "brand"; brandId: string; lane: "cert" | "referral" };

/** Parse `general_cert` or `brand:{uuid}:cert|referral`. */
export function parseCareerRewardKey(key: string): ParsedCareerRewardKey | null {
  const k = key.trim();
  if (k === "general_cert") return { kind: "general_cert" };
  const m =
    /^brand:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(cert|referral)$/i.exec(
      k,
    );
  if (!m) return null;
  return {
    kind: "brand",
    brandId: m[1].toLowerCase(),
    lane: m[2].toLowerCase() === "cert" ? "cert" : "referral",
  };
}

export function isValidCareerRewardKey(key: string): boolean {
  return parseCareerRewardKey(key) !== null;
}

/** Admin-friendly line; uses `brands.name` when present in the map. */
export function careerRewardSummaryLabel(
  rewardKey: string,
  brandNameById: Map<string, string>,
): string {
  const p = parseCareerRewardKey(rewardKey);
  if (!p) return rewardKey.trim();
  if (p.kind === "general_cert") return "Platform — Axelerate internship proof";
  const name =
    brandNameById.get(p.brandId) ?? `Unknown brand (${p.brandId.slice(0, 8)}…)`;
  if (p.lane === "cert") return `${name} — Brand internship certificate`;
  return `${name} — Referral opportunity`;
}

/** Certificate PDF required when admin approves (referral lane is text-only). */
export function careerRewardNeedsCertificatePdf(rewardKey: string): boolean {
  const k = rewardKey.trim();
  if (k === "general_cert") return true;
  return k.endsWith(":cert");
}

export type BrandCareerStat = {
  brandId: string;
  brandName: string;
  count: number;
};

/**
 * Aggregate completed/paid gigs: total count + per-brand counts (needs `gig` embed from Supabase).
 */
export function computeCareerStats(userGigs: UserGig[]): {
  totalCompleted: number;
  brands: BrandCareerStat[];
} {
  const map = new Map<string, { count: number; name: string }>();

  let totalCompleted = 0;
  for (const ug of userGigs) {
    if (!isFinishedGigStatus(ug.status)) continue;
    totalCompleted++;
    const bidRaw = ug.gig?.brand_id;
    if (!bidRaw) continue;
    const bid = bidRaw.toLowerCase();
    const name =
      ug.gig?.brand?.name?.trim() ||
      ug.gig?.title?.trim() ||
      "Partner brand";
    const prev = map.get(bid);
    if (prev) {
      prev.count += 1;
      if (name && name !== "Partner brand") prev.name = name;
    } else {
      map.set(bid, { count: 1, name });
    }
  }

  const brands: BrandCareerStat[] = [...map.entries()]
    .map(([brandId, v]) => ({
      brandId,
      brandName: v.name,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);

  return { totalCompleted, brands };
}
