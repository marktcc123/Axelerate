"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CheckinResult =
  | { success: true }
  | { success: false; error: string };

export type CheckinDataResult =
  | {
      success: true;
      data: {
        fullName: string | null;
        avatarUrl: string | null;
        campus: string | null;
        eventTitle: string;
        eventImageUrl: string | null;
        status: string;
      };
    }
  | { success: false; error: string };

/** 获取核销页所需数据（需 admin 权限，使用 admin client 绕过 RLS） */
export async function getCheckinData(
  applicationId: string
): Promise<CheckinDataResult> {
  if (!applicationId?.trim()) {
    return { success: false, error: "Invalid application ID" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier ?? "guest").toString().toLowerCase();
  const isAdmin = tier === "staff" || tier === "city_manager" || tier === "partner";
  if (!isAdmin) {
    return { success: false, error: "Unauthorized Scanner" };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("event_applications")
    .select(
      "id, user_id, event_id, status, profile:profiles(full_name, avatar_url, campus), event:events(title, image_url)"
    )
    .eq("id", applicationId)
    .single();

  if (error || !row) {
    return { success: false, error: "Application not found" };
  }

  const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const e = Array.isArray(row.event) ? row.event[0] : row.event;
  const profileRow = p as { full_name?: string; avatar_url?: string; campus?: string } | null;
  const eventRow = e as { title?: string; image_url?: string } | null;

  return {
    success: true,
    data: {
      fullName: profileRow?.full_name ?? null,
      avatarUrl: profileRow?.avatar_url ?? null,
      campus: profileRow?.campus ?? null,
      eventTitle: eventRow?.title ?? "Unknown Event",
      eventImageUrl: eventRow?.image_url ?? null,
      status: (row as { status?: string }).status ?? "",
    },
  };
}

/** 核销：将 event_application 的 status 更新为 attended */
export async function confirmCheckin(
  applicationId: string
): Promise<CheckinResult> {
  if (!applicationId?.trim()) {
    return { success: false, error: "Invalid application ID" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier ?? "guest").toString().toLowerCase();
  const isAdmin = tier === "staff" || tier === "city_manager" || tier === "partner";
  if (!isAdmin) {
    return { success: false, error: "Unauthorized Scanner" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("event_applications")
    .update({ status: "attended" })
    .eq("id", applicationId);

  if (error) {
    console.error("[confirmCheckin]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
