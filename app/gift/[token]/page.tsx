import Link from "next/link";
import { getGiftLandingPreview } from "@/app/actions/gift-checkout";
import { GiftClaimExperience } from "./gift-claim-client";

/** 每笔礼品链接都不同，禁止整页缓存成「不可用」占位 */
export const dynamic = "force-dynamic";

export default async function GiftLandingPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await props.params;
  let token = raw ?? "";
  try {
    token = decodeURIComponent(token.replace(/\+/g, "%20"));
  } catch {
    token = raw ?? "";
  }

  const preview = await getGiftLandingPreview(token);

  if (!preview.ok) {
    const isMigration = preview.reason === "gift_table_missing";
    const isBadToken = preview.reason === "invalid";
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[#07060b] px-8 text-center text-white">
        <h1 className="text-xl font-black uppercase tracking-tight">Gift link unavailable</h1>
        <p className="max-w-md text-sm text-white/65">
          {isMigration ?
            <>
              The database doesn&apos;t have the <code className="rounded bg-white/10 px-1 text-xs">gift_claims</code>{" "}
              table yet. In Supabase: SQL Editor paste{" "}
              <code className="rounded bg-white/10 px-1 text-[11px]">supabase/migrations/00047_gift_claims.sql</code>,
              run it, then open this link again. Also confirm{" "}
              <code className="rounded bg-white/10 px-1 text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code> is set where
              Next.js runs.
            </>
          : isBadToken ?
            <>This URL is missing the gift token. Check you copied the full link.</>
          : <>
              If you just created this gift, wait a moment and refresh. Otherwise the token may be wrong or the gift
              row is missing — try generating a new link from Perks Shop.
            </>}
        </p>
        <Link
          href="/?tab=shop"
          className="rounded-2xl border-2 border-white/25 bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-white/15"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  return <GiftClaimExperience token={token} preview={preview} />;
}
