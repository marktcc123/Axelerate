"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Ghost nav: browser back first; new-tab / empty history falls through to `/`. */
export function LegalBackNav({ className }: Props) {
  const router = useRouter();

  return (
    <div className={cn("mb-10 flex flex-wrap items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => {
          router.back();
        }}
        className={cn(
          "rounded-xl border-2 border-zinc-600 bg-transparent px-4 py-2.5 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-200 shadow-none transition-colors",
          "hover:border-zinc-400 hover:bg-zinc-900/80 hover:text-white active:translate-x-[2px] active:translate-y-[2px] dark:border-zinc-500 dark:hover:bg-zinc-800/70"
        )}
      >
        ← Return to terminal
      </button>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="rounded-xl border border-dashed border-zinc-600 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-300"
      >
        Home feed
      </button>
    </div>
  );
}
