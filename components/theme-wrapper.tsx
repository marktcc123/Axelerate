"use client";

import { useEffect, useState } from "react";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { hexToRgb, isDefaultAppTheme, getSchoolByAppTheme } from "@/lib/schools";

/** Neo-brutalism design system defaults (overridden per school theme) */
const DEFAULT_PRIMARY = "#A855F7";
const DEFAULT_SECONDARY = "#C084FC";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { profile, previewAppTheme } = useAppDataContext();
  const appTheme = previewAppTheme ?? profile?.app_theme ?? null;

  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState(DEFAULT_SECONDARY);

  useEffect(() => {
    if (isDefaultAppTheme(appTheme)) {
      setPrimary(DEFAULT_PRIMARY);
      setSecondary(DEFAULT_SECONDARY);
      return;
    }

    let cancelled = false;
    getSchoolByAppTheme(appTheme).then((school) => {
      if (cancelled) return;
      if (school?.primary_color && school?.secondary_color) {
        setPrimary(school.primary_color);
        setSecondary(school.secondary_color);
      } else {
        setPrimary(DEFAULT_PRIMARY);
        setSecondary(DEFAULT_SECONDARY);
      }
    }).catch(() => {
      if (!cancelled) {
        setPrimary(DEFAULT_PRIMARY);
        setSecondary(DEFAULT_SECONDARY);
      }
    });
    return () => { cancelled = true; };
  }, [appTheme]);

  useEffect(() => {
    const primaryRgb = hexToRgb(primary).replace(/ /g, ", ");
    const root = document.documentElement;
    root.style.setProperty("--theme-primary", primary);
    root.style.setProperty("--theme-secondary", secondary);
    root.style.setProperty("--theme-primary-rgb", primaryRgb);
    return () => {
      root.style.removeProperty("--theme-primary");
      root.style.removeProperty("--theme-secondary");
      root.style.removeProperty("--theme-primary-rgb");
    };
  }, [primary, secondary]);

  return <>{children}</>;
}
