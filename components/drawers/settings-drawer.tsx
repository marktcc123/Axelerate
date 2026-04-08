"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Settings, Save, Loader2, ChevronRight, MapPin, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME_LABEL, toAppThemeValue } from "@/lib/schools";

const inputClass =
  "w-full rounded-xl border-2 border-border bg-input px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 dark:border-white/10 dark:bg-white/5 dark:text-white";

export function SettingsDrawer({
  onRequestAdminAccess,
}: {
  /** Staff entry: parent opens password challenge modal */
  onRequestAdminAccess?: () => void;
} = {}) {
  const { user, profile, refetchPrivate, setPreviewAppTheme } = useAppDataContext();
  const [fullName, setFullName] = useState("");
  const [appTheme, setAppTheme] = useState(DEFAULT_THEME_LABEL);
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAppTheme(profile.app_theme ?? DEFAULT_THEME_LABEL);
      setTiktokHandle(profile.tiktok_handle ?? "");
      setIgHandle(profile.ig_handle ?? "");
      setLinkedinUrl(profile.linkedin_url ?? "");
    }
  }, [profile]);

  const appThemeOptions = useMemo(() => {
    const opts: string[] = [DEFAULT_THEME_LABEL];
    const campus = profile?.campus?.trim();
    if (campus) {
      const campusTheme = toAppThemeValue(campus);
      if (!opts.includes(campusTheme)) opts.push(campusTheme);
    }
    return opts;
  }, [profile?.campus]);

  const effectiveAppTheme = appThemeOptions.includes(appTheme) ? appTheme : DEFAULT_THEME_LABEL;

  useEffect(() => {
    if (!appThemeOptions.includes(appTheme)) setAppTheme(DEFAULT_THEME_LABEL);
  }, [appThemeOptions, appTheme]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        app_theme: effectiveAppTheme,
        tiktok_handle: tiktokHandle.trim() || null,
        ig_handle: igHandle.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
      console.error("Settings save error details:", JSON.stringify(error, null, 2));
      setSaving(false);
      return;
    }

    toast.success("Settings saved");
    setPreviewAppTheme(null);
    await refetchPrivate();
    setSaving(false);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to edit settings</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-2xl border-2 border-border bg-card/30 p-1 pb-8 shadow-sm transition-colors dark:border-white/10 dark:bg-transparent">
      <div className="pb-8">
        <Link
          href="/settings"
          className="mb-6 flex w-full items-center gap-3 rounded-xl border-2 border-border bg-muted/40 px-4 py-3.5 text-left shadow-[4px_4px_0_rgba(0,0,0,0.08)] transition-colors hover:bg-muted/60 dark:border-white/10 dark:bg-white/5 dark:shadow-[4px_4px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/10"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/15">
            <MapPin className="h-4 w-4 text-brand-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground dark:text-white">
              Shipping & payment
            </p>
            <p className="text-[10px] text-muted-foreground">
              Shipping address, payments, and tax — full-screen page
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/90">
              Order history: Profile tab → My Orders.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        {/* Block A: Profile Info */}
        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Settings className="h-4 w-4 shrink-0" />
            Profile
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your display name"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                My Campus
              </label>
              <input
                type="text"
                value={profile?.campus ?? ""}
                readOnly
                disabled
                className={cn(inputClass, "cursor-not-allowed opacity-70")}
                placeholder="—"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Campus is locked after .edu email verification.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                TikTok Handle
              </label>
              <input
                type="text"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="@username"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Instagram Handle
              </label>
              <input
                type="text"
                value={igHandle}
                onChange={(e) => setIgHandle(e.target.value)}
                placeholder="@username"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                LinkedIn profile URL
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/your-profile"
                className={inputClass}
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Used for the Axelerate Career LinkedIn button after your certificate is approved.
              </p>
            </div>
          </div>
        </div>

        {/* Block B: App Preferences */}
        <div className="mb-8">
          <h3 className="mb-4 text-sm font-semibold tracking-tight text-foreground">
            App preferences
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                App Theme
              </label>
              <select
                value={effectiveAppTheme}
                onChange={(e) => {
                  const v = e.target.value;
                  setAppTheme(v);
                  setPreviewAppTheme(v);
                }}
                className={cn(inputClass, "cursor-pointer appearance-none")}
              >
                {appThemeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Change the app theme to your preferred color scheme.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-4 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {onRequestAdminAccess ? (
          <div className="mt-10 border-t border-border pt-6 dark:border-white/10">
            <p className="mb-2 text-xs font-medium tracking-tight text-muted-foreground">
              Staff only
            </p>
            <button
              type="button"
              onClick={onRequestAdminAccess}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:bg-muted/40 hover:text-foreground dark:border-white/15 dark:hover:bg-white/5"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 opacity-80" />
              Admin console (password required)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
