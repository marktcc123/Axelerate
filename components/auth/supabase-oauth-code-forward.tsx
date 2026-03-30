"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Supabase OAuth (PKCE) should return to `/auth/callback` so the route handler
 * can call `exchangeCodeForSession`. If the dashboard Site URL or redirect
 * config sends users to `/` with `?code=...`, the exchange never runs and
 * login appears broken. Forward those requests to the real callback URL.
 */
export function SupabaseOAuthCodeForward() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname?.startsWith("/auth/callback")) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const next = params.get("next") ?? "/";
    const forward = new URLSearchParams();
    forward.set("code", code);
    forward.set("next", next);

    window.location.replace(`/auth/callback?${forward.toString()}`);
  }, [pathname]);

  return null;
}
