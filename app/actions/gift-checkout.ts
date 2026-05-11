"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyCartAndComputeUsdDue } from "@/lib/perks-checkout-pricing";
import { fulfillPerksShopOrder, type CartLine } from "@/lib/perks-order-fulfill";
import {
  assertGiftStillInStockSnapshot,
  createGiftRecipientPerksOrder,
} from "@/lib/gift-recipient-order";

function normalizeGiftToken(raw: string): string {
  let t = raw.trim();
  try {
    t = decodeURIComponent(t.replace(/\+/g, "%20"));
  } catch {
    /* keep t */
  }
  return t.replace(/\s+/g, "");
}

/** JSONB lines from `orders.items`: array, JSON string, or legacy single object */
function coerceOrderItemsLines(items: unknown): unknown[] {
  if (items == null) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const p = JSON.parse(items) as unknown;
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (typeof items === "object") {
    const o = items as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.quantity === "number") return [o];
    /** Some stacks store under `lines` */
    const nested = o.lines;
    return Array.isArray(nested) ? nested : [];
  }
  return [];
}

function parseOrderItems(items: unknown): CartLine[] {
  return coerceOrderItemsLines(items).map((row) => {
    const rec = row as Record<string, unknown>;
    const id =
      typeof rec?.id === "string" && rec.id.trim() ?
        rec.id.trim()
      : typeof rec?.product_id === "string" && String(rec.product_id).trim() ?
        String(rec.product_id).trim()
      : "";

    const quantity =
      typeof rec?.quantity === "number" && Number.isFinite(rec.quantity) ?
        Math.max(1, Math.floor(rec.quantity))
      : 1;

    const shopifyVariantId =
      typeof rec?.shopifyVariantId === "string" ?
        rec.shopifyVariantId
      : typeof rec?.shopify_variant_id === "string" ?
        rec.shopify_variant_id
      : undefined;

    const line: CartLine = {
      id,
      quantity,
      ...(shopifyVariantId ? { shopifyVariantId } : {}),
    };
    return line;
  });
}

function giftClaimsTableLikelyMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const m = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    (m.includes("gift_claim") && m.includes("does not exist")) ||
    (m.includes("schema cache") && m.includes("gift_claim"))
  );
}

/** 公开的落地预览（不写敏感信息） — 服务端用 service role */
export async function getGiftLandingPreview(token: string): Promise<
  | { ok: false; reason: "invalid" | "not_found" | "gift_table_missing" }
  | {
      ok: true;
      claimed: boolean;
      title: string;
      imageUrl: string | null;
      brandName: string | null;
    }
> {
  const t = normalizeGiftToken(token);
  if (!t) return { ok: false, reason: "invalid" };

  const admin = createAdminClient();

  const q = await admin
    .from("gift_claims")
    .select("claimed_at, purchaser_order_id")
    .eq("token", t)
    .maybeSingle();

  if (q.error) {
    if (giftClaimsTableLikelyMissing(q.error)) {
      return { ok: false, reason: "gift_table_missing" };
    }
    const benignEmpty =
      String(q.error.code ?? "") === "PGRST116" ||
      String(q.error.message ?? "").toLowerCase().includes("0 rows");
    if (!benignEmpty) {
      console.warn("[getGiftLandingPreview] gift_claims:", q.error);
      return { ok: false, reason: "not_found" };
    }
  }

  const claimRow = q.data as
    | {
        claimed_at: string | null;
        purchaser_order_id: string;
      }
    | null;

  if (!claimRow) {
    return { ok: false, reason: "not_found" };
  }

  const { data: order, error } = await admin
    .from("orders")
    .select("items")
    .eq("id", claimRow.purchaser_order_id)
    .maybeSingle();

  if (error) {
    console.warn("[getGiftLandingPreview] orders lookup:", error);
    return { ok: false, reason: "not_found" };
  }

  const rawItems = order?.items;
  if (rawItems == null) return { ok: false, reason: "not_found" };

  const lines = parseOrderItems(rawItems);
  const main = lines.find((l) => l.id.trim().length > 0);
  if (!main?.id) {
    console.warn("[getGiftLandingPreview] unparseable order items", typeof rawItems);
    return { ok: false, reason: "not_found" };
  }

  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("title, image_url, brand:brands(name)")
    .eq("id", main.id)
    .maybeSingle();

  let prod: {
    title?: string | null;
    image_url?: string | null;
    brand?: { name?: string | null };
  } | null = product as typeof prod | null;

  if (prodErr || !prod) {
    const basic = await admin
      .from("products")
      .select("title, image_url")
      .eq("id", main.id)
      .maybeSingle();
    prod = basic.data as typeof prod | null;
  }

  const title =
    typeof prod?.title === "string" && prod.title.trim().length > 0
      ? prod.title.trim()
      : "Axelerate Perk";

  return {
    ok: true,
    claimed: !!claimRow.claimed_at,
    title,
    imageUrl: typeof prod?.image_url === "string" ? prod.image_url : null,
    brandName:
      prod?.brand && typeof prod.brand.name === "string"
        ? prod.brand.name
        : null,
  };
}

export async function purchasePerksGiftCheckout(
  productId: string,
  shopifyVariantId: string | null,
  creditsToUse: number
): Promise<
  | { ok: true; giftUrlPath: string; token: string }
  | { ok: false; error: string }
