/**
 * 学校天际线配置 - Tokyo Explore the City 风格
 * clip-path 建筑剪影 + 霓虹顶线
 */

export const FAR_CLIPS: Record<string, string> = {
  flat: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
  classic:
    "polygon(0% 100%, 100% 100%, 100% 20%, 84% 20%, 84% 0%, 16% 0%, 16% 20%, 0% 20%)",
  spire: "polygon(0% 100%, 100% 100%, 100% 28%, 56% 0%, 44% 0%, 0% 28%)",
  tiered:
    "polygon(0% 100%, 100% 100%, 100% 55%, 76% 55%, 76% 30%, 54% 30%, 54% 0%, 46% 0%, 46% 30%, 24% 30%, 24% 55%, 0% 55%)",
  crown:
    "polygon(0% 100%, 100% 100%, 100% 16%, 80% 16%, 80% 5%, 62% 5%, 62% 16%, 38% 16%, 38% 5%, 20% 5%, 20% 16%, 0% 16%)",
  stepped: "polygon(0% 100%, 100% 100%, 100% 40%, 66% 40%, 66% 0%, 0% 0%)",
  wedge: "polygon(0% 100%, 100% 100%, 100% 6%, 0% 42%)",
  dome: "polygon(0% 100%, 100% 100%, 100% 22%, 80% 10%, 60% 2%, 50% 0%, 40% 2%, 20% 10%, 0% 22%)",
  antenna:
    "polygon(0% 100%, 100% 100%, 100% 12%, 53% 12%, 53% 0%, 47% 0%, 47% 12%, 0% 12%)",
};

export type SkylineShape = keyof typeof FAR_CLIPS;

export interface SkylineBuilding {
  shape: SkylineShape;
  h: number;
  w: number;
  hasNeon?: boolean;
  winCount?: number;
}

export interface SchoolSkylineConfig {
  buildings: SkylineBuilding[];
  neonColor: string;
}

const DEFAULT_BUILDINGS: SkylineBuilding[] = [
  { shape: "classic", h: 55, w: 22, hasNeon: true, winCount: 4 },
  { shape: "spire", h: 70, w: 18, hasNeon: true, winCount: 3 },
  { shape: "tiered", h: 62, w: 26, hasNeon: false, winCount: 5 },
  { shape: "dome", h: 75, w: 30, hasNeon: true, winCount: 2 },
  { shape: "antenna", h: 72, w: 18, hasNeon: true, winCount: 4 },
  { shape: "classic", h: 50, w: 22, hasNeon: false, winCount: 3 },
  { shape: "stepped", h: 58, w: 24, hasNeon: true, winCount: 4 },
  { shape: "spire", h: 68, w: 16, hasNeon: true, winCount: 2 },
  { shape: "flat", h: 45, w: 28, hasNeon: false, winCount: 6 },
];

/** UVA: Rotunda (dome) 为地标 */
const UVA_BUILDINGS: SkylineBuilding[] = [
  { shape: "classic", h: 50, w: 20, hasNeon: false, winCount: 3 },
  { shape: "spire", h: 62, w: 16, hasNeon: true, winCount: 2 },
  { shape: "dome", h: 85, w: 34, hasNeon: true, winCount: 1 },
  { shape: "tiered", h: 55, w: 24, hasNeon: false, winCount: 4 },
  { shape: "classic", h: 58, w: 22, hasNeon: true, winCount: 4 },
  { shape: "antenna", h: 68, w: 18, hasNeon: true, winCount: 3 },
  { shape: "stepped", h: 52, w: 26, hasNeon: false, winCount: 5 },
  { shape: "spire", h: 65, w: 16, hasNeon: true, winCount: 2 },
];

/** UCLA: Royce Hall 塔楼为地标 */
const UCLA_BUILDINGS: SkylineBuilding[] = [
  { shape: "tiered", h: 52, w: 22, hasNeon: false, winCount: 4 },
  { shape: "spire", h: 88, w: 30, hasNeon: true, winCount: 2 },
  { shape: "classic", h: 56, w: 24, hasNeon: true, winCount: 4 },
  { shape: "dome", h: 58, w: 26, hasNeon: false, winCount: 3 },
  { shape: "antenna", h: 70, w: 18, hasNeon: true, winCount: 3 },
  { shape: "stepped", h: 54, w: 26, hasNeon: true, winCount: 5 },
  { shape: "classic", h: 48, w: 20, hasNeon: false, winCount: 3 },
  { shape: "spire", h: 65, w: 16, hasNeon: true, winCount: 2 },
];

export const SCHOOL_SKYLINE: Record<string, SchoolSkylineConfig> = {
  UVA: {
    buildings: UVA_BUILDINGS,
    neonColor: "#232D4B",
  },
  UCLA: {
    buildings: UCLA_BUILDINGS,
    neonColor: "#2774AE",
  },
  Axelerate: {
    buildings: DEFAULT_BUILDINGS,
    neonColor: "#EC4899",
  },
  Default: {
    buildings: DEFAULT_BUILDINGS,
    neonColor: "#EC4899",
  },
};

const WIN_COLORS = ["#ffcc44", "#88ccff", "#ffaa66", "#ccffcc"];

/** 根据 shortName 获取天际线配置 */
export function getSkylineConfig(
  shortName: string | null | undefined,
  primaryColor?: string
): SchoolSkylineConfig {
  const key = shortName?.trim() || "Default";
  const config = SCHOOL_SKYLINE[key] ?? SCHOOL_SKYLINE["Default"];
  return {
    ...config,
    neonColor: primaryColor ?? config.neonColor,
  };
}

export { WIN_COLORS };
