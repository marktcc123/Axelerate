/**
 * Axelerate - 动态校园主题引擎
 * 从 Supabase schools 表读取，废弃静态常量
 */

import { createClient } from "@/lib/supabase/client";

export interface School {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_SCHOOL_NAME = "Default (Axelerate)";

/** App Theme 选项：默认主题的显示名与存储值 */
export const DEFAULT_THEME_LABEL = "Default Theme (Neon Pink)";

/** HEX 转 RGB 字符串，用于 Tailwind 透明度 */
export function hexToRgb(hex: string): string {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : "236 72 153";
}

/** 根据 campus 名称查询学校，查不到则回退 Default (Axelerate) */
export async function getSchoolByCampus(campus: string | null | undefined): Promise<School | null> {
  const supabase = createClient();
  const trimmed = campus?.trim();
  if (!trimmed) {
    const { data } = await supabase
      .from("schools")
      .select("*")
      .eq("name", DEFAULT_SCHOOL_NAME)
      .single();
    return data as School | null;
  }
  const { data } = await supabase
    .from("schools")
    .select("*")
    .eq("name", trimmed)
    .single();
  if (data) return data as School;
  const { data: fallback } = await supabase
    .from("schools")
    .select("*")
    .eq("name", DEFAULT_SCHOOL_NAME)
    .single();
  return fallback as School | null;
}

/** 拉取所有学校列表（用于 Settings 下拉） */
export async function listSchools(): Promise<School[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("schools")
    .select("*")
    .order("name");
  return (data ?? []) as School[];
}

/** app_theme 格式: "Default (Axelerate)" 或 "University of Virginia Theme" */
export const APP_THEME_SUFFIX = " Theme";

/** 判断是否为默认主题（使用硬编码粉色，不查 DB） */
export function isDefaultAppTheme(appTheme: string | null | undefined): boolean {
  const t = appTheme?.trim();
  return !t || t === DEFAULT_THEME_LABEL || t === DEFAULT_SCHOOL_NAME;
}

/** 根据 app_theme 查询学校颜色。Default 返回 null（ThemeWrapper 用硬编码）；"[校名] Theme" 查 schools */
export async function getSchoolByAppTheme(appTheme: string | null | undefined): Promise<School | null> {
  if (isDefaultAppTheme(appTheme)) return null;
  const supabase = createClient();
  const trimmed = appTheme!.trim();
  const schoolName = trimmed.endsWith(APP_THEME_SUFFIX)
    ? trimmed.slice(0, -APP_THEME_SUFFIX.length).trim()
    : trimmed;
  const { data } = await supabase
    .from("schools")
    .select("*")
    .eq("name", schoolName)
    .single();
  return data as School | null;
}

/** 将校名转为 App Theme 选项值，如 "University of Virginia" -> "University of Virginia Theme" */
export function toAppThemeValue(schoolName: string): string {
  return `${schoolName.trim()}${APP_THEME_SUFFIX}`;
}

/** 评论者展示：取自 full_name 的第一段（如 Mark Tao → Mark） */
export function firstNameFromFullName(fullName: string | null | undefined): string {
  const t = fullName?.trim();
  if (!t) return "Student";
  return t.split(/\s+/)[0] ?? "Student";
}

/**
 * profiles.campus 与 schools.name 对齐，转为 @ 后缀（UCLA、UVA 等）。
 * 新学校若在 schools 中使用短名称（如 UCLA），将原样显示。
 */
export function formatCampusSuffixForReview(campus: string | null | undefined): string | null {
  const c = campus?.trim();
  if (!c || c === DEFAULT_SCHOOL_NAME) return null;
  const lower = c.toLowerCase();
  if (lower === "ucla") return "UCLA";
  if (/university\s+of\s+virginia/.test(lower)) return "UVA";
  return c;
}

/** 商品评论快照用，如 Mark@UCLA；无校园则仅名 */
export function buildReviewerBadge(
  fullName: string | null | undefined,
  campus: string | null | undefined
): string {
  const first = firstNameFromFullName(fullName);
  const suffix = formatCampusSuffixForReview(campus);
  return suffix ? `${first}@${suffix}` : first;
}
