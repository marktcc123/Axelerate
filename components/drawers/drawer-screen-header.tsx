import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DrawerScreenHeaderProps = {
  /** Optional small label above the title */
  kicker?: string;
  kickerIcon?: ReactNode;
  title: string;
  /** Supporting line under the title */
  subtitle?: string;
  className?: string;
};

/**
 * Consistent drawer hero: fluid-xl title + optional kicker/subtitle.
 */
export function DrawerScreenHeader({
  kicker,
  kickerIcon,
  title,
  subtitle,
  className,
}: DrawerScreenHeaderProps) {
  return (
    <header className={cn("mb-6 min-w-0 px-1", className)}>
      {(kicker || kickerIcon) && (
        <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs font-medium tracking-tight text-brand-primary">
          {kickerIcon}
          {kicker ? <span>{kicker}</span> : null}
        </div>
      )}
      <h1 className="text-fluid-xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  );
}
