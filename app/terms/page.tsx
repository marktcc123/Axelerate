import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalBackNav } from "@/components/legal/legal-back-nav";

export const metadata: Metadata = {
  title: "Terms of Service | Axelerate",
  description: "Axelerate Inc. Terms of Service",
};

const LEGAL_DATE = "May 11, 2026";

function CriticalBanner({ children }: { children: ReactNode }) {
  return (
    <p className="my-6 rounded-xl border-2 border-amber-500/55 bg-amber-500/10 px-4 py-3 font-mono text-[11px] font-bold uppercase leading-snug tracking-wide text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)] md:text-xs">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 border-b-2 border-b-purple-400/40 pb-2 font-mono text-base font-black uppercase tracking-[0.12em] text-purple-400 first:mt-0 md:text-lg">
      {children}
    </h2>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-gray-300">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-8 lg:max-w-4xl lg:pt-12">
        <LegalBackNav />

        <header className="mb-10 border-b-2 border-black shadow-[0_6px_0_0_var(--furniture-primary,#a855f7)] pb-8">
          <p className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">
            TERMS OF SERVICE
          </p>
          <h1 className="font-display text-balance text-4xl font-black uppercase leading-[1.05] tracking-tight text-white md:text-5xl">
            Axelerate Inc.
          </h1>
          <p className="mt-4 font-mono text-sm font-bold text-zinc-400">
            Last Updated: {LEGAL_DATE}
            <br />
            Effective Date: {LEGAL_DATE}
          </p>
        </header>

        <article className="space-y-5 text-[15px] leading-relaxed md:text-base">
          <p>
            Welcome to Axelerate. These Terms of Service (&quot;Terms&quot;) govern your access to and
            use of the Axelerate platform, website, and related services (collectively, the
            &quot;Service&quot;) provided by Axelerate Inc. (&quot;Axelerate&quot;, &quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;), headquartered in Walnut, California.
          </p>

          <CriticalBanner>
            BY CHECKING THE BOX, REGISTERING FOR AN ACCOUNT, OR USING THE SERVICE, YOU AGREE TO BE
            BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE SERVICE.
          </CriticalBanner>

          <SectionTitle>
            1. Platform Nature and Dropshipping Acknowledgment (FTC Compliance)
          </SectionTitle>
          <p>
            Axelerate operates as a curated promotional platform and a dropshipping marketplace. You
            acknowledge that certain products (&quot;Drops&quot;) are fulfilled globally by
            third-party suppliers.
          </p>
          <ul className="list-none space-y-3 rounded-xl border-2 border-zinc-800 bg-zinc-900/70 p-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.85)]">
            <li>
              <strong className="text-white">&nbsp;Shipping Times:&nbsp;</strong>
              Standard fulfillment and shipping may take 10 to 15 business days or longer.
            </li>
            <li>
              <strong className="text-white">&nbsp;Returns/Refunds:&nbsp;</strong>
              All returns and refunds are subject to the policies of the original supplier. Axelerate
              acts only as an intermediary and disclaims liability for supplier-side delays or
              defects.
            </li>
          </ul>

          <SectionTitle>
            2. Virtual Credits and Points Policy (FinCEN / Financial Regulation Exemption)
          </SectionTitle>
          <p>
            The Service may offer virtual &quot;Credits,&quot; &quot;XP,&quot; or other loyalty
            points.
          </p>
          <div className="space-y-3 rounded-xl border-2 border-rose-500/35 bg-rose-950/30 p-4">
            <p>
              <strong className="rounded-sm bg-yellow-400/90 px-1.5 py-0.5 text-sm font-black text-zinc-950">
                NO CASH VALUE
              </strong>
              <span className="inline text-gray-300">
                : Credits are promotional, game-based rewards only. They hold{" "}
                <strong className="text-white">&nbsp;$0.00 USD&nbsp;</strong> cash value, are strictly
                non-transferable, and cannot be redeemed for fiat currency.
              </span>
            </p>
            <p>
              <strong className="text-white">Expiration:&nbsp;</strong>
              Axelerate reserves the absolute right to expire Credits after 6 months of account
              inactivity, or to modify the redemption conversion rate at any time without prior
              notice.
            </p>
          </div>

          <SectionTitle>3. Independent Contractor Status (California AB5 Compliance)</SectionTitle>
          <p>
            If you participate in paid gigs, marketing campaigns, or ambassador programs via
            Axelerate, you expressly agree that:
          </p>
          <ul className="list-decimal space-y-3 ps-6 marker:font-bold marker:text-purple-400">
            <li>
              You are acting as an&nbsp;
              <strong className="text-white">&nbsp;Independent Contractor (1099)&nbsp;</strong>
              &nbsp;and not as an employee, partner, or agent of Axelerate.
            </li>
            <li>You control your own hours, methods, and location of work.</li>
            <li>
              You are solely responsible for declaring your income and paying applicable state and
              federal taxes. Axelerate will issue a&nbsp;
              <strong className="text-white">&nbsp;1099-NEC&nbsp;</strong>
              form if your annual earnings (including the value of free products) exceed $600.
            </li>
          </ul>

          <SectionTitle>4. Endorsement Disclosures (FTC Guidelines)</SectionTitle>
          <p>
            When promoting Axelerate or its partner brands on social media (for example TikTok or
            Instagram), you are legally required to clearly and conspicuously disclose your material
            connection. You must use hashtags such as <strong className="text-white">#ad</strong>,{" "}
            <strong className="text-white">#sponsored</strong>, or{" "}
            <strong className="text-white">#AxeleratePartner</strong> in the caption or video. Failure
            to do so may result in immediate account termination and forfeiture of all Credits.
          </p>

          <SectionTitle>
            5. Dispute Resolution: Binding Individual Arbitration and Class Action Waiver
          </SectionTitle>
          <p>
            Any dispute, claim, or controversy arising out of these Terms or the breach thereof shall
            be settled by binding individual arbitration administered by the American Arbitration
            Association (AAA), rather than in court.
          </p>
          <CriticalBanner>
            YOU AND AXELERATE WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE
            ARBITRATION.
          </CriticalBanner>
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
