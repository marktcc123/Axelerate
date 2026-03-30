"use client";

import { useState } from "react";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelOrder, requestReturn } from "@/app/actions/orders";

const actionBtnClass =
  "h-8 gap-1 border-2 px-2.5 py-0 text-[10px] font-black uppercase leading-tight tracking-wide shadow-[2px_2px_0_rgba(0,0,0,0.18)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none dark:shadow-[2px_2px_0_rgba(255,255,255,0.08)] [&_svg]:h-3 [&_svg]:w-3";

function normalize(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/** 与 OrderCard / Order 列表项兼容的切片 */
export type OrderLifecycleSlice = {
  id: string;
  status: string;
  cancel_request_status?: string | null;
  cancel_request_reason?: string | null;
  admin_rejection_message?: string | null;
  return_status?: string | null;
  tracking_number?: string | null;
};

/**
 * 取消 / 物流 / 退货操作区（供订单卡片与 Profile 抽屉共用）
 */
export function OrderLifecycleActions({
  order,
  onUpdated,
}: {
  order: OrderLifecycleSlice;
  onUpdated?: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const status = normalize(order.status);
  const ret = normalize(order.return_status);
  const cr = normalize(order.cancel_request_status);
  const tracking = order.tracking_number ?? "";

  const isProcessing = status === "processing";
  const isShipped = status === "shipped";
  /** 与抽屉时间轴一致：paid 视为已完成可售后 */
  const isDelivered =
    status === "delivered" || status === "completed" || status === "paid";
  const returnIsNone = !ret || ret === "none";
  const returnPending = ret === "requested";
  const returnApproved = ret === "approved";
  const returnRejected = ret === "rejected";
  const cancelRequestPending = cr === "pending";
  const cancelRequestRejected = cr === "rejected";
  const adminNote = (order.admin_rejection_message ?? "").trim();

  const openTrack = () => {
    if (!tracking) {
      toast.message("No tracking number yet");
      return;
    }
    const q = encodeURIComponent(tracking);
    window.open(`https://www.google.com/search?q=track+package+${q}`, "_blank", "noopener,noreferrer");
  };

  const handleCancel = async () => {
    setPending(true);
    const res = await cancelOrder(order.id, reason);
    setPending(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Cancellation request submitted — we will notify you when reviewed");
    setCancelOpen(false);
    setReason("");
    onUpdated?.();
  };

  const handleReturn = async () => {
    setPending(true);
    const res = await requestReturn(order.id, reason);
    setPending(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Return request submitted");
    setReturnOpen(false);
    setReason("");
    onUpdated?.();
  };

  return (
    <>
      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {isProcessing && cancelRequestPending && (
          <Button
            type="button"
            size="sm"
            disabled
            variant="secondary"
            className={`${actionBtnClass} cursor-not-allowed`}
          >
            Cancellation pending review
          </Button>
        )}

        {isProcessing && !cancelRequestPending && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className={actionBtnClass}
            onClick={() => {
              setReason("");
              setCancelOpen(true);
            }}
          >
            Cancel order
          </Button>
        )}

        {isProcessing && cancelRequestRejected && (
          <p className="text-[10px] font-medium leading-snug text-amber-600 dark:text-amber-400">
            {adminNote ? (
              <>
                <span className="font-black uppercase tracking-wide">Team note: </span>
                {adminNote}
              </>
            ) : (
              <span className="font-black uppercase tracking-wide">
                Cancellation request was not approved
              </span>
            )}
          </p>
        )}

        {isShipped && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled
              className={`${actionBtnClass} cursor-not-allowed opacity-60`}
            >
              Cancel locked
            </Button>
            <Button
              type="button"
              size="sm"
              className={`${actionBtnClass} border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/25`}
              onClick={openTrack}
            >
              <ExternalLink className="h-3 w-3" />
              Track package
            </Button>
          </>
        )}

        {isDelivered && returnIsNone && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={actionBtnClass}
            onClick={() => {
              setReason("");
              setReturnOpen(true);
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Request return
          </Button>
        )}

        {isDelivered && returnPending && (
          <Button
            type="button"
            size="sm"
            disabled
            variant="secondary"
            className={`${actionBtnClass} cursor-not-allowed`}
          >
            Return pending review
          </Button>
        )}

        {isDelivered && returnApproved && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Return approved — refund issued to your balance
          </p>
        )}

        {isDelivered && returnRejected && (
          <p className="text-[10px] font-medium leading-snug text-muted-foreground">
            <span className="font-black uppercase tracking-wide">Return not approved — </span>
            {adminNote || "No refund issued."}
          </p>
        )}
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="border-2 border-border bg-card shadow-[6px_6px_0_rgba(0,0,0,0.2)] dark:shadow-[6px_6px_0_rgba(255,255,255,0.06)]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Cancel order</DialogTitle>
            <DialogDescription>
              Submit a cancellation request. Our team will review it. If approved, cash and credits
              will be returned to your balance; if declined, you will see a message here.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you cancelling?"
            rows={4}
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 dark:border-white/10 dark:bg-white/5"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" size="sm" variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() => void handleCancel()}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="border-2 border-border bg-card shadow-[6px_6px_0_rgba(0,0,0,0.2)] dark:shadow-[6px_6px_0_rgba(255,255,255,0.06)]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Request return</DialogTitle>
            <DialogDescription>
              Our team will review your request. You will be notified once approved.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue (damage, wrong item, etc.)"
            rows={4}
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 dark:border-white/10 dark:bg-white/5"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" size="sm" variant="outline" onClick={() => setReturnOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || reason.trim().length < 3}
              onClick={() => void handleReturn()}
              className="border-2 text-xs font-bold uppercase shadow-[2px_2px_0_rgba(0,0,0,0.2)]"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
