"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ShippingAddressJson } from "@/lib/types";

export type SaveAddressResult =
  | { success: true }
  | { success: false; error: string };

const shippingSchema = z.object({
  address_line1: z.string().trim().min(1, "Address line is required").max(300),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State is required").max(80),
  zip_code: z.string().trim().min(3, "ZIP code is required").max(24),
});

/** 写入 profiles.shipping_address（JSON） */
export async function saveShippingAddress(
  input: ShippingAddressJson
): Promise<SaveAddressResult> {
  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat()[0];
    return { success: false, error: first ?? "Invalid address" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  const payload: ShippingAddressJson = {
    address_line1: parsed.data.address_line1,
    city: parsed.data.city,
    state: parsed.data.state,
    zip_code: parsed.data.zip_code,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      shipping_address: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[saveShippingAddress]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}
