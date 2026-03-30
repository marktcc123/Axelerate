"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCheckinData, confirmCheckin } from "@/app/actions/checkin";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert, User, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getValidImageUrl } from "@/lib/utils/image";

export default function AdminCheckinPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<{
    fullName: string | null;
    avatarUrl: string | null;
    campus: string | null;
    eventTitle: string;
    eventImageUrl: string | null;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setLoading(false);
        setError("Invalid ID");
        return;
      }

      const result = await getCheckinData(id);
      setLoading(false);

      if (result.success) {
        setData(result.data);
        setCheckedIn(result.data.status === "attended");
      } else {
        setError(result.error);
        setData(null);
      }
    }

    fetchData();
  }, [id]);

  const handleConfirm = async () => {
    if (!id || checkingIn || checkedIn) return;
    setCheckingIn(true);
    const result = await confirmCheckin(id);
    setCheckingIn(false);
    if (result.success) {
      setCheckedIn(true);
      toast.success("Check-in confirmed!", {
        description: "The attendee has been marked as attended.",
      });
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
        <Loader2 className="h-12 w-12 animate-spin text-[var(--theme-primary)]" />
        <p className="mt-4 text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error === "Unauthorized Scanner") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center">
        <ShieldAlert className="mb-4 h-16 w-16 text-red-500" />
        <h1 className="text-xl font-bold text-white">Unauthorized Scanner</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          Only staff and city managers can access the check-in scanner.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center">
        <XCircle className="mb-4 h-20 w-20 text-red-500" />
        <h1 className="text-2xl font-black uppercase tracking-widest text-red-500">
          INVALID PASS
        </h1>
        <p className="mt-2 text-sm text-gray-500">{error ?? "Application not found"}</p>
      </div>
    );
  }

  const eventBgUrl = data.eventImageUrl ? getValidImageUrl(data.eventImageUrl) : null;

  return (
    <div className="min-h-screen bg-black">
      {/* 相机取景器风格扫描框 */}
      <div className="flex justify-center pt-8 pb-4">
        <div className="relative h-32 w-32 overflow-hidden rounded-lg border-2 border-[var(--theme-primary)]/60 shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)]">
          <div className="absolute inset-0 border-2 border-dashed border-[var(--theme-primary)]/30" />
          <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-[var(--theme-primary)]/40" />
          <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-[var(--theme-primary)]/40" />
          <div className="absolute inset-2 flex items-center justify-center">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--theme-primary)]/60">
              SCANNER
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pb-12">
        {/* 活动信息区 - 带蒙版背景图 */}
        <div className="relative mb-6 overflow-hidden rounded-xl border border-[var(--theme-primary)]/30">
          <div className="relative h-32">
            {eventBgUrl ? (
              <>
                <img
                  src={eventBgUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-900" />
            )}
            <div className="absolute inset-0 flex items-end p-4">
              <h2 className="text-lg font-bold text-white drop-shadow-lg">
                {data.eventTitle}
              </h2>
            </div>
          </div>
        </div>

        {/* 用户信息区 */}
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--theme-primary)]/20 bg-zinc-900/80 p-4">
          <Avatar className="h-14 w-14 shrink-0 border-2 border-[var(--theme-primary)]/40">
            <AvatarImage src={data.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-zinc-800 text-[var(--theme-primary)]">
              <User className="h-7 w-7" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-white">
              {data.fullName ?? "Unknown"}
            </p>
            {data.campus && (
              <p className="truncate text-sm text-gray-400">{data.campus}</p>
            )}
          </div>
        </div>

        {/* 核销状态 / 按钮区 */}
        {checkedIn ? (
          <div className="flex flex-col items-center rounded-xl border-2 border-green-500/50 bg-green-500/10 py-12 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
            <CheckCircle2 className="mb-4 h-20 w-20 text-green-500" />
            <p className="text-xl font-black uppercase tracking-widest text-green-400">
              ALREADY CHECKED IN
            </p>
            <p className="mt-1 text-sm text-green-500/80">
              Duplicate scan prevented
            </p>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={checkingIn}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[var(--theme-primary)] bg-[var(--theme-primary)]/20 py-5 text-xl font-black uppercase tracking-widest text-[var(--theme-primary)] shadow-[0_0_25px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:bg-[var(--theme-primary)]/30 hover:shadow-[0_0_35px_rgba(var(--theme-primary-rgb),0.5)] disabled:opacity-50"
          >
            {checkingIn ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                CONFIRMING...
              </>
            ) : (
              "CONFIRM CHECK-IN"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
