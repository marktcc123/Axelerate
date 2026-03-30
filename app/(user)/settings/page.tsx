"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { saveShippingAddress } from "@/app/actions/settings";
import type { ShippingAddressJson } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border-2 border-border bg-background px-4 py-3.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground transition-all focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 dark:border-white/10 dark:bg-zinc-950 dark:text-white";

function parseShipping(raw: unknown): Partial<ShippingAddressJson> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return {
        address_line1: String(o.address_line1 ?? o.addressLine1 ?? ""),
        city: String(o.city ?? ""),
        state: String(o.state ?? ""),
        zip_code: String(o.zip_code ?? o.zipCode ?? ""),
      };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      address_line1: String(o.address_line1 ?? ""),
      city: String(o.city ?? ""),
      state: String(o.state ?? ""),
      zip_code: String(o.zip_code ?? ""),
    };
  }
  return {};
}

export default function SettingsPage() {
  const { user, profile, refetchPrivate } = useAppDataContext();
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = parseShipping(profile?.shipping_address);
    setLine1(s.address_line1 ?? "");
    setCity(s.city ?? "");
    setState(s.state ?? "");
    setZip(s.zip_code ?? "");
  }, [profile?.shipping_address]);

  const handleSaveAddress = async () => {
    if (!user?.id) return;
    setSaving(true);
    const payload: ShippingAddressJson = {
      address_line1: line1.trim(),
      city: city.trim(),
      state: state.trim(),
      zip_code: zip.trim(),
    };
    const res = await saveShippingAddress(payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Address saved");
    await refetchPrivate();
  };

  const handleLinkPayment = () => {
    toast.message("Stripe integration pending", {
      description: "Card data is never stored on our servers.",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-muted-foreground">Please sign in to manage settings.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-bold text-brand-primary hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mb-2 text-2xl font-black uppercase tracking-tight">Account & shipping</h1>
      <p className="mb-8 max-w-lg text-sm text-muted-foreground">
        Manage where we ship perks and (soon) how you pay.
      </p>

      <div className="mx-auto flex max-w-2xl flex-col gap-10">
        {/* Shipping */}
        <section
          className={cn(
            "rounded-2xl border-2 border-border bg-card p-6 shadow-[6px_6px_0_rgba(0,0,0,0.12)]",
            "dark:border-white/10 dark:bg-zinc-950 dark:shadow-[6px_6px_0_rgba(255,255,255,0.06)]"
          )}
        >
          <h2 className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Shipping address
          </h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Saved as JSON on your profile for checkout and fulfillment.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Address line 1
              </label>
              <input
                className={inputClass}
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Street, building, apt"
                autoComplete="street-address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  City
                </label>
                <input
                  className={inputClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  State
                </label>
                <input
                  className={inputClass}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State / Province"
                  autoComplete="address-level1"
                />
              </div>
            </div>
            <div className="sm:max-w-xs">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ZIP code
              </label>
              <input
                className={inputClass}
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP / Postal"
                autoComplete="postal-code"
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-6 w-full border-2 border-border font-black uppercase tracking-wider shadow-[4px_4px_0_rgba(0,0,0,0.2)] sm:w-auto dark:shadow-[4px_4px_0_rgba(255,255,255,0.08)]"
            disabled={saving}
            onClick={() => void handleSaveAddress()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            SAVE ADDRESS
          </Button>
        </section>

        {/* Payment placeholder */}
        <section
          className={cn(
            "rounded-2xl border-2 border-border bg-card p-6 shadow-[6px_6px_0_rgba(0,0,0,0.12)]",
            "dark:border-white/10 dark:bg-zinc-950 dark:shadow-[6px_6px_0_rgba(255,255,255,0.06)]"
          )}
        >
          <h2 className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Payment method
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className={cn(
                "flex min-h-[120px] flex-1 flex-col justify-between rounded-xl border-2 border-border bg-background p-4 shadow-sm",
                "dark:border-white/10 dark:bg-black/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Card
                </span>
                <CreditCard className="h-8 w-8 text-brand-primary" />
              </div>
              <div>
                <p className="font-mono text-sm text-muted-foreground">•••• •••• •••• ••••</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  PCI-safe · No card data stored here
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-12 border-2 border-border bg-muted/40 font-black uppercase tracking-wider shadow-[4px_4px_0_rgba(0,0,0,0.15)] dark:bg-white/5 dark:shadow-[4px_4px_0_rgba(255,255,255,0.06)]"
              onClick={handleLinkPayment}
            >
              LINK PAYMENT METHOD
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
