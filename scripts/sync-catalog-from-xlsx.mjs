/**
 * 将 Catalog Selected.xlsx 同步到 Supabase `brands` + `products`。
 *
 * Sheet1：主数据（库存、条码、MSRP、长描述等）→ specifications + 价格/库存
 * Sheet2：补充 SKU / Amazon 链接（Brand 列向下填充）
 *
 * 用法：
 *   node scripts/sync-catalog-from-xlsx.mjs "C:\path\to\Catalog Selected.xlsx"
 *
 * 依赖 .env.local：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function clampIntStock(n) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(x, 2_000_000_000);
}

function makeBrandResolver(supabase) {
  /** @type {Map<string, string>} lowercase name -> id */
  const byLower = new Map();
  let loaded = false;

  async function load() {
    if (loaded) return;
    const { data, error } = await supabase.from("brands").select("id, name");
    if (error) throw error;
    for (const b of data ?? []) {
      byLower.set(str(b.name).toLowerCase(), b.id);
    }
    loaded = true;
  }

  return async function ensureBrand(name) {
    const trimmed = str(name);
    if (!trimmed) return null;
    await load();
    const key = trimmed.toLowerCase();
    const existing = byLower.get(key);
    if (existing) return existing;

    const { data: inserted, error: insErr } = await supabase
      .from("brands")
      .insert({
        name: trimmed,
        is_featured: false,
        logo_url: null,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    byLower.set(key, inserted.id);
    return inserted.id;
  };
}

function makeProductIndex(supabase) {
  /** @type {Map<string, { id: string, specifications: object }[]>} brandId -> products */
  const byBrand = new Map();

  async function loadBrand(brandId) {
    if (byBrand.has(brandId)) return;
    const { data: rows, error } = await supabase
      .from("products")
      .select("id, specifications, title")
      .eq("brand_id", brandId);
    if (error) throw error;
    byBrand.set(brandId, rows ?? []);
  }

  function findInBrand(brandId, catalogKey) {
    const key = str(catalogKey);
    if (!key) return null;
    const rows = byBrand.get(brandId) ?? [];
    for (const p of rows) {
      const spec = p.specifications && typeof p.specifications === "object" ? p.specifications : {};
      if (str(spec.catalog_inventory_code) === key || str(spec.catalog_sku) === key) {
        return p.id;
      }
    }
    return null;
  }

  function remember(brandId, id, specifications) {
    const rows = byBrand.get(brandId) ?? [];
    rows.push({ id, specifications: specifications || {} });
    byBrand.set(brandId, rows);
  }

  function patch(brandId, id, specifications) {
    const rows = byBrand.get(brandId) ?? [];
    const p = rows.find((r) => r.id === id);
    if (p) p.specifications = specifications || {};
  }

  return { loadBrand, findInBrand, remember, patch };
}

async function upsertProduct(supabase, index, brandId, payload, catalogKey) {
  await index.loadBrand(brandId);
  const existingId = index.findInBrand(brandId, catalogKey);

  if (existingId) {
    const { error } = await supabase.from("products").update(payload).eq("id", existingId);
    if (error) throw error;
    index.patch(brandId, existingId, payload.specifications);
    return { id: existingId, action: "updated" };
  }

  const { data, error } = await supabase.from("products").insert(payload).select("id").single();
  if (error) throw error;
  index.remember(brandId, data.id, payload.specifications);
  return { id: data.id, action: "inserted" };
}

function readSheet1(wb) {
  const sheet = wb.Sheets["Sheet1"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  return rows.filter((r) => str(r["Product Names"]));
}

function readSheet2(wb) {
  const sheet = wb.Sheets["Sheet2"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  let lastBrand = "";
  const out = [];
  for (const r of rows) {
    if (str(r["Brand"])) lastBrand = str(r["Brand"]);
    const sku = str(r["SKU"]);
    const product = str(r["Product"]);
    if (!sku && !product) continue;
    out.push({
      brand: lastBrand || str(r["Brand"]),
      sku: sku || null,
      product: product || sku,
      msrp: num(r["MSRP"], 0),
      amz: str(r["AMZ Link"]) || null,
    });
  }
  return out;
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error('Usage: node scripts/sync-catalog-from-xlsx.mjs "<path-to.xlsx>"');
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ensureBrand = makeBrandResolver(supabase);
  const productIndex = makeProductIndex(supabase);

  const wb = XLSX.readFile(xlsxPath);
  const sheet1 = readSheet1(wb);
  const sheet2 = readSheet2(wb);

  let brandsTouched = new Set();
  let inserted = 0;
  let updated = 0;

  for (const r of sheet1) {
    const brandName = str(r["Brand"]);
    const brandId = await ensureBrand(brandName);
    if (!brandId) continue;
    brandsTouched.add(brandName);

    const invCode = str(r["Inventory Code"]);
    const title = str(r["Product Names"]);
    const msrp = num(r["MSRP"], 0);
    const stock = clampIntStock(r["Inventory pcs"]);
    const description = str(r["Product Description"]) || null;
    const pic = r["Product Pic"];
    const image_url =
      typeof pic === "string" && /^https?:\/\//i.test(pic.trim()) ? pic.trim() : null;

    const specifications = {
      source_sheet: "Sheet1",
      catalog_inventory_code: invCode || null,
      catalog_barcode: r["Bar Code"] != null ? str(r["Bar Code"]) : null,
      capacity_per_ctn: r["Capacity per CTN"] ?? null,
      product_dimension_cm: str(r["Product Demension (cm)"]) || null,
      net_weight: str(r["Product Net Weight"]) || null,
      carton_dimension_cm: str(r["Carton Dimension (cm)"]) || null,
    };

    const payload = {
      brand_id: brandId,
      title,
      description,
      stock_count: stock,
      price_credits: 0,
      original_price: msrp > 0 ? msrp : null,
      discount_price: msrp > 0 ? msrp : null,
      category: "Beauty",
      is_drop: false,
      image_url,
      images: image_url ? [image_url] : null,
      specifications,
    };

    const key = invCode || title;
    const res = await upsertProduct(supabase, productIndex, brandId, payload, key);
    if (res.action === "inserted") inserted++;
    else updated++;
    console.log(`[Sheet1] ${res.action}: ${title.slice(0, 48)}…`);
  }

  for (const r of sheet2) {
    const brandId = await ensureBrand(r.brand);
    if (!brandId) continue;
    brandsTouched.add(r.brand);

    const catalogKey = r.sku || r.product;
    const msrp = r.msrp;
    const specifications = {
      source_sheet: "Sheet2",
      catalog_sku: r.sku || null,
      amazon_url: r.amz || null,
    };

    const payload = {
      brand_id: brandId,
      title: r.product,
      description: r.amz ? `Amazon: ${r.amz}` : null,
      stock_count: 0,
      price_credits: 0,
      original_price: msrp > 0 ? msrp : null,
      discount_price: msrp > 0 ? msrp : null,
      category: "Beauty",
      is_drop: false,
      image_url: null,
      brand_link_url: r.amz || null,
      specifications,
    };

    const res = await upsertProduct(supabase, productIndex, brandId, payload, catalogKey);
    if (res.action === "inserted") inserted++;
    else updated++;
    console.log(`[Sheet2] ${res.action}: ${r.product.slice(0, 48)}…`);
  }

  console.log("\nDone.");
  console.log(`  Brands touched: ${brandsTouched.size} (${[...brandsTouched].join(", ")})`);
  console.log(`  Products inserted: ${inserted}, updated: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
