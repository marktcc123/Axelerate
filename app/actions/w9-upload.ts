"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const W9_BUCKET = "w9-forms";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

function bucketExistsMessage(err: { message?: string } | null): boolean {
  const m = err?.message ?? "";
  return /already exists|duplicate|BucketAlreadyExists|resource already exists/i.test(m);
}

/**
 * 使用 service role 上传 W-9：不依赖客户端 Storage 策略；必要时自动创建 bucket。
 */
export async function submitW9Document(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return { success: false, error: "Please sign in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: "File must be 5 MB or smaller." };
  }
  if (!ALLOWED.has(file.type)) {
    return { success: false, error: "Use PDF, JPG, or PNG only." };
  }

  const admin = createAdminClient();

  const { error: bucketErr } = await admin.storage.createBucket(W9_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  });
  if (bucketErr && !bucketExistsMessage(bucketErr)) {
    console.warn("[submitW9Document] createBucket:", bucketErr.message);
  }

  const ext =
    file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : "png";
  const path = `${user.id}/w9.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(W9_BUCKET).upload(path, buf, {
    upsert: true,
    contentType: file.type,
  });

  if (upErr) {
    console.error("[submitW9Document] upload:", upErr);
    return {
      success: false,
      error:
        upErr.message?.includes("Bucket not found") || upErr.message?.includes("not found")
          ? "Storage bucket is missing. In Supabase Dashboard → Storage, create a private bucket named w9-forms, or run migration 00028_w9_storage_and_profiles.sql."
          : upErr.message || "Upload failed.",
    };
  }

  const now = new Date().toISOString();
  const baseFields = {
    w9_document_path: path,
    w9_submitted_at: now,
    updated_at: now,
  };

  let profErr = (
    await admin
      .from("profiles")
      .update({ ...baseFields, is_w9_verified: false })
      .eq("id", user.id)
  ).error;

  // is_w9_verified 来自迁移 00008；若只跑了 00028 会缺该列，退化为只写路径与时间
  if (profErr && /is_w9_verified|w9_verified/i.test(profErr.message ?? "")) {
    profErr = (await admin.from("profiles").update(baseFields).eq("id", user.id)).error;
  }

  if (profErr) {
    console.error("[submitW9Document] profile:", profErr.code, profErr.message, profErr.details);
    const msg = profErr.message?.trim() || "Profile update failed.";

    if (/schema cache/i.test(msg)) {
      return {
        success: false,
        error:
          "Supabase API schema is out of date. Dashboard → Project Settings → API → Reload schema (or wait 1–2 minutes), then upload again.",
      };
    }

    if (/could not find|does not exist|42703/i.test(msg) && /w9_|profiles/i.test(msg)) {
      return {
        success: false,
        error: `${msg} Run SQL from migrations 00008_profiles_w9_fields.sql (is_w9_verified) and 00028_w9_storage_and_profiles.sql (w9_document_path, w9_submitted_at), then reload API schema.`,
      };
    }

    return { success: false, error: msg };
  }

  return { success: true };
}
