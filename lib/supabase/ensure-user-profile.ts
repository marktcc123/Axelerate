import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 保证 public.profiles 存在与 auth 用户同 id 的一行（OAuth/旧账号可能未触发 DB trigger）。
 * 需使用 service_role 客户端。
 */
export async function ensureProfileRowForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId) {
    return { ok: false, error: "Missing user id" };
  }

  const { data: row, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selErr) {
    console.error("[ensureProfileRowForUser] select:", selErr);
    return { ok: false, error: selErr.message };
  }
  if (row) {
    return { ok: true };
  }

  const { data: authData, error: authErr } =
    await supabase.auth.admin.getUserById(userId);
  if (authErr || !authData?.user) {
    console.error("[ensureProfileRowForUser] auth.admin.getUserById:", authErr?.message);
    return { ok: false, error: "Auth user not found" };
  }

  const u = authData.user;
  const displayName =
    (typeof u.user_metadata?.full_name === "string" && u.user_metadata.full_name) ||
    (typeof u.user_metadata?.name === "string" && u.user_metadata.name) ||
    u.email?.split("@")[0] ||
    "User";

  const { error: insErr } = await supabase.from("profiles").insert({
    id: userId,
    full_name: displayName,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: true };
    }
    console.error("[ensureProfileRowForUser] insert:", insErr);
    return { ok: false, error: insErr.message };
  }

  return { ok: true };
}
