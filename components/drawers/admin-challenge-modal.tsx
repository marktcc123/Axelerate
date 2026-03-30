"use client";

import { useState, useRef } from "react";
import { Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "marktcc123";

interface AdminChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminChallengeModal({ open, onClose, onSuccess }: AdminChallengeModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setError(false);
      setPassword("");
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl",
          shake && "animate-shake"
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-muted-foreground transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
            <Lock className="h-7 w-7 text-brand-primary" />
          </div>
        </div>

        <h3 className="mb-1 text-center text-lg font-black uppercase tracking-tight text-foreground">
          Admin Access
        </h3>
        <p className="mb-6 text-center text-xs text-muted-foreground">
          Enter the admin password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
            className={cn(
              "mb-4 w-full rounded-xl border bg-card px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground",
              error
                ? "border-destructive/50 ring-2 ring-destructive/20"
                : "border-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
            )}
          />
          {error && (
            <p className="mb-4 text-center text-xs font-bold text-destructive">
              Incorrect password
            </p>
          )}
          <button
            type="submit"
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
          >
            <Lock className="h-4 w-4" />
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
