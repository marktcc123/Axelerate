/**
 * 合并 Supabase 中「同名」重复品牌：选定主品牌，将 products / gigs 外键迁到主品牌后删除重复行。
 *
 * 匹配规则：规范化后相同（小写、去重音、统一撇号、合并空格）。
 *
 * 主品牌选择：优先「商品数 + gig 数」最多；并列则取 name 字典序较小（稳定）。
 *
 * 用法：
 *   node scripts/merge-duplicate-brands.mjs           # 执行
 *   node scripts/merge-duplicate-brands.mjs --dry-run # 只打印计划
 *
 * 需要 .env.local：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeBrandKey(name) {
  if (name == null) return "";
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: brands, error: bErr } = await supabase.from("brands").select("id, name, created_at");
  if (bErr) throw bErr;

  const { data: products, error: pErr } = await supabase.from("products").select("id, brand_id");
  if (pErr) throw pErr;

  const { data: gigs, error: gErr } = await supabase.from("gigs").select("id, brand_id");
  if (gErr) throw gErr;

  const productCountByBrand = new Map();
  for (const p of products ?? []) {
    productCountByBrand.set(p.brand_id, (productCountByBrand.get(p.brand_id) ?? 0) + 1);
  }

  const gigCountByBrand = new Map();
  for (const g of gigs ?? []) {
    gigCountByBrand.set(g.brand_id, (gigCountByBrand.get(g.brand_id) ?? 0) + 1);
  }

  /** @type {Map<string, typeof brands>} */
  const groups = new Map();
  for (const b of brands ?? []) {
    const key = normalizeBrandKey(b.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);

  if (duplicates.length === 0) {
    console.log("No duplicate brand groups found (by normalized name).");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate group(s).\n`);

  for (const [normKey, list] of duplicates) {
    const scored = list.map((b) => ({
      ...b,
      pc: productCountByBrand.get(b.id) ?? 0,
      gc: gigCountByBrand.get(b.id) ?? 0,
    }));
    scored.sort((a, b) => {
      const ta = a.pc + a.gc;
      const tb = b.pc + b.gc;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });

    const keeper = scored[0];
    const losers = scored.slice(1);

    console.log(`[${normKey}]`);
    console.log(`  KEEP:   ${keeper.name} (${keeper.id}) — products ${keeper.pc}, gigs ${keeper.gc}`);
    for (const l of losers) {
      console.log(`  MERGE:  ${l.name} (${l.id}) — products ${l.pc}, gigs ${l.gc} → ${keeper.name}`);
    }

    if (dryRun) {
      console.log("  (dry-run, no DB changes)\n");
      continue;
    }

    for (const l of losers) {
      if (l.pc > 0) {
        const { error } = await supabase.from("products").update({ brand_id: keeper.id }).eq("brand_id", l.id);
        if (error) throw new Error(`products update ${l.id}: ${error.message}`);
      }
      if (l.gc > 0) {
        const { error } = await supabase.from("gigs").update({ brand_id: keeper.id }).eq("brand_id", l.id);
        if (error) throw new Error(`gigs update ${l.id}: ${error.message}`);
      }

      const { error: delErr } = await supabase.from("brands").delete().eq("id", l.id);
      if (delErr) throw new Error(`delete brand ${l.id}: ${delErr.message}`);
      console.log(`  ✓ Merged & deleted ${l.name}`);
    }
    console.log("");
  }

  if (dryRun) {
    console.log("Dry-run only. Run without --dry-run to apply.");
  } else {
    console.log("Done. Duplicate brands merged into canonical rows.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
