"use server";

import { createClient } from "@/lib/supabase/server";

export type ApplyEventResult =
  | { success: true }
  | { success: false; error: string };

export async function applyEvent(
  userId: string,
  eventId: string
): Promise<ApplyEventResult> {
  if (!userId || !eventId) {
    return { success: false, error: "Invalid request" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return { success: false, error: "Unauthorized" };
  }
  const { error } = await supabase.from("event_applications").insert({
    user_id: userId,
    event_id: eventId,
    status: "applied",
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Already applied" };
    }
    console.error("[applyEvent]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
