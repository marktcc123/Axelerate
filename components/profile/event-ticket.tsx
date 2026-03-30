"use client";

import { QRCodeSVG } from "qrcode.react";
import { Calendar, MapPin, Loader2, XCircle, CheckCircle2 } from "lucide-react";

const PLACEHOLDER_IMG = "/placeholder.svg";

/** 统一的电子门票布局：左侧全幅图+状态徽章，右侧活动信息+二维码区 */
function ElectronicTicketLayout({
  imgUrl,
  title,
  location,
  eventDate,
  appId,
  badgeText,
  badgeThemePrimary = true,
  qrArea,
  handleImgError,
}: {
  imgUrl: string;
  title: string;
  location: string;
  eventDate: string | null;
  appId: string;
  badgeText: string;
  badgeThemePrimary?: boolean;
  qrArea: React.ReactNode;
  handleImgError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border-2 border-[var(--theme-primary)] bg-card shadow-md shadow-[0_0_30px_rgba(var(--theme-primary-rgb),0.25)] dark:bg-zinc-950 sm:flex-row">
      {/* 视觉欺骗：门票边缘的半圆形缺角 (Ticket Cutouts) */}
      <div className="pointer-events-none absolute left-[-12px] top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border-r border-[var(--theme-primary)] bg-black sm:block" />
      <div className="pointer-events-none absolute right-[-12px] top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border-l border-[var(--theme-primary)] bg-black sm:block" />

      {/* 左侧：活动大图与状态徽章 */}
      <div className="relative h-40 w-full shrink-0 sm:h-auto sm:w-2/5">
        <img
          src={imgUrl}
          alt={title}
          className="h-full w-full object-cover opacity-80"
          onError={handleImgError}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        <div
          className={`absolute left-3 top-3 rounded px-3 py-1 text-xs font-black tracking-wider shadow-[0_0_10px_var(--theme-primary)] ${
            badgeThemePrimary
              ? "bg-[var(--theme-primary)] text-black"
              : "border border-[var(--theme-primary)] bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
          }`}
        >
          {badgeText}
        </div>
      </div>

      {/* 右侧：活动信息与二维码区 */}
      <div className="flex flex-1 flex-col justify-between gap-4 border-t-2 border-dashed border-[var(--theme-primary)]/40 bg-gradient-to-b from-white/[0.02] to-transparent p-5 sm:flex-row sm:items-center sm:border-t-0 sm:border-l-2">
        <div className="min-w-0 flex-1 pr-4">
          <h3 className="mb-3 line-clamp-2 text-lg font-bold leading-tight text-foreground dark:text-white md:text-xl">
            {title}
          </h3>
          {eventDate && (
            <div className="mb-2 flex items-center text-sm text-muted-foreground">
              <Calendar size={14} className="mr-2 shrink-0 text-[var(--theme-primary)]" />
              {new Date(eventDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin size={14} className="mr-2 shrink-0 text-[var(--theme-primary)]" />
            <span className="max-w-[150px] truncate">{location}</span>
          </div>
        </div>

        {/* 二维码/占位区 - 统一主题色边框 */}
        <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border-2 border-[var(--theme-primary)]/30 bg-muted/60 p-3 backdrop-blur-sm dark:bg-black/50">
          {qrArea}
        </div>
      </div>
    </div>
  );
}

export function EventTicket({
  application,
  userTier = "GUEST",
  eventsFallback = [],
  themePrimaryColor = "#ffffff",
}: {
  application: any;
  userTier?: string;
  eventsFallback?: any[];
  themePrimaryColor?: string;
}) {
  if (!application) {
    return (
      <div className="rounded-2xl border-2 border-red-500 bg-red-500/10 p-5 text-red-500">
        <p className="font-bold">Error: No Application Data</p>
      </div>
    );
  }

  const rawEvent = application.event;
  const eventFromApp = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
  const eventFromFallback = eventsFallback?.find?.(
    (e: any) => e?.id === application.event_id
  );
  const eventData = eventFromApp ?? eventFromFallback ?? {};

  const status = String(application?.status ?? "pending").toLowerCase().trim();
  const isApproved = status === "approved";
  const isAttended = status === "attended";
  const isRejected = status === "rejected";
  const isPending = !status || status === "applied" || status === "pending";

  const imgUrl = eventData?.image_url || PLACEHOLDER_IMG;
  const title = eventData?.title || "Unknown Event";
  const location = eventData?.location || "Location TBD";
  const eventDate = eventData?.event_date ?? eventData?.starts_at ?? null;
  const appId = application?.id ?? "unknown";
  const shortId = String(appId).substring(0, 8);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = PLACEHOLDER_IMG;
  };

  const baseUrl =
    (typeof window !== "undefined" && window.location?.origin) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
    "http://localhost:3000";
  const checkinUrl = `${baseUrl}/admin/checkin/${appId}`;

  // PENDING / APPROVED / ATTENDED：统一电子门票布局
  if ((isPending || isApproved || isAttended) && eventData) {
    let badgeText = "PENDING";
    let qrArea: React.ReactNode;

    if (isApproved) {
      badgeText = "VIP PASS";
      qrArea = (
        <>
          <div className="mb-2 rounded-md bg-white p-2 shadow-[0_0_15px_var(--theme-primary)]">
            <QRCodeSVG
              value={checkinUrl}
              size={100}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="Q"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--theme-primary)]">
            SCAN TO CHECK-IN
          </span>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
            {shortId}
          </span>
        </>
      );
    } else if (isAttended) {
      badgeText = "CHECKED-IN";
      qrArea = (
        <>
          <CheckCircle2
            size={64}
            className="text-[var(--theme-primary)] drop-shadow-[0_0_12px_var(--theme-primary)]"
          />
          <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--theme-primary)]">
            CHECKED-IN
          </span>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
            {shortId}
          </span>
        </>
      );
    } else {
      // PENDING
      badgeText = "PENDING";
      qrArea = (
        <>
          <div className="flex h-[100px] w-[100px] items-center justify-center rounded-md border-2 border-dashed border-[var(--theme-primary)]/50 bg-black/30">
            <Loader2
              size={40}
              className="animate-spin text-[var(--theme-primary)]"
            />
          </div>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--theme-primary)]">
            UNDER REVIEW
          </span>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
            {shortId}
          </span>
        </>
      );
    }

    return (
      <ElectronicTicketLayout
        imgUrl={imgUrl}
        title={title}
        location={location}
        eventDate={eventDate}
        appId={appId}
        badgeText={badgeText}
        badgeThemePrimary={true}
        qrArea={qrArea}
        handleImgError={handleImgError}
      />
    );
  }

  // REJECTED：紧凑错误卡片
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-red-500/50 bg-card p-5 shadow-lg dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400">
          rejected
        </span>
        <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
      </div>
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-muted dark:border-white/10 dark:bg-white/10">
          <img
            src={imgUrl}
            alt="Event"
            className="h-full w-full object-cover"
            onError={handleImgError}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h4 className="line-clamp-1 text-lg font-bold text-foreground dark:text-white">{title}</h4>
          <p className="line-clamp-1 text-sm text-muted-foreground">{location}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 py-3">
        <XCircle className="h-5 w-5 text-red-400" />
        <span className="text-sm font-medium text-red-400">
          Not selected this time. Keep leveling up!
        </span>
      </div>
    </div>
  );
}
