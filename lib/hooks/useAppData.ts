"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type {
  Brand,
  Product,
  Gig,
  Event,
  Profile,
  UserGig,
  Transaction,
  Order,
} from "@/lib/types";
import type { School } from "@/lib/schools";
import { getSchoolByCampus, getSchoolByAppTheme } from "@/lib/schools";
import {
  ORDERS_COLUMNS_EXTENDED,
  ORDERS_COLUMNS_MIN,
  isMissingColumnPostgrestError,
} from "@/lib/orders-select";
import { getWalletActivity } from "@/app/actions/wallet-activity";
import type { WalletActivityItem } from "@/app/actions/wallet-activity";

export interface EventApplication {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  created_at: string;
  event?: import("@/lib/types").Event | null;
}

export interface UseAppDataReturn {
  user: User | null;
  profile: Profile | null;
  /** Theme colors from `profile.app_theme` */
  themeSchool: School | null;
  /** Campus label from `profile.campus` */
  campusSchool: School | null;
  publicGigs: Gig[];
  publicProducts: Product[];
  brands: Brand[];
  events: Event[];
  userGigs: UserGig[];
  eventApplications: EventApplication[];
  orders: Order[];
  transactions: Transaction[];
  /** Unified ledger: transactions, orders, withdrawals, gig payouts, etc. */
  walletActivity: WalletActivityItem[];
  isLoadingPublic: boolean;
  isLoadingPrivate: boolean;
  refetchPrivate: (opts?: { silent?: boolean; clearFirst?: boolean }) => Promise<void>;
}

