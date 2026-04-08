"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import type { TabId } from "@/components/bottom-nav";
import { HomeFeed } from "@/components/home-feed";
import { GigDetail } from "@/components/gig-detail";
import { MyGigs } from "@/components/my-gigs";
import { PerksShop } from "@/components/perks-shop";
import { UserProfile } from "@/components/user-profile";
import type { ProfileDrawerKey } from "@/components/user-profile";
import { Drawer, DrawerContent, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { X } from "lucide-react";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { VerificationDrawer } from "@/components/drawers/verification-drawer";
import { WalletDrawer } from "@/components/drawers/wallet-drawer";
import { ReferralsDrawer } from "@/components/drawers/referrals-drawer";
import { UGCDrawer } from "@/components/drawers/ugc-drawer";
import { SubmitUgcDrawer } from "@/components/drawers/submit-ugc-drawer";
import { EliteTracksDrawer } from "@/components/drawers/elite-tracks-drawer";
import { MyOrdersDrawer } from "@/components/drawers/my-orders-drawer";
import { MyEventsDrawer } from "@/components/drawers/my-events-drawer";
import { AdminChallengeModal } from "@/components/drawers/admin-challenge-modal";
import { SettingsDrawer } from "@/components/drawers/settings-drawer";
import { AdminReview } from "@/components/admin-review";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { SmartOnboarding } from "@/components/smart-onboarding";
import type { Gig, UserGig } from "@/lib/types";
import type { FeedNotificationNavAction } from "@/lib/feed-notifications";

export default function Page() {
  const searchParams = useSearchParams();
  const { user, profile, isLoadingPrivate, setPreviewAppTheme } = useAppDataContext();
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("feed");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["feed", "gigs", "shop", "profile"].includes(tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [profileDrawer, setProfileDrawer] = useState<ProfileDrawerKey | null>(null);
  const [preselectedUserGigForUGC, setPreselectedUserGigForUGC] = useState<UserGig | null>(null);
  const [adminChallengeOpen, setAdminChallengeOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  const handleSelectGig = useCallback((gig: Gig) => {
    if (!user) {
      setActiveTab("profile");
      return;
    }
    setSelectedGig(gig);
  }, [user]);
  const handleBack = useCallback(() => setSelectedGig(null), []);
  const handleTabChange = useCallback((tab: TabId) => {
    setSelectedGig(null);
    setActiveTab(tab);
  }, []);

  /** From Settings: close drawer first, then open admin password modal */
  const handleRequestAdminFromSettings = useCallback(() => {
    setProfileDrawer(null);
    setAdminChallengeOpen(true);
  }, []);

  const handleAdminSuccess = useCallback(() => {
    setAdminChallengeOpen(false);
    setIsAdminUnlocked(true);
  }, []);

  const handleExitAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
  }, []);

  const handleNavigateToShop = useCallback(() => {
    setProfileDrawer(null);
    setActiveTab("shop");
  }, []);

  const handleNavigateToEvents = useCallback(() => {
    setProfileDrawer(null);
    setActiveTab("feed");
    requestAnimationFrame(() => {
      setTimeout(() => {
        document
          .getElementById("events-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    });
  }, []);

  const handleFeedNotificationNavigate = useCallback(
    (action: FeedNotificationNavAction) => {
      setSelectedGig(null);
      if (action.kind === "drawer") {
        setActiveTab("profile");
        setProfileDrawer(action.key);
        return;
      }
      if (action.kind === "tab") {
        setProfileDrawer(null);
        setActiveTab(action.tab);
        return;
      }
      setProfileDrawer(null);
      setActiveTab("feed");
      requestAnimationFrame(() => {
        setTimeout(() => {
          document
            .getElementById(action.id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      });
    },
    [],
  );

  const showMainApp = !!user || skippedOnboarding;

  if (!showMainApp) {
    return (
      <OnboardingFlow
        isLoggedIn={!!user}
        onComplete={() => setSkippedOnboarding(true)}
      />
    );
  }

  const mainContent = isAdminUnlocked ? (
    <AdminReview onExitAdmin={handleExitAdmin} />
  ) : selectedGig ? (
    <GigDetail gig={selectedGig} onBack={handleBack} />
  ) : activeTab === "feed" ? (
    <HomeFeed
      onSelectGig={handleSelectGig}
      onRequestLogin={() => setActiveTab("profile")}
      onNotificationNavigate={handleFeedNotificationNavigate}
    />
  ) : activeTab === "gigs" ? (
    <MyGigs
      onSelectGig={handleSelectGig}
      onOpenUGC={(userGig) => {
        setPreselectedUserGigForUGC(userGig);
        setProfileDrawer("ugc");
      }}
    />
  ) : activeTab === "shop" ? (
    <PerksShop />
  ) : (
    <UserProfile
      user={user}
      profile={profile}
      isLoadingProfile={isLoadingPrivate}
      onOpenDrawer={setProfileDrawer}
    />
  );

  const drawerLabels: Record<ProfileDrawerKey, string> = {
    wallet: "My Wallet & Earnings",
    verification: "Verification & Elite",
    elite: "Elite Tracks",
    ugc: "Submit UGC",
    orders: "My Orders",
    events: "My Events",
    referrals: "Invite Friends",
    settings: "Settings",
  };

  const isViewUGCStatus =
    profileDrawer === "ugc" &&
    preselectedUserGigForUGC &&
    (preselectedUserGigForUGC.status === "completed" ||
      preselectedUserGigForUGC.status === "paid");
  const drawerTitle = profileDrawer
    ? isViewUGCStatus
      ? "Brand Co-Creations"
      : drawerLabels[profileDrawer]
    : "";

  const renderDrawerContent = () => {
    if (!profileDrawer) return null;
    switch (profileDrawer) {
      case "wallet":
        return <WalletDrawer />;
      case "verification":
        return <VerificationDrawer />;
      case "elite":
        return <EliteTracksDrawer />;
      case "ugc":
        // completed/paid: Brand Co-Creations status; otherwise submit flow
        return isViewUGCStatus ? (
          <UGCDrawer preselectedUserGig={preselectedUserGigForUGC} />
        ) : preselectedUserGigForUGC ? (
          <SubmitUgcDrawer
            userGig={preselectedUserGigForUGC}
            onSuccess={() => {
              setProfileDrawer(null);
              setPreselectedUserGigForUGC(null);
            }}
          />
        ) : (
          <UGCDrawer preselectedUserGig={null} />
        );
      case "orders":
        return (
          <MyOrdersDrawer
            open={profileDrawer === "orders"}
            onShopDrops={handleNavigateToShop}
          />
        );
      case "events":
        return <MyEventsDrawer onExploreEvents={handleNavigateToEvents} />;
      case "referrals":
        return <ReferralsDrawer />;
      case "settings":
        return (
          <SettingsDrawer onRequestAdminAccess={handleRequestAdminFromSettings} />
        );
      default:
        return null;
    }
  };

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-5xl xl:max-w-7xl"
      role="main"
    >
      <div className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-12 sm:px-6 md:px-8 lg:px-10">
        {mainContent}
      </div>

      {!selectedGig && !isAdminUnlocked && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {!isAdminUnlocked && (
        <SmartOnboarding suppressWhen={!!selectedGig} />
      )}

      <AdminChallengeModal
        open={adminChallengeOpen}
        onClose={() => setAdminChallengeOpen(false)}
        onSuccess={handleAdminSuccess}
      />

      <Drawer
        open={!!profileDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setProfileDrawer(null);
            setPreselectedUserGigForUGC(null);
            setPreviewAppTheme(null);
          }
        }}
      >
        <DrawerContent className="max-h-[95vh] border-t-2 border-border bg-card text-card-foreground [&>div:first-child]:bg-muted dark:border-white/10 dark:bg-zinc-950 dark:[&>div:first-child]:bg-white/20">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-4 dark:border-white/10">
            <DrawerTitle className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
              {drawerTitle}
            </DrawerTitle>
            <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground dark:bg-white/10">
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>
          <div className="min-w-0 px-4 pb-8 pt-5">
            {renderDrawerContent()}
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
