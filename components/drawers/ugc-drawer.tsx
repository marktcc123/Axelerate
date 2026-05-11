"use client";

import { useEffect, useRef } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  DollarSign,
  Zap,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import type { Brand, Gig, UserGig } from "@/lib/types";

type UserGigUgcMetrics = UserGig & {
  ugc_thumbnail_url?: string | null;
  views_count?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
};

function resolveBrandLabel(gig: Gig | undefined, brands: Brand[]): string {
  if (!gig) return "Partner brand";
  const nested = gig.brand?.name?.trim();
  if (nested) return nested;
  const fromList = gig.brand_id ?
    brands.find((b) => b.id === gig.brand_id)?.name?.trim()
  : undefined;
  return fromList || "Partner brand";
}

/** gallery_url：单链接或逗号/空白分隔的首张图 */
function firstGalleryImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    const first = t.split(/[\s,;|]+/).find((x) => x.startsWith("http"));
    return first?.trim();
  }
  return undefined;
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

interface UGCDrawerProps {
  preselectedUserGig?: UserGig | null;
}

/** 占位图：无缩略图时使用 */
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23111' width='400' height='300'/%3E%3Cpath fill='%23333' d='M200 120v60l30-30 20 20 30-50-80-20z'/%3E%3Ccircle fill='%23333' cx='140' cy='100' r='24'/%3E%3C/svg%3E";

export function UGCDrawer({ preselectedUserGig }: UGCDrawerProps) {
  const { user, userGigs, brands } = useAppDataContext();
  const brandList = brands ?? [];
  const preselectedRef = useRef<HTMLDivElement>(null);

  const portfolioItems = (userGigs ?? []).filter(
    (ug) =>
      (ug.status === "completed" || ug.status === "paid") &&
      ug.gig?.type === "ugc_post"
  );

  useEffect(() => {
    if (preselectedUserGig && preselectedRef.current) {
      preselectedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [preselectedUserGig]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Video className="mb-3 h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Sign in to view your UGC portfolio</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-4">
      {/* 抽屉头部 */}
      <div className="mb-6">
        <h3 className="text-xl font-black text-white mb-2">Brand Co-Creations</h3>
        <p className="text-sm text-gray-400">
          Your digital footprint. Showcase the hype you&apos;ve built for top brands.
        </p>
      </div>

      {portfolioItems.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Video className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-base font-bold text-foreground">No UGC yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete tasks and submit your content to build your portfolio
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {portfolioItems.map((ug) => {
            const gig = ug.gig;
            const brandName = resolveBrandLabel(gig, brandList);
            const ext = ug as UserGigUgcMetrics;

            const brandLogo =
              gig?.brand?.logo_url?.trim() ||
              brandList.find((b) => b.id === gig?.brand_id)?.logo_url?.trim();

            const galleryCover = gig ? firstGalleryImageUrl(gig.gallery_url) : undefined;

            const thumbnailCandidate =
              ext.ugc_thumbnail_url?.trim() ||
              (gig as { image_url?: string | null })?.image_url?.trim() ||
              galleryCover ||
              brandLogo;

            const thumbnailUrl = thumbnailCandidate || PLACEHOLDER_IMG;

            const isMetric = (n: unknown): n is number =>
              typeof n === "number" && Number.isFinite(n) && n >= 0;
            const viewsCount = ext.views_count;
            const likesCount = ext.likes_count;
            const commentsCount = ext.comments_count;
            const hasEngagementMetrics =
              isMetric(viewsCount) || isMetric(likesCount) || isMetric(commentsCount);

            const cashReward = gig?.reward_cash ?? 0;
            const pointsReward = gig?.reward_credits ?? 0;
            const xpReward = gig?.xp_reward ?? 0;

            const ugcHref = ug.ugc_link?.trim();

            const isPreselected = preselectedUserGig?.id === ug.id;
            return (
              <div
                key={ug.id}
                ref={isPreselected ? preselectedRef : undefined}
                className={cn(
                  "mb-6 bg-[#0a0a0a] border rounded-xl overflow-hidden shadow-lg transition-colors group",
                  isPreselected
                    ? "border-[var(--theme-primary)]/60 ring-2 ring-[var(--theme-primary)]/30"
                    : "border-white/10 hover:border-[var(--theme-primary)]/50"
                )}
              >
                {/* 上半部分：视频封面截图占位图 */}
                <div className="relative h-48 w-full bg-gray-900">
                  <img
                    src={thumbnailUrl}
                    alt="UGC Thumbnail"
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  {/* 品牌 Logo/名称 绝对定位在左上角 */}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-white max-w-[min(80%,260px)] truncate">
                    {brandName}
                  </div>
                  {/* 有真实回填时才展示播放量等；禁止使用虚假默认数 */}
                  <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black via-black/70 to-transparent text-white">
                    {hasEngagementMetrics ?
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {isMetric(viewsCount) ?
                          <span className="flex items-center gap-1.5 text-sm font-black drop-shadow-md">
                            <Eye size={16} className="text-[var(--theme-primary)]" />{" "}
                            {formatCount(viewsCount)}
                          </span>
                        : null}
                        {isMetric(likesCount) ?
                          <span className="flex items-center gap-1.5 text-sm font-black drop-shadow-md">
                            <Heart size={16} className="text-pink-500" />{" "}
                            {formatCount(likesCount)}
                          </span>
                        : null}
                        {isMetric(commentsCount) ?
                          <span className="flex items-center gap-1.5 text-sm font-black drop-shadow-md">
                            <MessageCircle size={16} className="text-blue-400" />{" "}
                            {formatCount(commentsCount)}
                          </span>
                        : null}
                      </div>
                    : (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72">
                        Live views / likes / comments sync once ops attaches metrics — nothing fake here.
                      </p>
                    )}
                  </div>
                </div>

                {/* 下半部分：任务详情与已获奖励结算 */}
                <div className="p-4 bg-gradient-to-b from-white/[0.02] to-transparent">
                  <h4 className="text-white font-bold text-lg mb-2 line-clamp-2 leading-snug">
                    {gig?.title ?? "Task"}
                  </h4>
                  {ugcHref ?
                    <a
                      href={ugcHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-3 inline-flex text-xs font-bold uppercase tracking-wide text-[var(--theme-primary)] underline-offset-4 hover:underline"
                    >
                      Open submitted post →
                    </a>
                  : null}
                  {/* 奖励结算 (Rewards Earned) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 mr-1 uppercase tracking-wider font-bold">
                      Earned:
                    </span>
                    {cashReward > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <DollarSign size={12} strokeWidth={3} /> ${cashReward}
                      </div>
                    )}
                    {pointsReward > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                        <Zap size={12} className="fill-amber-400" /> {pointsReward} pts
                      </div>
                    )}
                    {xpReward > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--theme-primary)]/15 border border-[var(--theme-primary)]/30 text-[var(--theme-primary)] text-xs font-bold">
                        <Sparkles size={12} /> {xpReward} XP
                      </div>
                    )}
                    {cashReward <= 0 && pointsReward <= 0 && xpReward <= 0 && (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