> {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabaseAuth.auth.getUser();
  if (userErr || !user?.id) {
    return { ok: false, error: "Please sign in to send a gift" };
  }

  const cartItems: CartLine[] = [
    {
      id: productId.trim(),
      quantity: 1,
      ...(shopifyVariantId?.trim() ? { shopifyVariantId: shopifyVariantId.trim() } : {}),
    },
  ];

  const admin = createAdminClient();
  const pricing = await verifyCartAndComputeUsdDue(
    admin,
    user.id,
    cartItems,
    creditsToUse
  );

  if (!pricing.ok) {
    return { ok: false, error: pricing.error };
  }

  const fulfill = await fulfillPerksShopOrder(admin, {
    userId: user.id,
    cartItems,
    deductCashFromBalance: pricing.amountToPayUsd,
    deductCredits: pricing.actualCreditsUsed,
    orderCashPaid: pricing.amountToPayUsd,
    stripeCheckoutSessionId: null,
    skipMirroredShopifySync: true,
    skipProductPurchaseInserts: true,
  });

  if (!fulfill.success || !fulfill.orderId) {
    return { ok: false, error: fulfill.success ? "Order missing" : fulfill.error };
  }

  try {
    const token = crypto.randomBytes(26).toString("base64url");
    const { error: gcErr } = await admin.from("gift_claims").insert({
      token,
      purchaser_order_id: fulfill.orderId,
      mirror_cash_share: fulfill.mirrorPaidShare?.cash ?? 0,
      mirror_credits_share: fulfill.mirrorPaidShare?.credits ?? 0,
    });
    if (gcErr) {
      console.error("[purchasePerksGiftCheckout] gift_claims insert:", gcErr);
      return {
        ok: false,
        error:
          gcErr.code === "42P01" || gcErr.message?.includes("gift_claims")
            ? "Gift feature not enabled on database yet."
            : "Could not finalize gift — contact support.",
      };
    }

    void revalidatePath("/");
    void revalidatePath("/my-orders");

    const giftUrlPath = `/gift/${encodeURIComponent(token)}`;

    return { ok: true, giftUrlPath, token };
  } catch (e) {
    console.error("[purchasePerksGiftCheckout]", e);
    return { ok: false, error: "Could not create gift link" };
  }
}

export async function claimPerksGift(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = normalizeGiftToken(token);
  if (!t) return { ok: false, error: "Invalid gift link." };

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabaseAuth.auth.getUser();
  if (userErr || !user?.id) {
    return { ok: false, error: "Sign in to unwrap your gift." };
  }

  const admin = createAdminClient();

  const { data: claim, error: cErr } = await admin
    .from("gift_claims")
    .select("*")
    .eq("token", t)
    .maybeSingle();

  if (cErr && giftClaimsTableLikelyMissing(cErr)) {
    return {
      ok: false,
      error: "Gift feature not enabled yet — deploy the latest migration.",
    };
  }

  if (!claim) return { ok: false, error: "This gift link is invalid or expired." };

  type ClaimRow = {
    id: string;
    claimed_at: string | null;
    recipient_user_id: string | null;
    purchaser_order_id: string;
    mirror_cash_share: number;
    mirror_credits_share: number;
    recipient_order_id: string | null;
  };

  const row = claim as ClaimRow;

  if (row.claimed_at) {
    if (row.recipient_user_id === user.id) {
      return {
        ok: false,
        error: "You’ve already redeemed this gift — open My Orders.",
      };
    }
    return { ok: false, error: "This gift was already redeemed." };
  }

  const { data: payerOrder } = await admin
    .from("orders")
    .select("id, user_id, items")
    .eq("id", row.purchaser_order_id)
    .maybeSingle();

  type PRow = {
    id: string;
    user_id: string;
    items: unknown;
  };

  if (!payerOrder?.items) return { ok: false, error: "Gift payment record missing." };
  const p = payerOrder as PRow;

  if (p.user_id === user.id) {
    return { ok: false, error: "You can’t redeem a gift sent from your own account." };
  }

  const cartItems = parseOrderItems(p.items).filter((c) => c.id);
  if (cartItems.length === 0)
    return { ok: false, error: "This gift cart is corrupted — contact support." };

  const productIds = [...new Set(cartItems.map((c) => c.id))];
  const { data: products } = await admin
    .from("products")
    .select("id, stock_count, specifications")
    .in("id", productIds);

  const stash = products ?? [];

  const inv = assertGiftStillInStockSnapshot(cartItems, stash);
  if (!inv.ok) return { ok: false, error: inv.error };

  const mirrorShare = {
    cash: Number(row.mirror_cash_share ?? 0),
    credits: Number(row.mirror_credits_share ?? 0),
  };

  const created = await createGiftRecipientPerksOrder(admin, {
    recipientUserId: user.id,
    cartItems,
    mirrorPaidShare: mirrorShare,
  });

  if (!created.success || !created.orderId) {
    return { ok: false, error: created.success ? "No order created" : created.error };
  }

  const { error: updErr } = await admin
    .from("gift_claims")
    .update({
      claimed_at: new Date().toISOString(),
      recipient_user_id: user.id,
      recipient_order_id: created.orderId,
    })
    .eq("id", row.id);

  if (updErr) {
    console.error("[claimPerksGift] update claim:", updErr);
    /** 订单已建，尽量不误导用户 */


    return {
      ok: false,
      error:
        "We created your order but failed to finalize the gift — please refresh Orders or contact support.",
    };
  }

  void revalidatePath("/");
  void revalidatePath("/my-orders");
  void revalidatePath(`/gift/${encodeURIComponent(t)}`);

  return { ok: true };
}
