"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Users,
  CheckCircle2,
  Target,
  TrendingUp,
  Crown,
  ChevronRight,
  AlertCircle,
  Briefcase,
  ClipboardList,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockShifts, mockManagerTasks, mockUser, VERIFICATION_LEVELS } from "@/lib/data";
import type { Shift, ManagerTask, StaffingTrack } from "@/lib/data";

type TrackTab = "shifts" | "tasks";

function ShiftCard({ shift }: { shift: Shift }) {
  const [expanded, setExpanded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const isFull = shift.spotsLeft === 0;
  const isBooked = shift.status === "booked";

  const totalPay = shift.hourlyRate * (
    // estimate hours from times
    (() => {
      const [sh, sm] = shift.startTime.replace(/[^0-9:]/g, "").split(":").map(Number);
      const [eh, em] = shift.endTime.replace(/[^0-9:]/g, "").split(":").map(Number);
      const startH = shift.startTime.includes("PM") && sh !== 12 ? sh + 12 : sh;
      const endH = shift.endTime.includes("PM") && eh !== 12 ? eh + 12 : eh;
      return endH - startH;
    })()
  );

  const handleClaim = () => {
    if (isFull || isBooked || claimed) return;
    setClaiming(true);
    setTimeout(() => {
      setClaiming(false);
      setClaimed(true);
    }, 1200);
  };

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border transition-all",
      claimed ? "border-primary/30 bg-primary/5" :
      isFull || isBooked ? "border-border/50 bg-card/50 opacity-60" :
      "border-border bg-card hover:border-primary/20"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        {/* Pay badge */}
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10">
          <span className="text-[10px] font-bold text-primary">$</span>
          <span className="text-sm font-black leading-none text-primary">{shift.hourlyRate}</span>
          <span className="text-[8px] font-bold text-primary/60">/hr</span>
        </div>

        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">{shift.title}</h4>
            {claimed && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                Claimed
              </span>
            )}
          </div>
          <p className="mb-1 text-xs text-muted-foreground">{shift.brand}</p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {shift.location}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {shift.date}
            </span>
          </div>
        </div>

        <ChevronRight className={cn(
          "mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          expanded && "rotate-90"
        )} />
      </button>

      {expanded && (
        <div className="animate-slide-up border-t border-border px-4 pb-4 pt-3">
          {/* Details grid */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Time</p>
              <p className="text-xs font-bold text-foreground">{shift.startTime} - {shift.endTime}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-2.5">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Est. Total</p>
              <p className="text-xs font-bold text-emerald-400">${totalPay}</p>
            </div>
          </div>

          {/* Spots */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Spots Available</span>
            </div>
            <span className={cn(
              "text-xs font-black",
              shift.spotsLeft > 0 ? "text-foreground" : "text-destructive"
            )}>
              {shift.spotsLeft}/{shift.totalSpots}
            </span>
          </div>

          {/* Verification requirement */}
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary/50 p-2.5 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3 text-primary" />
            <span>Requires <span className="font-bold text-foreground">Verified Staff (Level 3)</span> + W-9 on file</span>
          </div>

          {/* Claim CTA */}
          {!claimed ? (
            <button
              onClick={handleClaim}
              disabled={isFull || isBooked || claiming}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all",
                isFull || isBooked
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-primary-foreground active:scale-[0.98]"
              )}
            >
              {claiming ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : isFull || isBooked ? (
                "Fully Booked"
              ) : (
                <>
                  <Briefcase className="h-3.5 w-3.5" />
                  Claim This Shift
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-xs font-bold text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Shift Claimed -- Check your calendar
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: ManagerTask }) {
  const progress = Math.min((task.kpiCurrent / task.kpiGoal) * 100, 100);
  const isComplete = task.status === "completed";
  const isOverdue = task.status === "overdue";

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      isComplete ? "border-primary/20 bg-primary/5" :
      isOverdue ? "border-destructive/20 bg-destructive/5" :
      "border-border bg-card"
    )}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">{task.title}</h4>
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
              isComplete ? "bg-primary/10 text-primary" :
              isOverdue ? "bg-destructive/10 text-destructive" :
              "bg-purple-500/10 text-purple-400"
            )}>
              {task.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{task.description}</p>
        </div>
        <div className="ml-3 flex flex-col items-end">
          <span className="text-lg font-black text-emerald-400">${task.stipend}</span>
          <span className="text-[9px] font-bold text-muted-foreground">STIPEND</span>
        </div>
      </div>

      {/* KPI Progress */}
      <div className="mb-3 rounded-xl border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3 w-3" />
            {task.kpiTarget}
          </span>
          <span className="text-xs font-black text-foreground">
            {task.kpiCurrent}/{task.kpiGoal}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isComplete ? "bg-primary" :
              isOverdue ? "bg-destructive" :
              "bg-purple-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Deadline */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Deadline: {task.deadline}
        </span>
        {isComplete && (
          <span className="flex items-center gap-1 font-bold text-primary">
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </span>
        )}
        {isOverdue && (
          <span className="flex items-center gap-1 font-bold text-destructive">
            <AlertCircle className="h-3 w-3" />
            Overdue
          </span>
        )}
      </div>
    </div>
  );
}

export function EliteTracks() {
  const [activeTab, setActiveTab] = useState<TrackTab>(
    mockUser.staffingTrack === "campus-manager" ? "tasks" : "shifts"
  );
  const isVerifiedStaff = mockUser.verificationLevel >= 3;

  const shifts = mockShifts;
  const tasks = mockManagerTasks;

  const openShifts = shifts.filter((s) => s.status === "open").length;
  const totalShiftPay = shifts
    .filter((s) => s.status === "open")
    .reduce((sum, s) => {
      const hours = 4; // average
      return sum + s.hourlyRate * hours;
    }, 0);

  const activeTasks = tasks.filter((t) => t.status === "active");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const totalStipend = tasks.reduce((s, t) => s + t.stipend, 0);

  return (
    <div className="pb-4">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Elite Program
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
          Earn More
        </h1>
        <p className="text-sm text-muted-foreground">
          High-earning shifts and campus leadership tasks
        </p>
      </header>

      {/* Verification gate */}
      {!isVerifiedStaff && (
        <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="mb-1 text-sm font-bold text-foreground">Verification Required</p>
              <p className="text-xs text-muted-foreground">
                You need Level 3 (Verified Staff) status to access shifts. Complete ID verification and submit your W-9.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Track tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab("shifts")}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-2xl border p-4 transition-all",
            activeTab === "shifts"
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-card hover:border-primary/10"
          )}
        >
          <Briefcase className={cn(
            "h-5 w-5",
            activeTab === "shifts" ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-xs font-black uppercase tracking-wider",
            activeTab === "shifts" ? "text-primary" : "text-muted-foreground"
          )}>
            Shift Board
          </span>
          <span className="text-[10px] text-muted-foreground">
            {openShifts} open shifts
          </span>
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-2xl border p-4 transition-all",
            activeTab === "tasks"
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-card hover:border-primary/10"
          )}
        >
          <ClipboardList className={cn(
            "h-5 w-5",
            activeTab === "tasks" ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-xs font-black uppercase tracking-wider",
            activeTab === "tasks" ? "text-primary" : "text-muted-foreground"
          )}>
            Task Board
          </span>
          <span className="text-[10px] text-muted-foreground">
            {activeTasks.length} active tasks
          </span>
        </button>
      </div>

      {/* Shift Board */}
      {activeTab === "shifts" && (
        <div className="animate-slide-up">
          {/* Earnings summary */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Potential Earnings</p>
              <p className="text-2xl font-black text-emerald-400">${totalShiftPay}+</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
          </div>

          <h3 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Available Shifts
          </h3>
          <div className="flex flex-col gap-3">
            {shifts.map((shift, i) => (
              <div key={shift.id} style={{ animationDelay: `${i * 80}ms` }} className="animate-slide-up">
                <ShiftCard shift={shift} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Board */}
      {activeTab === "tasks" && (
        <div className="animate-slide-up">
          {/* Task summary */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-black text-foreground">{activeTasks.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-2xl font-black text-emerald-400">${totalStipend}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Stipends</p>
            </div>
          </div>

          <h3 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Your Tasks
          </h3>
          <div className="flex flex-col gap-3">
            {tasks.map((task, i) => (
              <div key={task.id} style={{ animationDelay: `${i * 80}ms` }} className="animate-slide-up">
                <TaskCard task={task} />
              </div>
            ))}
          </div>

          {completedTasks.length > 0 && (
            <div className="mt-4 rounded-2xl bg-primary/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-primary">{completedTasks.length}</span> tasks completed --{" "}
                <span className="font-bold text-emerald-400">
                  ${completedTasks.reduce((s, t) => s + t.stipend, 0)} earned
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
