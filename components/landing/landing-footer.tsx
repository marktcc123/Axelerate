"use client";

export function LandingFooter() {
  return (
    <footer className="border-t-2 border-brand-primary/60 bg-card px-6 py-5 dark:border-brand-primary/40 dark:bg-zinc-950 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:flex-row sm:items-center">
        <span className="font-display text-sm text-foreground">AXELERATE</span>
        <span className="max-w-md text-center sm:text-left">
          Pioneer Campus Platform · Feed · My Gigs · Perks Shop — earn money, unlock perks, level up.
        </span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
