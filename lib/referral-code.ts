/**
 * Referral Code 动态生成算法
 * 公式: [名字前缀]_[学校简称]_[注册年月]
 * 示例: Mark, UCLA, 2026-03 → MARKUCLA0326
 */

export function generateReferralCode(
  fullName: string | null,
  campus: string | null,
  createdAt: string | Date | null
): string {
  const namePrefix = (fullName ?? "")
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8) || "USER";

  const schoolAbbrev = (campus ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "AXEL";

  const date = createdAt ? new Date(createdAt) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${namePrefix}${schoolAbbrev}${month}${year}`;
}
