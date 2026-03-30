import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client - 使用 service_role 绕过 RLS
 * 仅用于服务端高权限操作（如结账扣款、扣库存）
 * 切勿暴露到客户端！
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase admin env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
