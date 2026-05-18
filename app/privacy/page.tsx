import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LegalBackNav } from "@/components/legal/legal-back-nav";

export const metadata: Metadata = {
  title: "Privacy Policy | Axelerate",
  description: "Axelerate Inc. Privacy Policy and TCPA disclosure",
};

const LEGAL_DATE = "May 11, 2026";
const LEGAL_EMAIL = "admin@axelerateglobal.com";

function CriticalBanner({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 rounded-xl border-2 border-amber-500/55 bg-amber-500/10 px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] md:px-5">
      <div className="font-mono text-[11px] font-bold uppercase leading-snug tracking-wide text-white md:text-xs">
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 border-b-2 border-b-emerald-400/35 pb-2 font-mono text-base font-black uppercase tracking-[0.12em] text-emerald-400 first:mt-0 md:text-lg">
      {children}
    </h2>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-gray-300">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-8 lg:max-w-4xl lg:pt-12">
        <LegalBackNav />

        <header className="mb-10 border-b-2 border-black pb-8 shadow-[0_6px_0_0_#34d399]">
          <p className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.35em] text-purple-400">
            PRIVACY POLICY
          </p>
          <h1 className="font-display text-balance text-4xl font-black uppercase leading-[1.05] tracking-tight text-white md:text-5xl">
            Axelerate Inc.
          </h1>
          <p className="mt-4 font-mono text-sm font-bold text-zinc-400">
            Last Updated: {LEGAL_DATE}
          </p>
        </header>

        <article className="space-y-5 text-[15px] leading-relaxed md:text-base">
          <p>
            This Privacy Policy explains how Axelerate Inc. collects, uses, and shares your personal
            information. By using our Service, you consent to the practices described below.
          </p>

          <SectionTitle>1. Information We Collect</SectionTitle>
          <ul className="space-y-3 rounded-xl border-2 border-zinc-800 bg-zinc-900/70 p-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.85)]">
            <li>
              <strong className="font-mono text-emerald-400">Identifiers:&nbsp;</strong>
              Name, .edu email address, phone number, and physical shipping address.
            </li>
            <li>
              <strong className="font-mono text-emerald-400">Social &amp; Creator Data:&nbsp;</strong>
              Social media handles (for example TikTok/Instagram links), follower counts, and engagement
              metrics.
            </li>
            <li>
              <strong className="font-mono text-emerald-400">Survey &amp; Consumer Intel:&nbsp;</strong>
              Preferences, budgets, and brand affinities collected through our &quot;Bounty&quot;
              modules.
            </li>
          </ul>

          <SectionTitle>2. TCPA Disclosure &amp; SMS Communications (Crucial)</SectionTitle>
          <p>
            If you explicitly opt in to receive SMS notifications from us (by checking the optional
            SMS box during registration):
          </p>
          <ul className="list-disc space-y-3 ps-6 marker:text-amber-400">
            <li>
              You consent to receive&nbsp;
              <strong className="text-white">automated promotional and transactional&nbsp;</strong>
              text messages (for example OTP codes, Drop alerts, Gig notifications) from Axelerate at the
              phone number provided.
            </li>
            <li>
              <strong className="text-white">Consent is not a condition of any purchase.</strong>
            </li>
            <li>Message and data rates may apply.</li>
            <li>
              You may opt out at any time by replying&nbsp;
              <strong className="text-white">STOP</strong> to any message. Reply{" "}
              <strong className="text-white">HELP</strong> for assistance.
            </li>
          </ul>
          <CriticalBanner>
            CONSENT IS NOT A CONDITION OF ANY PURCHASE. MESSAGE AND DATA RATES MAY APPLY — REPLY STOP
            TO OPT OUT.
          </CriticalBanner>

          <SectionTitle>3. California Privacy Rights (CCPA / CPRA)</SectionTitle>
          <p>
            Under the California Consumer Privacy Act, California residents have specific rights
            regarding their personal information:
          </p>
          <ul className="list-decimal space-y-3 ps-6 marker:font-semibold marker:text-purple-400">
            <li>
              <strong className="text-white">Right to Know / Access:&nbsp;</strong>
              You may request details about the categories of data we collect.
            </li>
            <li>
              <strong className="text-white">Right to Delete:&nbsp;</strong>
              You may request the deletion of your personal data.
            </li>
            <li>
              <strong className="text-white">&nbsp;Do Not Sell My Personal Information:&nbsp;</strong>
              Axelerate does not &quot;sell&quot; your personal data to traditional data brokers.
              However, we may share aggregated &quot;Consumer Intel&quot; with brand partners.
            </li>
          </ul>
          <p className="rounded-lg border border-zinc-700 bg-black/40 p-4">
            You have the right to opt out of this sharing by contacting us at&nbsp;
            <Link
              href={`mailto:${LEGAL_EMAIL}`}
              className="font-mono font-bold text-purple-400 underline underline-offset-4 hover:text-purple-300"
            >
              {LEGAL_EMAIL}
            </Link>
            .
          </p>

          <SectionTitle>4. Data Security and Retention</SectionTitle>
          <p>
            We implement industry-standard encryption to protect your data. We retain your information
            only as long as necessary to fulfill the purposes outlined in this policy or to comply
            with legal obligations.
          </p>
        </article>

        <footer className="mt-16 border-t-2 border-zinc-800 pt-8">
          <LegalBackNav className="mb-0" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Walnut, CA · Axelerate Inc.
          </p>
        </footer>
      </div>
    </div>
  );
}
