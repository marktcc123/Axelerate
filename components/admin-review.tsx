"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Link2,
  ChevronDown,
  Sparkles,
  Landmark,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Truck,
  CalendarDays,
  ArrowLeft,
  Loader2,
  BarChart3,
  MapPinned,
  RotateCcw,
  Ban,
  User,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeWithdrawal,
  rejectWithdrawal,
  type WithdrawalRow,
} from "@/app/actions/wallet";
import {
  adminListSchools,
  adminCreateSchool,
  adminUpdateSchool,
  adminDeleteSchool,
  getAdminDashboardData,
  getAnalyticsData,
  type AnalyticsRevenueTrendDays,
  markOrderShipped,
  approveCancelRequest,
  rejectCancelRequest,
  approveOrderReturn,
  rejectOrderReturn,
  approveEventApplication,
  approveUgcTask,
  rejectUgcTask,
  completeUgcTask,
  approvePhysicalGig,
  rejectPhysicalGig,
  completePhysicalGig,
  markGigAsPaid,
  markEventAttended,
  adminGetW9SignedUrl,
  adminApproveProfileW9,
  adminApproveCareerReward,
  adminRejectCareerReward,
  adminListBrandsCareerFlags,
  adminUpdateBrandCareerFlags,
  type AuditEntry,
  type PendingW9ReviewRow,
  type PendingCareerRewardRow,
} from "@/app/actions/admin";
import { formatShippingAddressPayload } from "@/lib/format-shipping-address";
import type { School } from "@/lib/schools";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { careerRewardNeedsCertificatePdf } from "@/lib/career-rewards";
import { toast } from "sonner";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type AdminTab =
  | "analytics"
  | "tasks"
  | "ugc"
  | "physical"
  | "events"
  | "withdrawals"
  | "campuses"
  | "career";

const STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "APPROVED",
  "SUBMITTED",
  "REJECTED",
  "COMPLETED",
  "PAID",
] as const;

interface AdminReviewProps {
  onExitAdmin?: () => void;
}

/** Audit trail: timestamps and actor */
function AuditTrailSection({
  entries,
  extraItems,
}: {
  entries: AuditEntry[];
  extraItems?: { label: string; value: string | null }[];
}) {
  const auditEntries = entries;
  const actionLabels: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
    paid: "Paid",
    shipped: "Shipped",
    attended: "Attended",
    cancel_approved: "Cancellation approved (refunded)",
    cancel_rejected: "Cancellation declined",
    return_rejected: "Return declined",
  };
  return (
    <div className="mt-4 space-y-1 border-t border-border pt-4 dark:border-white/10">
      <div className="mb-2 font-bold text-zinc-300 text-xs">
        ⏱️ AUDIT TRAIL
      </div>
      {extraItems?.map(
        (it) =>
          it.value && (
            <div key={it.label} className="text-xs text-zinc-400">
              {it.label}: {new Date(it.value).toLocaleString()}
            </div>
          )
      )}
      {auditEntries.map((e) => (
        <div key={e.id} className="text-xs text-zinc-400">
          {actionLabels[e.action] ?? e.action}: {new Date(e.created_at).toLocaleString()}
          {e.actor?.full_name && (
            <span className="ml-1 text-[var(--theme-primary)]">
              by {e.actor.full_name}
            </span>
          )}
        </div>
      ))}
      {!auditEntries.length && !extraItems?.some((i) => i.value) && (
        <div className="text-xs text-zinc-500">No timestamps yet</div>
      )}
    </div>
  );
}

