"use client";

import { useState } from "react";
import {
  Package,
  ShieldCheck,
  MapPin,
  CreditCard,
  Check,
  X,
  QrCode,
  Camera,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Lock,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockStarterKit, mockUser } from "@/lib/data";

type CheckoutStep = "overview" | "address" | "payment" | "success" | "qr-scan";

export function StarterKitCheckout() {
  const [step, setStep] = useState<CheckoutStep>("overview");
  const [hasPurchased, setHasPurchased] = useState(mockUser.starterKitPurchased);
  const [address, setAddress] = useState(mockUser.shippingAddress);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const isVerified = mockUser.verificationLevel >= 2;
  const kit = mockStarterKit;

  const handleCheckout = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setHasPurchased(true);
      setStep("success");
    }, 2000);
  };

  // Already purchased state
  if (hasPurchased && step !== "success") {
    return (
      <div className="pb-4">
        <header className="mb-6 px-1">
          <div className="mb-1 flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Welcome Offer
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
            Starter Kit
          </h1>
        </header>

        <div className="flex flex-col items-center rounded-2xl border border-brand-primary/20 bg-brand-primary/5 px-6 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-1 text-xl font-black text-foreground">
            Already Claimed
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {"You've already purchased your Glow Starter Kit. Limit 1 per user."}
          </p>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Order status</p>
            <p className="text-sm font-bold text-brand-primary">Shipped - In Transit</p>
          </div>
        </div>
      </div>
    );
  }

  // QR Scan-to-Claim screen
  if (step === "qr-scan" || showQrScanner) {
    return (
      <div className="pb-4">
        <button
          onClick={() => {
            setShowQrScanner(false);
            setStep("overview");
          }}
          className="mb-6 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Back
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-primary">
            <QrCode className="h-3 w-3" />
            Pop-Up Event
          </div>
          <h2 className="mb-2 text-2xl font-black uppercase tracking-tight text-foreground">
            Scan to Claim
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Scan the QR code at any Axelerate pop-up booth for an instant
            in-person pickup. No shipping fee.
          </p>

          {/* Camera viewfinder mockup */}
          <div className="relative mb-6 aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl border-2 border-dashed border-brand-primary/30 bg-card">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Corner brackets */}
                <div className="absolute -left-4 -top-4 h-8 w-8 border-l-2 border-t-2 border-brand-primary" />
                <div className="absolute -right-4 -top-4 h-8 w-8 border-r-2 border-t-2 border-brand-primary" />
                <div className="absolute -bottom-4 -left-4 h-8 w-8 border-b-2 border-l-2 border-brand-primary" />
                <div className="absolute -bottom-4 -right-4 h-8 w-8 border-b-2 border-r-2 border-brand-primary" />
                <Camera className="h-12 w-12 text-muted-foreground/30" />
              </div>
            </div>
            {/* Scan line animation */}
            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-brand-primary/40 animate-pulse" />
          </div>

          <p className="mb-4 text-xs text-muted-foreground">
            Point your camera at the booth QR code
          </p>

          {/* Simulated scan success */}
          <button
            onClick={() => {
              setShowQrScanner(false);
              setStep("success");
              setHasPurchased(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
          >
            <QrCode className="h-4 w-4" />
            Simulate Scan
          </button>

          <div className="mt-6 rounded-xl border border-border bg-card p-4 text-left">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              How it works
            </h4>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-bold text-brand-primary">
                  1
                </span>
                Visit an Axelerate pop-up booth on campus
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-bold text-brand-primary">
                  2
                </span>
                Scan the booth QR code with this screen
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-bold text-brand-primary">
                  3
                </span>
                Pay the discounted price and pick up immediately
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="animate-count-up mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-primary">
          <Check className="h-10 w-10 text-white" />
        </div>
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight text-foreground">
          Order Placed!
        </h1>
        <p className="mb-6 max-w-xs text-sm text-muted-foreground">
          Your {kit.name} is on its way. Start creating content to earn your
          rebate!
        </p>
        <div className="mb-8 w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Order Summary
            </span>
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-primary">
              Confirmed
            </span>
          </div>
          <p className="mb-1 text-sm font-bold text-foreground">{kit.name}</p>
          <p className="mb-3 text-xs text-muted-foreground">{kit.brand}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-brand-primary">${kit.discountedPrice}</span>
            <span className="text-sm text-muted-foreground line-through">${kit.originalPrice}</span>
            <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-black text-destructive">
              {kit.discount}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-left">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <div>
              <p className="text-xs font-bold text-foreground">Earn a Full Rebate</p>
              <p className="text-[11px] text-muted-foreground">
                Post quality UGC content and get your $12 back as cashback (Top
                20%) or earn points.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Address step
  if (step === "address") {
    return (
      <div className="pb-4">
        <button
          onClick={() => setStep("overview")}
          className="mb-6 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Back
        </button>

        <h2 className="mb-1 text-2xl font-black uppercase tracking-tight text-foreground">
          Shipping Address
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Where should we send your kit?
        </p>

        <div className="mb-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-xs text-foreground">
              <span className="font-bold">Limit 1 per address.</span> Each
              shipping address can only receive one Starter Kit to prevent
              abuse.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label
            htmlFor="address"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Full Address
          </label>
          <div className="flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 focus-within:border-brand-primary/50 focus-within:ring-1 focus-within:ring-brand-primary/20">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Apt 4, City, State ZIP"
              rows={3}
              className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <button
          onClick={() => setStep("payment")}
          disabled={!address.trim()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            address.trim()
              ? "bg-brand-primary text-white active:scale-[0.98]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          Continue to Payment
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Payment step
  if (step === "payment") {
    return (
      <div className="pb-4">
        <button
          onClick={() => setStep("address")}
          className="mb-6 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Back
        </button>

        <h2 className="mb-1 text-2xl font-black uppercase tracking-tight text-foreground">
          Confirm Order
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">Review your order before paying</p>

        {/* Order summary card */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
              <Package className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{kit.name}</p>
              <p className="text-xs text-muted-foreground">{kit.brand}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {kit.items.map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-brand-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping address */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Ship to
          </div>
          <p className="text-sm font-medium text-foreground">{address}</p>
        </div>

        {/* Price breakdown */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground line-through">${kit.originalPrice}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-3 text-sm">
            <span className="text-brand-primary font-medium">Student Discount ({kit.discount})</span>
            <span className="font-bold text-brand-primary">-${kit.originalPrice - kit.discountedPrice}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-3 text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-medium text-foreground">Free</span>
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-2xl font-black text-brand-primary">${kit.discountedPrice}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={isProcessing}
          className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
        >
          {isProcessing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay ${kit.discountedPrice}
            </>
          )}
        </button>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Secured by Stripe
        </div>
      </div>
    );
  }

  // Overview (default)
  return (
    <div className="pb-4">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Gift className="h-5 w-5 text-brand-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
            Welcome Offer
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
          Glow Starter Kit
        </h1>
        <p className="text-sm text-muted-foreground">
          Your gateway to Axelerate. One per student.
        </p>
      </header>

      {/* Product Card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-brand-primary/20">
        <div className="flex h-48 items-center justify-center bg-secondary/50">
          <Package className="h-16 w-16 text-muted-foreground/20" />
        </div>
        <div className="bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-black uppercase text-destructive">
              {kit.discount}
            </span>
            <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-primary">
              Student Exclusive
            </span>
          </div>
          <h2 className="mb-1 text-xl font-black text-foreground">{kit.name}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{kit.brand}</p>
          <p className="mb-4 text-sm leading-relaxed text-foreground/80">
            {kit.description}
          </p>

          {/* Kit contents */}
          <div className="mb-4 rounded-xl bg-secondary/50 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {"What's Inside"}
            </p>
            <div className="flex flex-col gap-1.5">
              {kit.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-foreground">
                  <Check className="h-3 w-3 shrink-0 text-brand-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-brand-primary">
              ${kit.discountedPrice}
            </span>
            <span className="text-lg text-muted-foreground line-through">
              ${kit.originalPrice}
            </span>
          </div>
        </div>
      </div>

      {/* Verification gate */}
      {!isVerified && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Student Verification Required
              </p>
              <p className="text-xs text-muted-foreground">
                Verify your .edu email or upload a Student ID to unlock the 50%
                discount. Go to the Verify tab to get started.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Constraints notice */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Purchase Rules
        </h3>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
            Limit 1 purchase per user account
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
            Limit 1 per device and shipping address
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
            Requires verified .edu email or Student ID
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setStep("address")}
          disabled={!isVerified}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            isVerified
              ? "bg-brand-primary text-white active:scale-[0.98] animate-pulse-glow"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isVerified ? (
            <>
              <CreditCard className="h-4 w-4" />
              Buy for ${kit.discountedPrice}
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Verify to Unlock
            </>
          )}
        </button>

        <button
          onClick={() => setShowQrScanner(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-sm font-bold uppercase tracking-wider text-foreground transition-all hover:border-brand-primary/30 active:scale-[0.98]"
        >
          <QrCode className="h-4 w-4" />
          Scan to Claim at Pop-Up
        </button>
      </div>
    </div>
  );
}
