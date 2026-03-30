import type { Metadata } from "next";
import { BrutalLandingPage } from "@/components/landing/brutal-landing-page";

export const metadata: Metadata = {
  title: "Axelerate — Pioneer Campus Platform",
  description:
    "The operating system for Gen-Z campus commerce. Feed, My Gigs, Perks Shop — earn money, unlock perks, level up.",
};

export default function LandingMarketingPage() {
  return <BrutalLandingPage />;
}