export function AdminReview({ onExitAdmin }: AdminReviewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [ugcData, setUgcData] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ugcActiveFilter, setUgcActiveFilter] = useState<string>("ALL");
  const [physicalActiveFilter, setPhysicalActiveFilter] = useState<string>("ALL");
  const [eventsFilter, setEventsFilter] = useState<"pending" | "all">("pending");
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [pendingW9Reviews, setPendingW9Reviews] = useState<PendingW9ReviewRow[]>([]);
  const [w9ViewingUserId, setW9ViewingUserId] = useState<string | null>(null);
  const [w9ApprovingUserId, setW9ApprovingUserId] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPrimary, setFormPrimary] = useState("#EC4899");
  const [formSecondary, setFormSecondary] = useState("#831843");
  const [formLogo, setFormLogo] = useState("");
  const [savingSchool, setSavingSchool] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [pendingCancelRequests, setPendingCancelRequests] = useState<any[]>([]);
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [pendingCareerRewards, setPendingCareerRewards] = useState<PendingCareerRewardRow[]>([]);
  const [careerBrands, setCareerBrands] = useState<
    Awaited<ReturnType<typeof adminListBrandsCareerFlags>>
  >([]);
  const [loadingCareerBrands, setLoadingCareerBrands] = useState(false);
  const [careerApprovingId, setCareerApprovingId] = useState<string | null>(null);
  const [careerRejectingId, setCareerRejectingId] = useState<string | null>(null);
  /** English UI for file picker (OS locale otherwise shows e.g. Chinese on the native control). */
  const [careerCertFileLabel, setCareerCertFileLabel] = useState<Record<string, string>>({});
  const [orderProducts, setOrderProducts] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [returnActionId, setReturnActionId] = useState<string | null>(null);
  const [cancelRequestActionId, setCancelRequestActionId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    type: "cancel" | "return";
    orderId: string;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [withdrawRejectId, setWithdrawRejectId] = useState<string | null>(null);
  const [withdrawRejectNote, setWithdrawRejectNote] = useState("");
  const [withdrawRejectSubmitting, setWithdrawRejectSubmitting] = useState(false);
  const [eventApplications, setEventApplications] = useState<any[]>([]);
  const [physicalData, setPhysicalData] = useState<any[]>([]);
  const [eventsData, setEventsData] = useState<any[]>([]);
  const [expandedPhysicalId, setExpandedPhysicalId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [physicalActionId, setPhysicalActionId] = useState<string | null>(null);
  const [eventActionId, setEventActionId] = useState<string | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [approvingAppId, setApprovingAppId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Awaited<ReturnType<typeof getAnalyticsData>> | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [revenueTrendDays, setRevenueTrendDays] = useState<AnalyticsRevenueTrendDays>(7);
  const [ugcActionId, setUgcActionId] = useState<string | null>(null);
  const [ugcPaidActionId, setUgcPaidActionId] = useState<string | null>(null);
  const [physicalPaidActionId, setPhysicalPaidActionId] = useState<string | null>(null);
  const [auditLogByEntity, setAuditLogByEntity] = useState<Record<string, AuditEntry[]>>({});

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await getAdminDashboardData();
      setOrders(data.pendingOrders);
      setPendingCancelRequests(data.pendingCancelRequests ?? []);
      setPendingReturns(data.pendingReturns ?? []);
      setOrderProducts(data.orderProducts ?? []);
      setEventApplications(data.pendingEventApplications);
      setWithdrawals(data.pendingWithdrawals);
      setPendingW9Reviews(data.pendingW9Reviews ?? []);
      setPendingCareerRewards(data.pendingCareerRewards ?? []);
      setUgcData(data.ugcData ?? []);
      setPhysicalData([...(data.pendingPhysical ?? []), ...(data.reviewedPhysical ?? [])]);
      setEventsData([...(data.pendingEvents ?? []), ...(data.reviewedEvents ?? [])]);
      setAuditLogByEntity(data.auditLogByEntity ?? {});
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === "campuses") {
      setLoadingSchools(true);
      adminListSchools().then((data) => {
        setSchools(data);
        setLoadingSchools(false);
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "career") return;
    setLoadingCareerBrands(true);
    adminListBrandsCareerFlags()
      .then((rows) => setCareerBrands(rows))
      .finally(() => setLoadingCareerBrands(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "analytics") return;
    setLoadingAnalytics(true);
    getAnalyticsData(revenueTrendDays)
      .then(setAnalyticsData)
      .catch((err) => {
        console.error("[Admin] getAnalyticsData failed:", err);
        setAnalyticsData(null);
      })
      .finally(() => setLoadingAnalytics(false));
  }, [activeTab, revenueTrendDays]);

  const openSchoolForm = (school?: School | null) => {
    if (school) {
      setEditingSchool(school);
      setFormName(school.name);
      setFormPrimary(school.primary_color);
      setFormSecondary(school.secondary_color);
      setFormLogo(school.logo_url ?? "");
    } else {
      setEditingSchool(null);
      setFormName("");
      setFormPrimary("#EC4899");
      setFormSecondary("#831843");
      setFormLogo("");
    }
    setShowSchoolForm(true);
  };

  const closeSchoolForm = () => {
    setShowSchoolForm(false);
    setEditingSchool(null);
  };

  const handleSaveSchool = async () => {
    setSavingSchool(true);
    const result = editingSchool
      ? await adminUpdateSchool(editingSchool.id, formName, formPrimary, formSecondary, formLogo)
      : await adminCreateSchool(formName, formPrimary, formSecondary, formLogo);
    setSavingSchool(false);
    if (result.success) {
      toast.success(editingSchool ? "School updated" : "School created");
      closeSchoolForm();
      const list = await adminListSchools();
      setSchools(list);
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteSchool = async (s: School) => {
    if (!confirm("Delete this school? Profiles using it will fall back to Default.")) return;
    const result = await adminDeleteSchool(s.id, s.name);
    if (result.success) {
      toast.success("School deleted");
      setSchools((prev) => prev.filter((x) => x.id !== s.id));
    } else {
      toast.error(result.error);
    }
  };

  const pendingUGC = ugcData.filter(
    (s) => ["pending", "submitted"].includes(s.status)
  );
  const pendingCount = pendingUGC.length;
  const reviewedCount = ugcData.length - pendingCount;

  const filteredUGC = ugcData.filter((item) => {
    if (ugcActiveFilter === "ALL") return true;
    const status = (item.status ?? "").toLowerCase();
    return status === ugcActiveFilter.toLowerCase();
  });

  const handleApproveUgc = async (id: string) => {
    setUgcActionId(id);
    const result = await approveUgcTask(id);
    setUgcActionId(null);
    if (result.success) {
      toast.success("UGC approved!");
      fetchDashboard();
    setExpandedId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleRejectUgc = async (id: string) => {
    setUgcActionId(id);
    const result = await rejectUgcTask(id);
    setUgcActionId(null);
    if (result.success) {
      toast.success("UGC rejected");
      fetchDashboard();
      setExpandedId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleCompleteUgc = async (id: string) => {
    setUgcActionId(id);
    const result = await completeUgcTask(id);
    setUgcActionId(null);
    if (result.success) {
      toast.success("UGC completed!");
      fetchDashboard();
      setExpandedId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleMarkUgcAsPaid = async (
    id: string,
    userId: string,
    rewardCash: number,
    rewardCredits: number,
    rewardXp: number
  ) => {
    setUgcPaidActionId(id);
    const result = await markGigAsPaid(id, userId, rewardCash, rewardCredits, rewardXp);
    setUgcPaidActionId(null);
    if (result.success) {
      toast.success("Marked as paid! Wallet updated.");
      fetchDashboard();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleMarkPhysicalAsPaid = async (
    id: string,
    userId: string,
    rewardCash: number,
    rewardCredits: number,
    rewardXp: number
  ) => {
    setPhysicalPaidActionId(id);
    const result = await markGigAsPaid(id, userId, rewardCash, rewardCredits, rewardXp);
    setPhysicalPaidActionId(null);
    if (result.success) {
      toast.success("Marked as paid! Wallet updated.");
      fetchDashboard();
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const physicalPendingStatuses = ["pending", "submitted"];
  const physicalFiltered = physicalData.filter((item) => {
    if (physicalActiveFilter === "ALL") return true;
    const status = (item.status ?? "").toLowerCase();
    return status === physicalActiveFilter.toLowerCase();
  });

  const handleApprovePhysical = async (id: string) => {
    setPhysicalActionId(id);
    const result = await approvePhysicalGig(id);
    setPhysicalActionId(null);
    if (result.success) {
      toast.success("Physical gig approved!");
      fetchDashboard();
      setExpandedPhysicalId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleRejectPhysical = async (id: string) => {
    setPhysicalActionId(id);
    const result = await rejectPhysicalGig(id);
    setPhysicalActionId(null);
    if (result.success) {
      toast.success("Physical gig rejected");
      fetchDashboard();
      setExpandedPhysicalId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleCompletePhysical = async (id: string) => {
    setPhysicalActionId(id);
    const result = await completePhysicalGig(id);
    setPhysicalActionId(null);
    if (result.success) {
      toast.success("Physical gig completed!");
      fetchDashboard();
      setExpandedPhysicalId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const eventPendingStatuses = ["pending", "applied", null, undefined];
  const eventsFiltered =
    eventsFilter === "pending"
      ? eventsData.filter((e) => eventPendingStatuses.includes(e.status))
      : eventsData;

  const handleApproveEvent = async (id: string) => {
    setEventActionId(id);
    const result = await approveEventApplication(id);
    setEventActionId(null);
    if (result.success) {
      toast.success("Event application approved!");
      fetchDashboard();
      setExpandedEventId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const handleMarkEventAttended = async (id: string) => {
    setEventActionId(id);
    const result = await markEventAttended(id);
    setEventActionId(null);
    if (result.success) {
      toast.success("Marked as attended!");
      fetchDashboard();
      setExpandedEventId(null);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  return (
    <div className="pb-4">
      <header className="mb-6 flex flex-col gap-3 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--theme-primary)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-primary)]">
              Admin Control Center
          </span>
        </div>
          {onExitAdmin && (
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)] dark:border-white/20 dark:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exit Admin
            </button>
          )}
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Orders, Events, UGC & more
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "analytics"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Analytics
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "tasks"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <Package className="h-3.5 w-3.5" />
          Tasks
        </button>
        <button
          onClick={() => {
            setActiveTab("ugc");
            setUgcActiveFilter("ALL");
          }}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "ugc"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          UGC Review
        </button>
        <button
          onClick={() => {
            setActiveTab("physical");
            setPhysicalActiveFilter("ALL");
          }}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "physical"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <MapPinned className="h-3.5 w-3.5" />
          Physical Gigs
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "events"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Events
        </button>
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "withdrawals"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <Landmark className="h-3.5 w-3.5" />
          Withdrawals
        </button>
        <button
          onClick={() => setActiveTab("campuses")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "campuses"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          Campuses
        </button>
        <button
          onClick={() => setActiveTab("career")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            activeTab === "career"
              ? "bg-[var(--theme-primary)] text-white"
              : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
          )}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Career
        </button>
      </div>

      {/* Analytics Tab - KPI Dashboard + Recharts */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : analyticsData === null ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
              <p className="font-bold text-amber-400">Failed to load analytics</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check console for errors. Ensure <code className="rounded bg-black/20 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is set in .env.local.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[10px] text-muted-foreground">
                Data from: orders, profiles, withdrawals
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Total GMV
                  </p>
                  <p className="text-3xl font-black text-[var(--theme-primary)] drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]">
                    ${(analyticsData?.totalGmv ?? 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Credits · {(analyticsData?.totalCreditsUsed ?? 0)} pts
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Daily Active (DAU)
                  </p>
                  <p className="text-3xl font-black text-[var(--theme-primary)] drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]">
                    {analyticsData?.estimatedDau ?? 0}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Total Users: {analyticsData?.totalUsers ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Pending Payouts
                  </p>
                  <p className="text-3xl font-black text-[var(--theme-primary)] drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]">
                    ${(analyticsData?.pendingPayouts ?? 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Pending withdrawals
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Est. CAC
                  </p>
                  <p className="text-3xl font-black text-[var(--theme-primary)] drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]">
                    {analyticsData?.estimatedCac != null
                      ? `$${analyticsData.estimatedCac.toFixed(2)}`
                      : "N/A"}
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    Requires marketing spend data
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                      Revenue Trend (by order <code className="rounded bg-muted px-1 text-[10px] dark:bg-white/10">created_at</code>)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { days: 7 as const, label: "7 days" },
                          { days: 30 as const, label: "30 days" },
                          { days: 90 as const, label: "90 days" },
                        ] as const
                      ).map(({ days, label }) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setRevenueTrendDays(days)}
                          disabled={loadingAnalytics}
                          className={cn(
                            "rounded-full border-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
                            revenueTrendDays === days
                              ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 text-[var(--theme-primary)]"
                              : "border-border bg-muted/40 text-muted-foreground hover:border-[var(--theme-primary)]/40 dark:border-white/10 dark:bg-white/5"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    Daily sum of <span className="font-semibold text-foreground">cash_paid</span> (USD, left axis) and{" "}
                    <span className="font-semibold text-foreground">credits_used</span> (pts, right axis), same grouping as cash.
                  </p>
                  <div className="h-[260px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={analyticsData?.revenueTrend ?? []}
                        margin={{
                          top: 10,
                          right: 48,
                          left: 4,
                          bottom: (analyticsData?.revenueTrendDays ?? 7) > 14 ? 36 : 8,
                        }}
                      >
                        <defs>
                          <linearGradient id="areaGradientCash" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--theme-primary)" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="var(--theme-primary)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="areaGradientCredits" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="name"
                          stroke="#888"
                          fontSize={9}
                          interval={
                            (analyticsData?.revenueTrendDays ?? 7) > 20
                              ? Math.max(1, Math.floor((analyticsData?.revenueTrendDays ?? 90) / 12))
                              : 0
                          }
                          angle={(analyticsData?.revenueTrendDays ?? 7) > 14 ? -40 : 0}
                          textAnchor={(analyticsData?.revenueTrendDays ?? 7) > 14 ? "end" : "middle"}
                          height={(analyticsData?.revenueTrendDays ?? 7) > 14 ? 44 : 28}
                        />
                        <YAxis
                          yAxisId="cash"
                          stroke="#888"
                          fontSize={10}
                          width={44}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <YAxis
                          yAxisId="credits"
                          orientation="right"
                          stroke="#f59e0b"
                          fontSize={10}
                          width={40}
                          tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #333",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === "Cash (cash_paid)") return [`$${Number(value).toFixed(2)}`, name];
                            return [`${Math.round(value)} pts`, name];
                          }}
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as { dateKey?: string; name?: string } | undefined;
                            return row?.dateKey ?? row?.name ?? "";
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Area
                          yAxisId="cash"
                          type="monotone"
                          dataKey="cash"
                          name="Cash (cash_paid)"
                          stroke="var(--theme-primary)"
                          strokeWidth={2}
                          fill="url(#areaGradientCash)"
                        />
                        <Area
                          yAxisId="credits"
                          type="monotone"
                          dataKey="credits"
                          name="Credits (credits_used)"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#areaGradientCredits)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                    Campus Distribution
                  </h3>
                  <div className="flex min-h-[260px] items-center justify-center">
                    {analyticsData?.campusData && analyticsData.campusData.length > 0 ? (
                      <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-6">
                        <div className="h-[200px] w-full max-w-[200px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <Pie
                              data={analyticsData.campusData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={90}
                              paddingAngle={2}
                              stroke="transparent"
                            >
                              {(analyticsData.campusData ?? []).map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    [
                                      "var(--theme-primary)",
                                      "#22c55e",
                                      "#3b82f6",
                                      "#a855f7",
                                      "#f59e0b",
                                    ][i % 5]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1a1a1a",
                                border: "1px solid #333",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number, name: string) => {
                                const total = (analyticsData?.campusData ?? []).reduce((s, d) => s + (d.value ?? 0), 0);
                                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                                return [`${value} (${pct}%)`, name];
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:flex-1 sm:flex-col sm:justify-center sm:gap-2">
                          {(analyticsData?.campusData ?? []).map((d, i) => {
                            const total = (analyticsData?.campusData ?? []).reduce((s, x) => s + (x.value ?? 0), 0);
                            const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
                            const colors = [
                              "var(--theme-primary)",
                              "#22c55e",
                              "#3b82f6",
                              "#a855f7",
                              "#f59e0b",
                            ];
                            return (
                              <div key={d.name} className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: colors[i % 5] }}
                                />
                                <span className="text-xs text-foreground/90 dark:text-zinc-300">{d.name}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {d.value} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground">
                        Not enough demographic data
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tasks Tab - Return approvals + Pending Orders + Pending Event RSVPs */}
      {activeTab === "tasks" && (
        <div className="flex flex-col gap-6">
          {/* Pending return / refund approvals */}
          <div className="rounded-2xl border-2 border-amber-500/40 bg-card p-4 shadow-md dark:border-amber-500/30 dark:bg-zinc-950">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-500">
              <RotateCcw className="h-4 w-4" />
              Return requests · Approve to refund
            </h2>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : pendingReturns.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No pending return requests. User refunds run only after you approve here.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingReturns.map((order) => {
                  const profile = Array.isArray(order.profile) ? order.profile[0] : order.profile;
                  const buyerName = profile?.full_name ?? "—";
                  const amount = Number(order.cash_paid ?? order.total_amount ?? 0).toFixed(2);
                  const reason = (order as { return_reason?: string }).return_reason ?? "—";
                  return (
                    <div
                      key={order.id}
                      className="flex flex-col gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] text-amber-500">#{order.id.slice(0, 8)}</span>
                          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                            Pending review
                          </span>
                        </div>
                        <p className="text-sm font-bold text-foreground dark:text-white">
                          {buyerName} · ${amount}
                          {(order.credits_used ?? 0) > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              + {order.credits_used} pts (will be restored on approve)
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Reason</p>
                        <p className="text-xs text-foreground/90 dark:text-zinc-300">{reason}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setReturnActionId(order.id);
                            const result = await approveOrderReturn(order.id);
                            setReturnActionId(null);
                            if (result.success) {
                              toast.success("Return approved — cash & credits refunded to user");
                              setPendingReturns((prev) => prev.filter((o) => o.id !== order.id));
                            } else {
                              toast.error(result.error ?? "Failed");
                            }
                          }}
                          disabled={returnActionId === order.id}
                          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {returnActionId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Approve & refund
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectNote("");
                            setRejectDialog({ type: "return", orderId: order.id });
                          }}
                          disabled={returnActionId === order.id}
                          className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50 dark:border-white/15"
                        >
                          <Ban className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending cancellation requests */}
          <div className="rounded-2xl border-2 border-rose-500/40 bg-card p-4 shadow-md dark:border-rose-500/30 dark:bg-zinc-950">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400">
              <Ban className="h-4 w-4" />
              Cancellation requests · Confirm to refund & cancel order
            </h2>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
              </div>
            ) : pendingCancelRequests.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No pending cancellation requests. Users submit from My Orders; refunds run only after you
                confirm here.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingCancelRequests.map((order) => {
                  const profile = Array.isArray(order.profile) ? order.profile[0] : order.profile;
                  const buyerName = profile?.full_name ?? "—";
                  const amount = Number(order.cash_paid ?? order.total_amount ?? 0).toFixed(2);
                  const reason =
                    (order as { cancel_request_reason?: string }).cancel_request_reason ?? "—";
                  return (
                    <div
                      key={order.id}
                      className="flex flex-col gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] text-rose-400">#{order.id.slice(0, 8)}</span>
                          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-rose-500 dark:text-rose-300">
                            Cancel pending
                          </span>
                        </div>
                        <p className="text-sm font-bold text-foreground dark:text-white">
                          {buyerName} · ${amount}
                          {(order.credits_used ?? 0) > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              + {order.credits_used} pts (restored on confirm)
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          User reason
                        </p>
                        <p className="text-xs text-foreground/90 dark:text-zinc-300">{reason}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setCancelRequestActionId(order.id);
                            const result = await approveCancelRequest(order.id);
                            setCancelRequestActionId(null);
                            if (result.success) {
                              toast.success("Cancellation approved — order cancelled, user refunded");
                              setPendingCancelRequests((prev) => prev.filter((o) => o.id !== order.id));
                            } else {
                              toast.error(result.error ?? "Failed");
                            }
                          }}
                          disabled={cancelRequestActionId === order.id}
                          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {cancelRequestActionId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Confirm & refund
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectNote("");
                            setRejectDialog({ type: "cancel", orderId: order.id });
                          }}
                          disabled={cancelRequestActionId === order.id}
                          className="flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50 dark:border-white/15"
                        >
                          <Ban className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending Orders */}
          <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
              <Truck className="h-4 w-4" />
              Pending Orders
            </h2>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-border py-12 text-center dark:border-white/10">
                <Package className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">No pending tasks</p>
                <p className="text-xs text-muted-foreground">All orders shipped</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((order) => {
                  const items = (order.items ?? []) as { id: string; quantity: number }[];
                  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0);
                  const summary = items.length > 0 ? `${items.length} item(s)` : "—";
                  const amount = Number(order.cash_paid ?? order.total_amount ?? 0).toFixed(2);
                  const profile = Array.isArray(order.profile) ? order.profile[0] : order.profile;
                  const buyerName = profile?.full_name ?? "—";
                  const shipText =
                    formatShippingAddressPayload(
                      (order as { shipping_address?: unknown }).shipping_address
                    ) ?? formatShippingAddressPayload(profile?.shipping_address);
                  const productMap = new Map(orderProducts.map((p: any) => [p.id, p]));
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="overflow-hidden rounded-xl border-2 border-border bg-card dark:border-white/10 dark:bg-white/[0.02]"
                    >
                      {/* Header - always visible */}
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[var(--theme-primary)]">
                              #{order.id.slice(0, 8)}
                            </span>
                            <span className="text-lg font-black text-white">
                              ${amount}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{summary}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {order.created_at
                              ? new Date(order.created_at).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </button>

                      {/* Expanded - Comprehensive Fulfillment Panel */}
                      {isExpanded && (
                        <div className="animate-slide-up border-t border-border px-4 pb-4 pt-3 dark:border-white/10">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Block A: Shipping Details */}
                            <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                                📍 Shipping Details
                              </p>
                              <div className="space-y-2">
                                <div>
                                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Buyer Name
                                  </p>
                                  <p className="text-xs text-foreground/90 dark:text-zinc-300">{buyerName}</p>
                                </div>
                                <div>
                                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Email
                                  </p>
                                  <p className="text-xs text-foreground/90 dark:text-zinc-300">
                                    {(order as any).shipping_email ?? "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Shipping Address
                                  </p>
                                  {shipText ? (
                                    <p className="whitespace-pre-wrap text-xs text-foreground/90 dark:text-zinc-300">
                                      {shipText}
                                    </p>
                                  ) : (
                                    <p className="text-xs font-bold text-red-400">
                                      No shipping address provided
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Block B: Order Items (Packing List) */}
                            <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                                🛍️ Order Items
                              </p>
                              <div className="space-y-2">
                                {items.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No items</p>
                                ) : (
                                  items.map((it, idx) => {
                                    const product = productMap.get(it.id);
                                    const unitPrice =
                                      product?.discount_price ?? product?.original_price ?? 0;
                                    const lineTotal = Number(unitPrice) * (it.quantity ?? 0);
                                    return (
                                      <div
                                        key={`${it.id}-${idx}`}
                                        className="flex items-center justify-between gap-2 rounded-lg border-2 border-border bg-muted/30 px-3 py-2 dark:border-white/5 dark:bg-black/10"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-medium text-white">
                                            {product?.title ?? `Product ${it.id.slice(0, 8)}`}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {product?.category ? `${product.category}` : ""}
                                            {unitPrice > 0 ? ` · $${Number(unitPrice).toFixed(2)} ea` : ""}
                                          </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                          <span className="rounded-md bg-[var(--theme-primary)]/20 px-2 py-0.5 text-[10px] font-black text-[var(--theme-primary)]">
                                            ×{it.quantity ?? 0}
                                          </span>
                                          {lineTotal > 0 && (
                                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                                              ${lineTotal.toFixed(2)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          <AuditTrailSection
                            entries={auditLogByEntity[`order:${order.id}`] ?? []}
                            extraItems={[{ label: "Order Placed", value: order.created_at }]}
                          />

                          {/* Block C: Action Bar */}
                          <div className="mt-4 flex w-full flex-wrap items-center gap-3">
                            <span className="rounded-lg border-2 border-border bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:border-white/10 dark:bg-white/5">
                              Payment Status: PAID
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Cash: ${Number(order.cash_paid ?? 0).toFixed(2)}
                              {(order.credits_used ?? 0) > 0 && (
                                <> · Credits: {order.credits_used} pts</>
                              )}
                            </span>
                            <button
                              onClick={async () => {
                                setShippingOrderId(order.id);
                                const result = await markOrderShipped(order.id);
                                setShippingOrderId(null);
                                if (result.success) {
                                  toast.success("Order marked as shipped!");
                                  setOrders((prev) => prev.filter((o) => o.id !== order.id));
                                  setExpandedOrderId(null);
                                } else {
                                  toast.error(result.error ?? "Failed");
                                }
                              }}
                              disabled={shippingOrderId === order.id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--theme-primary)] py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:bg-[var(--theme-primary)]/90 active:scale-[0.98] disabled:opacity-60 min-w-[180px]"
                            >
                              {shippingOrderId === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Truck className="h-4 w-4" />
                              )}
                              Mark as Shipped
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Event RSVPs */}
          <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-md shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.05)] dark:border-white/10 dark:bg-zinc-950">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
              <CalendarDays className="h-4 w-4" />
              Pending Event RSVPs
            </h2>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : eventApplications.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-border py-12 text-center dark:border-white/10">
                <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">No pending tasks</p>
                <p className="text-xs text-muted-foreground">All applications reviewed</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {eventApplications.map((app) => {
                  const ev = Array.isArray(app.event) ? app.event[0] : app.event;
                  const eventTitle = ev?.title ?? "Unknown Event";
                  const applicantId = app.user_id?.slice(0, 8) ?? "—";
                  return (
                    <div
                      key={app.id}
                      className="rounded-xl border-2 border-border bg-card p-4 dark:border-white/10 dark:bg-white/[0.02]"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[var(--theme-primary)]">
                          {app.id.slice(0, 8)}
                        </span>
                        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                          {app.status}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-bold text-white">{eventTitle}</p>
                      <p className="mb-3 text-xs text-muted-foreground">Applicant: {applicantId}...</p>
                      <button
                        onClick={async () => {
                          setApprovingAppId(app.id);
                          const result = await approveEventApplication(app.id);
                          setApprovingAppId(null);
                          if (result.success) {
                            toast.success("Application approved!");
                            setEventApplications((prev) => prev.filter((a) => a.id !== app.id));
                          } else {
                            toast.error(result.error ?? "Failed");
                          }
                        }}
                        disabled={approvingAppId === app.id}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--theme-primary)] py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:bg-[var(--theme-primary)]/90 active:scale-[0.98] disabled:opacity-60"
                      >
                        {approvingAppId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === "withdrawals" && (
        <div className="mb-6 space-y-8">
          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              W-9 pending review
            </h2>
            {loadingDashboard ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : pendingW9Reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">No W-9 submissions awaiting review.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingW9Reviews.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border bg-card p-4 dark:border-white/10"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {row.full_name?.trim() || "—"}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">{row.id}</p>
                      </div>
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                        pending
                      </span>
                    </div>
                    <p className="mb-3 text-[10px] text-muted-foreground">
                      Submitted {new Date(row.w9_submitted_at).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={w9ViewingUserId === row.id || w9ApprovingUserId === row.id}
                        onClick={async () => {
                          setW9ViewingUserId(row.id);
                          const res = await adminGetW9SignedUrl(row.id);
                          setW9ViewingUserId(null);
                          if ("error" in res) {
                            toast.error(res.error);
                            return;
                          }
                          window.open(res.url, "_blank", "noopener,noreferrer");
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-black uppercase tracking-wider text-foreground transition-all hover:bg-muted/40 disabled:opacity-60 dark:border-white/15"
                      >
                        {w9ViewingUserId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        View file
                      </button>
                      <button
                        type="button"
                        disabled={w9ViewingUserId === row.id || w9ApprovingUserId === row.id}
                        onClick={async () => {
                          setW9ApprovingUserId(row.id);
                          const result = await adminApproveProfileW9(row.id);
                          setW9ApprovingUserId(null);
                          if (result.success) {
                            toast.success("W-9 marked verified");
                            setPendingW9Reviews((prev) => prev.filter((r) => r.id !== row.id));
                          } else {
                            toast.error(result.error);
                          }
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {w9ApprovingUserId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve W-9
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Pending Withdrawals
          </h2>
          {loadingDashboard ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-12 text-center">
              <Landmark className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground">
                No pending withdrawals to process.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {withdrawals.map((w) => {
                const rawProf = (w as WithdrawalRow & { profile?: unknown }).profile;
                const prof = Array.isArray(rawProf) ? rawProf[0] : rawProf;
                const p = prof as { full_name?: string | null; campus?: string | null } | null;
                const displayName =
                  typeof p?.full_name === "string" && p.full_name.trim()
                    ? p.full_name.trim()
                    : null;
                const campus =
                  typeof p?.campus === "string" && p.campus.trim() ? p.campus.trim() : null;
                return (
                <div
                  key={w.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {displayName ?? "No name on profile"}
                        </p>
                        {campus ? (
                          <p className="truncate text-[10px] text-muted-foreground">{campus}</p>
                        ) : null}
                        <p
                          className="mt-0.5 truncate font-mono text-[9px] text-zinc-500"
                          title={w.user_id}
                        >
                          {w.user_id}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--theme-primary)]">
                      {w.status}
                    </span>
                  </div>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-foreground">
                      ${Number(w.amount).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (fee: ${Number(w.fee).toFixed(2)}, net: ${Number(w.net_amount).toFixed(2)})
                    </span>
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {w.method} → {w.account_info}
                  </p>
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    {new Date(w.created_at).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setProcessingId(w.id);
                        const result = await completeWithdrawal(w.id);
                        setProcessingId(null);
                        if (result.success) {
                          toast.success("Marked as completed");
                          setWithdrawals((prev) => prev.filter((x) => x.id !== w.id));
                        } else {
                          toast.error(result.error);
                        }
                      }}
                      disabled={processingId === w.id}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-black uppercase tracking-wider text-[#0a0a0a] transition-all active:scale-[0.97] disabled:opacity-60"
                    >
                      {processingId === w.id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0a0a0a] border-t-transparent" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Mark as Completed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawRejectId(w.id);
                        setWithdrawRejectNote("");
                      }}
                      disabled={processingId === w.id || withdrawRejectSubmitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-xs font-black uppercase tracking-wider text-destructive-foreground transition-all active:scale-[0.97] disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Campuses Tab */}
      {activeTab === "campuses" && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Campus Assets
            </h2>
            <button
              onClick={() => openSchoolForm(null)}
              className="flex items-center gap-2 rounded-xl bg-[var(--theme-primary)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add School
            </button>
          </div>
          {loadingSchools ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
          ) : schools.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-12 text-center">
              <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">No schools yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Add schools to enable campus themes.
              </p>
              <button
                onClick={() => openSchoolForm(null)}
                className="flex items-center gap-2 rounded-xl bg-[var(--theme-primary)] px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Add First School
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {schools.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    {s.logo_url ? (
                      <img
                        src={s.logo_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: s.primary_color }}
                      />
                    )}
                    <div>
                      <p className="font-bold text-foreground">{s.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: s.primary_color }}
                        />
                        {s.primary_color}
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: s.secondary_color }}
                        />
                        {s.secondary_color}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openSchoolForm(s)}
                      className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchool(s)}
                      className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit School Modal */}
          {showSchoolForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-lg font-bold">
                  {editingSchool ? "Edit School" : "Add School"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. University of Virginia"
                      className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Primary Color (HEX)
                    </label>
                    <input
                      type="text"
                      value={formPrimary}
                      onChange={(e) => setFormPrimary(e.target.value)}
                      placeholder="#E57200"
                      className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Secondary Color (HEX)
                    </label>
                    <input
                      type="text"
                      value={formSecondary}
                      onChange={(e) => setFormSecondary(e.target.value)}
                      placeholder="#232D4B"
                      className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={formLogo}
                      onChange={(e) => setFormLogo(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={closeSchoolForm}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSchool}
                    disabled={savingSchool || !formName.trim()}
                    className="flex-1 rounded-xl bg-[var(--theme-primary)] py-3 text-sm font-bold uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  >
                    {savingSchool ? "Saving..." : editingSchool ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "career" && (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Pending career requests
            </h2>
            {loadingDashboard ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : pendingCareerRewards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No pending certificate or referral requests.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {pendingCareerRewards.map((row) => {
                  const needsPdf = careerRewardNeedsCertificatePdf(row.reward_key);
                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-border bg-card p-4 dark:border-white/10"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-foreground">
                            {row.profile?.full_name?.trim() || "User"}{" "}
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({row.user_id.slice(0, 8)}…)
                            </span>
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--theme-primary)]">
                            {row.reward_summary}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {row.reward_key}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Submitted {new Date(row.claimed_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <form
                        className="flex flex-col gap-3 border-t border-border pt-3 dark:border-white/10"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          setCareerApprovingId(row.id);
                          const res = await adminApproveCareerReward(row.id, fd);
                          setCareerApprovingId(null);
                          if (res.success) {
                            toast.success("Approved");
                            setPendingCareerRewards((prev) => prev.filter((r) => r.id !== row.id));
                          } else {
                            toast.error(res.error);
                          }
                        }}
                      >
                        {needsPdf ? (
                          <div lang="en">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Certificate PDF (required)
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                id={`career-cert-${row.id}`}
                                type="file"
                                name="certificate"
                                accept=".pdf,application/pdf"
                                required
                                className="sr-only"
                                onChange={(e) => {
                                  const name = e.target.files?.[0]?.name ?? "";
                                  setCareerCertFileLabel((prev) => ({ ...prev, [row.id]: name }));
                                }}
                              />
                              <label
                                htmlFor={`career-cert-${row.id}`}
                                className="inline-flex cursor-pointer items-center rounded-lg bg-[var(--theme-primary)] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                              >
                                Choose file
                              </label>
                              <span className="text-xs text-muted-foreground">
                                {careerCertFileLabel[row.id]?.trim()
                                  ? careerCertFileLabel[row.id]
                                  : "No file chosen"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Referral lane — no PDF upload. Approve to mark as fulfilled.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={careerApprovingId === row.id || careerRejectingId === row.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {careerApprovingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={careerApprovingId === row.id || careerRejectingId === row.id}
                            onClick={async () => {
                              if (!confirm("Reject and remove this request? The user can submit again."))
                                return;
                              setCareerRejectingId(row.id);
                              const res = await adminRejectCareerReward(row.id);
                              setCareerRejectingId(null);
                              if (res.success) {
                                toast.success("Rejected");
                                setPendingCareerRewards((prev) => prev.filter((r) => r.id !== row.id));
                              } else {
                                toast.error(res.error);
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                          >
                            {careerRejectingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reject
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Brand career visibility
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              When unchecked, users will not see that brand&apos;s internship certificate or referral
              cards in Axelerate Career.
            </p>
            {loadingCareerBrands ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading brands…</div>
            ) : careerBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No brands found.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border dark:border-white/10">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 dark:border-white/10">
                      <th className="px-4 py-3 font-bold text-foreground">Brand</th>
                      <th className="px-4 py-3 font-bold text-foreground">Internship proof</th>
                      <th className="px-4 py-3 font-bold text-foreground">Referral</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerBrands.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-border last:border-0 dark:border-white/10"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={b.career_internship_proof_enabled}
                            onCheckedChange={async (v) => {
                              const internship = v === true;
                              const res = await adminUpdateBrandCareerFlags(
                                b.id,
                                internship,
                                b.career_referral_enabled,
                              );
                              if (res.success) {
                                toast.success("Updated");
                                setCareerBrands((prev) =>
                                  prev.map((x) =>
                                    x.id === b.id ? { ...x, career_internship_proof_enabled: internship } : x,
                                  ),
                                );
                              } else {
                                toast.error(res.error);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={b.career_referral_enabled}
                            onCheckedChange={async (v) => {
                              const referral = v === true;
                              const res = await adminUpdateBrandCareerFlags(
                                b.id,
                                b.career_internship_proof_enabled,
                                referral,
                              );
                              if (res.success) {
                                toast.success("Updated");
                                setCareerBrands((prev) =>
                                  prev.map((x) =>
                                    x.id === b.id ? { ...x, career_referral_enabled: referral } : x,
                                  ),
                                );
                              } else {
                                toast.error(res.error);
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UGC Tab - Stats */}
      {activeTab === "ugc" && (
      <>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary)]/5 p-4 text-center">
          <p className="text-2xl font-black text-[var(--theme-primary)]">{pendingCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Pending Review
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{reviewedCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Reviewed
          </p>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = ugcActiveFilter === filter;
          const count =
            filter === "ALL"
              ? ugcData.length
              : ugcData.filter(
                  (i) => (i.status ?? "").toLowerCase() === filter.toLowerCase()
                ).length;
          return (
          <button
              key={filter}
              onClick={() => setUgcActiveFilter(filter)}
            className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold tracking-wider transition-all",
                isActive
                  ? "bg-[var(--theme-primary)] text-white shadow-[0_0_10px_var(--theme-primary)]"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
            >
              {filter} ({count})
          </button>
          );
        })}
      </div>

      {/* Queue */}
      <div className="flex flex-col gap-3">
        {loadingDashboard ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
          </div>
        ) : (
          filteredUGC.map((item, i) => {
          const isExpanded = expandedId === item.id;
            const user = Array.isArray(item.user) ? item.user[0] : item.user;
            const gig = Array.isArray(item.gig) ? item.gig[0] : item.gig;
            const username =
              user?.full_name || user?.username || item.user_id?.slice(0, 4) || "—";
            const avatarUrl = user?.avatar_url;
            const gigTitle = gig?.title ?? "Unknown Gig";
            const ugcLink = item.ugc_link?.trim() || null;
            const platform = item.platform?.trim() || null;
          const isPending = item.status === "pending";
            const isSubmitted = item.status === "submitted";
            const needsAction = isPending || isSubmitted;
            const isActioning = ugcActionId === item.id;

          return (
            <div
              key={item.id}
              className="animate-slide-up overflow-hidden rounded-2xl border border-border bg-card"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-black text-muted-foreground">
                      {(username || item.user_id || "?").slice(0, 2).toUpperCase()}
                </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">
                        @{username || item.user_id?.slice(0, 8) || "—"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                          needsAction
                            ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] border border-[var(--theme-primary)]/50"
                            : item.status === "approved" || item.status === "completed" || item.status === "paid"
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {item.status === "submitted"
                          ? "SUBMITTED"
                          : item.status === "pending"
                            ? "PENDING"
                            : (item.status ?? "").toUpperCase()}
                    </span>
                  </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {gigTitle}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.applied_at
                        ? new Date(item.applied_at).toLocaleDateString()
                        : "—"}
                      {platform ? ` · ${platform}` : ""}
                    </p>
                </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ugcLink && (
                      <a
                        href={ugcLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-[var(--theme-primary)]"
                        title="Open UGC link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
              </button>

                {/* Expanded detail - Comprehensive Review Panel */}
              {isExpanded && (
                <div className="animate-slide-up border-t border-border px-4 pb-4 pt-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Block A: Original Gig Requirements */}
                      <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                          📌 Original Gig
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Description / Guidelines
                            </p>
                            <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/90 dark:text-zinc-300">
                              {gig?.description?.trim() || "No description provided."}
                            </pre>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(gig?.reward_cash ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                ${gig.reward_cash} Bounty
                              </span>
                            )}
                            {(gig?.reward_credits ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                {gig.reward_credits} pts
                              </span>
                            )}
                            {(gig?.xp_reward ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                                {gig.xp_reward} XP
                              </span>
                            )}
                          </div>
                        </div>
                  </div>

                      {/* Block B: Submission Details */}
                      <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                          📝 Submission Details
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Platform
                            </p>
                            <p className="text-xs text-foreground/90 dark:text-zinc-300">
                              {platform || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              UGC Link
                            </p>
                            {ugcLink ? (
                              <a
                                href={ugcLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--theme-primary)]/50 bg-[var(--theme-primary)]/10 px-3 py-2 text-xs font-mono text-[var(--theme-primary)] transition-all hover:bg-[var(--theme-primary)]/20 hover:border-[var(--theme-primary)]/70"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {ugcLink.length > 50 ? `${ugcLink.slice(0, 50)}…` : ugcLink}
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Link not submitted yet
                              </p>
                            )}
                        </div>
                          <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Creator Notes
                            </p>
                            <p className="text-xs text-foreground/90 dark:text-zinc-300">
                              {item.notes?.trim() || "No notes provided."}
                            </p>
                          </div>
                        </div>
                    </div>
                  </div>

                    <AuditTrailSection
                      entries={auditLogByEntity[`user_gig:${item.id}`] ?? []}
                      extraItems={[
                        { label: "Applied", value: item.applied_at },
                        { label: "Submitted", value: item.submitted_at },
                      ]}
                    />

                    {/* Rejection Reason (optional placeholder) */}
                    {needsAction && (
                      <div className="mt-4">
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Rejection Reason (Admin Feedback)
                        </label>
                        <textarea
                          placeholder="Optional: Add feedback for the creator when rejecting..."
                          rows={2}
                          className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-black/20"
                        />
                  </div>
                    )}

                    {/* Action Bar - at bottom of expanded area */}
                    {needsAction && (
                      <div className="mt-4 flex w-full gap-2">
                        {isPending && (
                          <>
                      <button
                              onClick={() => handleApproveUgc(item.id)}
                              disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-[#0a0a0a] shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-60"
                      >
                              {ugcActionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                        <CheckCircle2 className="h-4 w-4" />
                              )}
                        Approve
                      </button>
                      <button
                              onClick={() => handleRejectUgc(item.id)}
                              disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 py-3 text-xs font-black uppercase tracking-wider text-amber-400 transition-all hover:border-amber-500/70 hover:bg-amber-500/20 active:scale-[0.97] disabled:opacity-60"
                      >
                              {ugcActionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                        <XCircle className="h-4 w-4" />
                              )}
                        Reject
                      </button>
                          </>
                        )}
                        {isSubmitted && (
                          <>
                          <button
                              onClick={() => handleCompleteUgc(item.id)}
                              disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-[#0a0a0a] shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-60"
                            >
                              {ugcActionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Complete
                          </button>
                        <button
                              onClick={() => handleRejectUgc(item.id)}
                              disabled={isActioning}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 py-3 text-xs font-black uppercase tracking-wider text-amber-400 transition-all hover:border-amber-500/70 hover:bg-amber-500/20 active:scale-[0.97] disabled:opacity-60"
                            >
                              {ugcActionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              Reject
                        </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Mark as Paid - for completed only */}
                    {item.status === "completed" && (
                      <div className="mt-4">
                        <button
                          onClick={() =>
                            handleMarkUgcAsPaid(
                              item.id,
                              item.user_id,
                              gig?.reward_cash ?? 0,
                              gig?.reward_credits ?? 0,
                              gig?.xp_reward ?? 0
                            )
                          }
                          disabled={ugcPaidActionId === item.id}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(202,138,4,0.3)] transition-all hover:bg-yellow-500 active:scale-[0.98] disabled:opacity-60"
                        >
                          {ugcPaidActionId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          MARK AS PAID
                        </button>
                    </div>
                  )}

                  {/* Already reviewed */}
                    {!needsAction && item.status !== "completed" && (
                      <div
                        className={cn(
                          "mt-4 flex items-center gap-2 rounded-xl p-3",
                          item.status === "approved" || item.status === "paid"
                            ? "bg-emerald-400/10"
                            : "bg-destructive/10"
                        )}
                      >
                        {item.status === "approved" || item.status === "paid" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                        <span
                          className={cn(
                        "text-xs font-bold",
                            item.status === "approved" || item.status === "paid"
                              ? "text-emerald-400"
                              : "text-destructive"
                          )}
                        >
                          {item.status === "approved"
                            ? "Approved"
                            : item.status === "paid"
                              ? "Paid"
                              : "Rejected"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })
        )}

        {!loadingDashboard && filteredUGC.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary)]/10">
              <Sparkles className="h-5 w-5 text-[var(--theme-primary)]" />
            </div>
            <p className="text-sm font-bold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">No pending submissions to review.</p>
          </div>
        )}
      </div>
      </>
      )}

      {/* Physical Gigs Tab */}
      {activeTab === "physical" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary)]/5 p-4 text-center">
              <p className="text-2xl font-black text-[var(--theme-primary)]">
                {physicalData.filter((s) => physicalPendingStatuses.includes(s.status)).length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pending
              </p>
    </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-black text-foreground">
                {physicalData.filter((s) => !physicalPendingStatuses.includes(s.status)).length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Reviewed
              </p>
            </div>
          </div>
          {/* Status Filter Pills */}
          <div className="mb-6 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = physicalActiveFilter === filter;
              const count =
                filter === "ALL"
                  ? physicalData.length
                  : physicalData.filter(
                      (i) => (i.status ?? "").toLowerCase() === filter.toLowerCase()
                    ).length;
              return (
                <button
                  key={filter}
                  onClick={() => setPhysicalActiveFilter(filter)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold tracking-wider transition-all",
                    isActive
                      ? "bg-[var(--theme-primary)] text-white shadow-[0_0_10px_var(--theme-primary)]"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {loadingDashboard ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : (
              physicalFiltered.map((item, i) => {
                const isExpanded = expandedPhysicalId === item.id;
                const user = Array.isArray(item.user) ? item.user[0] : item.user;
                const gig = Array.isArray(item.gig) ? item.gig[0] : item.gig;
                const username = user?.full_name || user?.username || item.user_id?.slice(0, 8) || "—";
                const avatarUrl = user?.avatar_url;
                const gigTitle = gig?.title ?? "Unknown Gig";
                const isPending = physicalPendingStatuses.includes(item.status);
                const isApproved = item.status === "approved";
                const isActioning = physicalActionId === item.id;

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <button
                      onClick={() => setExpandedPhysicalId(isExpanded ? null : item.id)}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-black text-muted-foreground">
                          {(username || "?").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-foreground truncate">
                            {username}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                              isPending
                                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                                : item.status === "approved" || item.status === "completed" || item.status === "paid"
                                  ? "bg-emerald-400/10 text-emerald-400"
                                  : "bg-destructive/10 text-destructive"
                            )}
                          >
                            {(item.status ?? "PENDING").toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{gigTitle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.applied_at ? new Date(item.applied_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>
                    {isExpanded && (
                      <div className="animate-slide-up border-t border-border px-4 pb-4 pt-3">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                              📍 Gig Details
                            </p>
                            <div className="space-y-2">
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Location</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{gig?.location ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Date</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{gig?.date ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Reward</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">
                                  ${gig?.reward_cash ?? 0} · {(gig?.reward_credits ?? 0)} pts
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                              👤 Applicant
                            </p>
                            <div className="space-y-2">
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Phone</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{(user as any)?.phone ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Email</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300 truncate">{(user as any)?.email ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Applied</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">
                                  {item.applied_at ? new Date(item.applied_at).toLocaleString() : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <AuditTrailSection
                          entries={auditLogByEntity[`user_gig:${item.id}`] ?? []}
                          extraItems={[
                            { label: "Applied", value: item.applied_at },
                            { label: "Submitted", value: item.submitted_at },
                          ]}
                        />

                        <div className="mt-4 flex flex-wrap gap-3">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprovePhysical(item.id)}
                                disabled={isActioning}
                                className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[var(--theme-primary)] py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 disabled:opacity-60"
                              >
                                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectPhysical(item.id)}
                                disabled={isActioning}
                                className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl border-2 border-destructive/50 bg-destructive/10 py-3 text-xs font-black uppercase tracking-wider text-destructive transition-all hover:bg-destructive/20 disabled:opacity-60"
                              >
                                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                Reject
                              </button>
                            </>
                          )}
                          {isApproved && (
                            <button
                              onClick={() => handleCompletePhysical(item.id)}
                              disabled={isActioning}
                              className="flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Mark Completed
                            </button>
                          )}
                          {item.status === "completed" && (
                            <button
                              onClick={() =>
                                handleMarkPhysicalAsPaid(
                                  item.id,
                                  item.user_id,
                                  gig?.reward_cash ?? 0,
                                  gig?.reward_credits ?? 0,
                                  gig?.xp_reward ?? 0
                                )
                              }
                              disabled={physicalPaidActionId === item.id}
                              className="flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(202,138,4,0.3)] transition-all hover:bg-yellow-500 disabled:opacity-60"
                            >
                              {physicalPaidActionId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              MARK AS PAID
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!loadingDashboard && physicalFiltered.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <MapPinned className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">No physical gigs</p>
                <p className="text-xs text-muted-foreground">No offline event applications to review.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary)]/5 p-4 text-center">
              <p className="text-2xl font-black text-[var(--theme-primary)]">
                {eventsData.filter((e) => eventPendingStatuses.includes(e.status)).length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pending
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-black text-foreground">
                {eventsData.filter((e) => !eventPendingStatuses.includes(e.status)).length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Reviewed
              </p>
            </div>
          </div>
          <div className="mb-4 flex gap-2">
            {(["pending", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setEventsFilter(f)}
                className={cn(
                  "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                  eventsFilter === f
                    ? "bg-[var(--theme-primary)] text-white"
                    : "border-2 border-border bg-muted/40 text-muted-foreground dark:border-white/20 dark:bg-white/5 hover:border-[var(--theme-primary)]/50 hover:text-[var(--theme-primary)]"
                )}
              >
                {f === "pending"
                  ? `Pending (${eventsData.filter((e) => eventPendingStatuses.includes(e.status)).length})`
                  : `All (${eventsData.length})`}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {loadingDashboard ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : (
              eventsFiltered.map((app, i) => {
                const isExpanded = expandedEventId === app.id;
                const ev = Array.isArray(app.event) ? app.event[0] : app.event;
                const profile = Array.isArray(app.profile) ? app.profile[0] : app.profile;
                const eventTitle = ev?.title ?? "Unknown Event";
                const username = profile?.full_name || app.user_id?.slice(0, 8) || "—";
                const avatarUrl = profile?.avatar_url;
                const status = app.status ?? "pending";
                const isPending = eventPendingStatuses.includes(app.status);
                const isApproved = status === "approved";
                const isActioning = eventActionId === app.id;

                return (
                  <div
                    key={app.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : app.id)}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-black text-muted-foreground">
                          {(username || "?").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-foreground truncate">
                            {username}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                              isPending
                                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                                : status === "approved"
                                  ? "bg-emerald-400/10 text-emerald-400"
                                  : status === "attended"
                                    ? "bg-cyan-400/10 text-cyan-400"
                                    : "bg-destructive/10 text-destructive"
                            )}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{eventTitle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {app.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>
                    {isExpanded && (
                      <div className="animate-slide-up border-t border-border px-4 pb-4 pt-3">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                              📅 Event Details
                            </p>
                            <div className="space-y-2">
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Title</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{eventTitle}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Location</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{ev?.location ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Starts</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">
                                  {ev?.starts_at || ev?.event_date
                                    ? new Date(ev.starts_at || ev.event_date).toLocaleString()
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border-2 border-border bg-muted/40 p-4 dark:border-white/5 dark:bg-black/20">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                              👤 Applicant
                            </p>
                            <div className="space-y-2">
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Campus</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{(profile as any)?.campus ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Tier</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">{(profile as any)?.tier ?? "—"}</p>
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] font-bold uppercase text-muted-foreground">Applied</p>
                                <p className="text-xs text-foreground/90 dark:text-zinc-300">
                                  {app.created_at ? new Date(app.created_at).toLocaleString() : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <AuditTrailSection
                          entries={auditLogByEntity[`event_application:${app.id}`] ?? []}
                          extraItems={[{ label: "Applied", value: app.created_at }]}
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          {isPending && (
                            <button
                              onClick={() => handleApproveEvent(app.id)}
                              disabled={isActioning}
                              className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[var(--theme-primary)] py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 disabled:opacity-60"
                            >
                              {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Approve
                            </button>
                          )}
                          {(isPending || isApproved) && (
                            <button
                              onClick={() => handleMarkEventAttended(app.id)}
                              disabled={isActioning}
                              className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-xs font-black uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-cyan-400 disabled:opacity-60"
                            >
                              {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                              Mark Attended
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!loadingDashboard && eventsFiltered.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">No event applications</p>
                <p className="text-xs text-muted-foreground">No exclusive event applications to review.</p>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={!!rejectDialog}
        onOpenChange={(open) => {
          if (!open) setRejectDialog(null);
        }}
      >
        <DialogContent className="border-2 border-border bg-card dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">
              {rejectDialog?.type === "cancel" ? "Decline cancellation" : "Decline return"}
            </DialogTitle>
            <DialogDescription>
              This message will be shown to the customer in My Orders (min 3 characters).
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Explain why the request cannot be approved..."
            rows={4}
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-white/5"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setRejectDialog(null)}>
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={rejectSubmitting || rejectNote.trim().length < 3 || !rejectDialog}
              onClick={async () => {
                if (!rejectDialog || rejectNote.trim().length < 3) return;
                setRejectSubmitting(true);
                const { type, orderId } = rejectDialog;
                const result =
                  type === "cancel"
                    ? await rejectCancelRequest(orderId, rejectNote.trim())
                    : await rejectOrderReturn(orderId, rejectNote.trim());
                setRejectSubmitting(false);
                if (result.success) {
                  toast.success(type === "cancel" ? "Cancellation declined" : "Return declined");
                  setRejectDialog(null);
                  setRejectNote("");
                  if (type === "cancel") {
                    setPendingCancelRequests((prev) => prev.filter((o) => o.id !== orderId));
                  } else {
                    setPendingReturns((prev) => prev.filter((o) => o.id !== orderId));
                  }
                } else {
                  toast.error(result.error ?? "Failed");
                }
              }}
            >
              {rejectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send to customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!withdrawRejectId}
        onOpenChange={(open) => {
          if (!open) {
            setWithdrawRejectId(null);
            setWithdrawRejectNote("");
          }
        }}
      >
        <DialogContent className="border-2 border-border bg-card dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">
              Reject withdrawal
            </DialogTitle>
            <DialogDescription>
              Optional note for the user — it appears in My Wallet and Earnings on the rejected
              withdrawal line.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={withdrawRejectNote}
            onChange={(e) => setWithdrawRejectNote(e.target.value)}
            placeholder="e.g. Please confirm your PayPal email and resubmit."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-white/5"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWithdrawRejectId(null);
                setWithdrawRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={withdrawRejectSubmitting || !withdrawRejectId}
              onClick={async () => {
                if (!withdrawRejectId) return;
                setWithdrawRejectSubmitting(true);
                const note = withdrawRejectNote.trim();
                const result = await rejectWithdrawal(
                  withdrawRejectId,
                  note || undefined
                );
                setWithdrawRejectSubmitting(false);
                if (result.success) {
                  toast.success("Rejected, refund issued");
                  const id = withdrawRejectId;
                  setWithdrawals((prev) => prev.filter((x) => x.id !== id));
                  setWithdrawRejectId(null);
                  setWithdrawRejectNote("");
                } else {
                  toast.error(result.error);
                }
              }}
            >
              {withdrawRejectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
