import React from "react";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Space_Grotesk, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppDataProvider } from "@/lib/context/app-data-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeWrapper } from "@/components/theme-wrapper";
import { SupabaseOAuthCodeForward } from "@/components/auth/supabase-oauth-code-forward";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Axelerate - Pioneer Campus Platform",
  description:
    "The operating system for Gen-Z campus commerce. Earn money, unlock perks, level up.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#18181B" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AppDataProvider>
            <SupabaseOAuthCodeForward />
            <ThemeWrapper>{children}</ThemeWrapper>
          </AppDataProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                title: "!font-semibold !text-sm !text-foreground",
                description: "!text-xs !text-muted-foreground",
                success: "!border-primary/40",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
