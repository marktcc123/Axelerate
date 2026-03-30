/**
 * Axelerate - 校园配置适配层
 * 将 DB 的 School 转为前端 SchoolConfig 格式
 */

import type { School } from "@/lib/schools";

export interface SchoolConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  shortName: string;
  slogan: string;
}

const DEFAULT_CONFIG: SchoolConfig = {
  primaryColor: "#EC4899",
  secondaryColor: "#831843",
  logoUrl: "",
  shortName: "Axelerate",
  slogan: "Pioneer Campus Platform",
};

/** 已知学校的 shortName 与 slogan 覆盖 */
const SCHOOL_OVERRIDES: Record<string, { shortName: string; slogan: string }> = {
  "University of Virginia": { shortName: "UVA", slogan: "Wahoowa" },
  UVA: { shortName: "UVA", slogan: "Wahoowa" },
  UCLA: { shortName: "UCLA", slogan: "Bruins" },
};

/** 将 DB School 转为 SchoolConfig，供 Campus Badge、Header 等使用 */
export function schoolToConfig(school: School | null | undefined): SchoolConfig {
  if (!school) return DEFAULT_CONFIG;
  const override = SCHOOL_OVERRIDES[school.name];
  return {
    primaryColor: school.primary_color,
    secondaryColor: school.secondary_color,
    logoUrl: school.logo_url ?? "",
    shortName: override?.shortName ?? school.name,
    slogan: override?.slogan ?? "",
  };
}