export function useAppData(): UseAppDataReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [themeSchool, setThemeSchool] = useState<School | null>(null);
  const [campusSchool, setCampusSchool] = useState<School | null>(null);
  const [publicGigs, setPublicGigs] = useState<Gig[]>([]);
  const [publicProducts, setPublicProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [userGigs, setUserGigs] = useState<UserGig[]>([]);
  const [eventApplications, setEventApplications] = useState<EventApplication[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletActivity, setWalletActivity] = useState<WalletActivityItem[]>([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(false);

  const supabase = createClient();

  // Public data (no auth)
  const fetchPublicData = useCallback(async () => {
    setIsLoadingPublic(true);
    try {
      const [gigsRes, productsRes, brandsRes, eventsRes] = await Promise.all([
        supabase
          .from("gigs")
          .select("*, brand:brands(*)")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("*, brand:brands(*)")
          .order("created_at", { ascending: false }),
        supabase.from("brands").select("*").order("name"),
        supabase.from("events").select("*").order("created_at", { ascending: false }),
      ]);

      if (gigsRes.data) setPublicGigs(gigsRes.data as Gig[]);
      if (productsRes.data) setPublicProducts(productsRes.data as Product[]);
      if (brandsRes.data) setBrands(brandsRes.data as Brand[]);
      if (eventsRes.data) setEvents(eventsRes.data as Event[]);
    } catch (e) {
      console.error("[useAppData] Public fetch error:", e);
    } finally {
      setIsLoadingPublic(false);
    }
  }, [supabase]);

  // Private data (requires `userId`)
  const fetchPrivateData = useCallback(
    async (userId: string, silent = false, clearFirst = false) => {
      if (clearFirst) setOrders([]);
      if (!silent) setIsLoadingPrivate(true);
      try {
        const [profileRes, userGigsRes, eventAppsRes, txRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase
            .from("user_gigs")
            .select("*, gig:gigs(*, brand:brands(*))")
            .eq("user_id", userId)
            .order("applied_at", { ascending: false }),
          supabase
            .from("event_applications")
            .select("*, event:events(*)") // join events; alias singular `event`
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        const ordersExtRes = await supabase
          .from("orders")
          .select(ORDERS_COLUMNS_EXTENDED)
          .eq("user_id", userId)
          .not("id", "is", null)
          .order("created_at", { ascending: false });

        let ordersData: Order[] | null = null;
        let ordersErr = ordersExtRes.error;

        if (ordersExtRes.error && isMissingColumnPostgrestError(ordersExtRes.error)) {
          console.warn(
            "[useAppData] orders extended columns missing; retry with core columns only."
          );
          const ordersCoreRes = await supabase
            .from("orders")
            .select(ORDERS_COLUMNS_MIN)
            .eq("user_id", userId)
            .not("id", "is", null)
            .order("created_at", { ascending: false });
          ordersErr = ordersCoreRes.error;
          ordersData = (ordersCoreRes.data as Order[] | null) ?? null;
        } else if (!ordersExtRes.error) {
          ordersData = (ordersExtRes.data as Order[] | null) ?? null;
        }

        if (profileRes.error) console.error("[useAppData] Profile fetch error:", profileRes.error);
        if (profileRes.data) setProfile(profileRes.data as Profile);
        else setProfile(null);

        const p = profileRes.data as Profile | null;
        const [themeS, campusS] = await Promise.all([
          getSchoolByAppTheme(p?.app_theme ?? null),
          getSchoolByCampus(p?.campus ?? null),
        ]);
        setThemeSchool(themeS);
        setCampusSchool(campusS);

        if (userGigsRes.error) console.error("Fetch UserGigs Error:", userGigsRes.error);
        if (userGigsRes.data) setUserGigs(userGigsRes.data as UserGig[]);
        else setUserGigs([]);

        if (eventAppsRes.error) {
          console.error("[useAppData] Event applications fetch error:", eventAppsRes.error);
          setEventApplications([]);
        } else {
          const rawData = eventAppsRes.data ?? [];
          const apps = (rawData as { event?: unknown; events?: unknown }[]).map((row) => {
            const eventOrEvents = row.event ?? row.events;
            const resolved = Array.isArray(eventOrEvents) ? eventOrEvents[0] : eventOrEvents;
            return { ...row, event: resolved };
          });
          setEventApplications(apps as EventApplication[]);
        }

        if (ordersErr) {
          console.error("[useAppData] Orders fetch error:", ordersErr);
          setOrders([]);
        } else if (ordersData) {
          setOrders(ordersData);
        } else {
          setOrders([]);
        }

        if (txRes.error) console.error("[useAppData] Transactions fetch error:", txRes.error);
        if (txRes.data) setTransactions(txRes.data as Transaction[]);
        else setTransactions([]);

        try {
          const activity = await getWalletActivity();
          setWalletActivity(activity);
        } catch (actErr) {
          console.error("[useAppData] getWalletActivity:", actErr);
          setWalletActivity([]);
        }
      } catch (e) {
        console.error("[useAppData] Private fetch error:", e);
      } finally {
        if (!silent) setIsLoadingPrivate(false);
      }
    },
    [supabase]
  );

  const refetchPrivate = useCallback(
    async (opts?: { silent?: boolean; clearFirst?: boolean }) => {
      if (user?.id)
        await fetchPrivateData(user.id, opts?.silent, opts?.clearFirst);
    },
    [user?.id, fetchPrivateData]
  );

  // Initial public load
  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  // Auth → private data
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (!u) {
          setProfile(null);
          Promise.all([
            getSchoolByAppTheme(null),
            getSchoolByCampus(null),
          ]).then(([t, c]) => {
            setThemeSchool(t);
            setCampusSchool(c);
          });
          setUserGigs([]);
          setEventApplications([]);
          setOrders([]);
          setTransactions([]);
          setWalletActivity([]);
          setIsLoadingPrivate(false);
        } else {
          fetchPrivateData(u.id, false);
        }
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchPrivateData(u.id, false);
      else setIsLoadingPrivate(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase, fetchPrivateData]);

  /**
   * Supabase Realtime: any change to this user’s `orders` rows triggers a silent refetch.
   * Enable replication for `public.orders` (INSERT/UPDATE/DELETE) in the Dashboard; edits in
   * Table Editor should flow to drawers / profile order lists within a few seconds without reload.
   */
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`app-data-orders-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          void fetchPrivateData(uid, true, false);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "[useAppData] Realtime on orders failed — enable replication for table `orders` in Supabase Dashboard."
          );
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, fetchPrivateData]);

  return {
    user,
    profile,
    themeSchool,
    campusSchool,
    publicGigs,
    publicProducts,
    brands,
    events,
    userGigs,
    eventApplications,
    orders,
    transactions,
    walletActivity,
    isLoadingPublic,
    isLoadingPrivate,
    refetchPrivate,
  };
}
