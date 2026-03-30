export type GigType = "digital" | "physical";
export type GigStatus =
  | "open"
  | "applied"
  | "approved"
  | "completed"
  | "paid";
export type Tier = "scout" | "partner" | "city-manager";

// Verification levels for Trust & Verification Flow
export type VerificationLevel = 1 | 2 | 3;
export type WalletType = "cash" | "points";

// V2.1: UGC Content Submission
export type ContentStatus = "pending" | "approved" | "rejected";
export type RewardType = "points" | "cashback";
export type RejectionReason = "low-quality" | "no-face" | "fake-ai";

// V2.1: Staffing Tracks
export type StaffingTrack = "event-staff" | "campus-manager";

export interface Gig {
  id: string;
  title: string;
  brand: string;
  type: GigType;
  pay: string;
  payAmount: number;
  description: string;
  location?: string;
  date?: string;
  spotsLeft: number;
  totalSpots: number;
  tags: string[];
  requiredTier: Tier;
  requiredVerification: VerificationLevel;
  status: GigStatus;
  deadline: string;
  imageUrl?: string;
}

export interface PerkItem {
  id: string;
  name: string;
  brand: string;
  originalPrice: number;
  salePrice: number;
  discount: string;
  stock: number;
  totalStock: number;
  category: string;
  requiredTier: Tier;
  tasksToUnlock: number;
  imageUrl?: string;
  isDrop: boolean;
  isSoldOut: boolean;
  isGiftable: boolean;
}

export interface DropEvent {
  id: string;
  title: string;
  description: string;
  dropTime: string;
  items: string[];
}

export interface Certificate {
  id: string;
  title: string;
  brand: string;
  issuedDate: string;
  gigsCompleted: number;
  campaignName: string;
}

// V2.1: Starter Kit
export interface StarterKit {
  id: string;
  name: string;
  brand: string;
  originalPrice: number;
  discountedPrice: number;
  discount: string;
  description: string;
  items: string[];
  limitPerUser: number;
  requiresEduVerification: boolean;
}

// V2.1: UGC Submission
export interface UGCSubmission {
  id: string;
  userId: string;
  contentUrl: string;
  platform: "tiktok" | "instagram";
  gigId: string;
  gigTitle: string;
  brand: string;
  status: ContentStatus;
  rewardType: RewardType;
  rewardAmount: number;
  rejectionReason?: RejectionReason;
  checklist: {
    faceShown: boolean;
    productVisible: boolean;
    audioMention: boolean;
  };
  submittedAt: string;
  reviewedAt?: string;
}

// V2.1: Referral
export interface Referral {
  id: string;
  referrerId: string;
  buyerId: string;
  buyerName: string;
  orderId: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: "pending" | "approved" | "blocked";
  blockReason?: "address-match" | "not-new-user" | "inventory-cap";
  createdAt: string;
}

// V2.1: Shift (Event Staff)
export interface Shift {
  id: string;
  title: string;
  brand: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  spotsLeft: number;
  totalSpots: number;
  status: "open" | "booked" | "completed";
}

// V2.1: Task (Campus Manager)
export interface ManagerTask {
  id: string;
  title: string;
  description: string;
  kpiTarget: string;
  kpiCurrent: number;
  kpiGoal: number;
  stipend: number;
  deadline: string;
  status: "active" | "completed" | "overdue";
}

export interface UserProfile {
  name: string;
  username: string;
  university: string;
  email: string;
  tier: Tier;
  xp: number;
  nextTierXp: number;
  influenceScore: number;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  pointsBalance: number;
  gigsCompleted: number;
  brandsWorkedWith: string[];
  badges: string[];
  joinedDate: string;
  verificationLevel: VerificationLevel;
  walletType: WalletType;
  isWorkAuthorized: boolean;
  certificates: Certificate[];
  digitalTasksCompleted: number;
  // V2.1
  shippingAddress: string;
  starterKitPurchased: boolean;
  staffingTrack?: StaffingTrack;
  referralCode: string;
  referralEarnings: number;
  monthlyPurchases: Record<string, number>; // skuId -> count
}

export const TIER_CONFIG: Record<
  Tier,
  { label: string; minXp: number; color: string }
> = {
  scout: { label: "Scout", minXp: 0, color: "hsl(330 81% 60%)" },
  partner: { label: "Partner", minXp: 500, color: "hsl(270 91% 65%)" },
  "city-manager": {
    label: "City Manager",
    minXp: 2000,
    color: "hsl(0 0% 96%)",
  },
};

export const VERIFICATION_LEVELS: Record<
  VerificationLevel,
  { label: string; description: string; unlocks: string[] }
> = {
  1: {
    label: "Guest",
    description: "Phone verified",
    unlocks: ["Browse gigs", "View perks"],
  },
  2: {
    label: "Verified Student",
    description: ".edu email verified",
    unlocks: ["Perks Shop (entry-level)", "Digital Tasks (points)", "Gifting"],
  },
  3: {
    label: "Verified Staff",
    description: "ID verified",
    unlocks: ["High-paying offline gigs ($30/hr+)", "Cash withdrawals"],
  },
};

export const BADGES = [
  { id: "top-creator", label: "Top Creator", icon: "star" },
  { id: "top-rated", label: "Top Rated Staff", icon: "trophy" },
  { id: "reliable-staff", label: "Reliable", icon: "shield" },
  { id: "early-bird", label: "Early Bird", icon: "clock" },
  { id: "brand-fave", label: "Brand Favorite", icon: "heart" },
  { id: "streak-7", label: "7-Day Streak", icon: "flame" },
];

export const REJECTION_REASONS: Record<RejectionReason, string> = {
  "low-quality": "Low Quality",
  "no-face": "No Face / Application Shown",
  "fake-ai": "Fake / AI-Generated Content",
};

// --- Mock Data ---

export const mockUser: UserProfile = {
  name: "Jordan Chen",
  username: "@jordanc",
  university: "UCLA",
  email: "jchen@ucla.edu",
  tier: "partner",
  xp: 720,
  nextTierXp: 2000,
  influenceScore: 87,
  totalEarned: 2450,
  pendingBalance: 180,
  availableBalance: 320,
  pointsBalance: 1840,
  gigsCompleted: 34,
  brandsWorkedWith: [
    "Glow Recipe",
    "Bubble",
    "Rare Beauty",
    "Pop & Bottle",
    "Haus Labs",
  ],
  badges: ["top-creator", "reliable-staff", "early-bird", "brand-fave"],
  joinedDate: "Sep 2025",
  verificationLevel: 3,
  walletType: "cash",
  isWorkAuthorized: true,
  digitalTasksCompleted: 22,
  certificates: [
    {
      id: "cert-1",
      title: "Campus Brand Ambassador",
      brand: "Glow Recipe",
      issuedDate: "Jan 2026",
      gigsCompleted: 8,
      campaignName: "Winter Glow Campaign 2026",
    },
    {
      id: "cert-2",
      title: "Digital Marketing Specialist",
      brand: "Rare Beauty",
      issuedDate: "Dec 2025",
      gigsCompleted: 5,
      campaignName: "Holiday Beauty Collection",
    },
    {
      id: "cert-3",
      title: "Event Operations Staff",
      brand: "Mejuri",
      issuedDate: "Nov 2025",
      gigsCompleted: 3,
      campaignName: "West Coast Pop-Up Tour",
    },
  ],
  shippingAddress: "123 Westwood Blvd, Los Angeles, CA 90024",
  starterKitPurchased: false,
  staffingTrack: "event-staff",
  referralCode: "JORDAN2026",
  referralEarnings: 84,
  monthlyPurchases: {},
};

export const mockStarterKit: StarterKit = {
  id: "sk-1",
  name: "Glow Starter Kit",
  brand: "Glow Recipe",
  originalPrice: 25,
  discountedPrice: 12,
  discount: "50% OFF",
  description:
    "Your gateway to the Axelerate ecosystem. Includes travel-size Watermelon Glow Niacinamide Sunscreen, Plum Plump Hyaluronic Serum, and a branded tote.",
  items: [
    "Watermelon Glow Niacinamide Sunscreen (15ml)",
    "Plum Plump Hyaluronic Serum (10ml)",
    "Axelerate x Glow Recipe Tote Bag",
    "Exclusive Sticker Pack",
  ],
  limitPerUser: 1,
  requiresEduVerification: true,
};

export const mockGigs: Gig[] = [
  {
    id: "1",
    title: "Post a reel about SPF sunscreen",
    brand: "Glow Recipe",
    type: "digital",
    pay: "$50",
    payAmount: 50,
    description:
      "Create a 30-60 second TikTok or IG Reel featuring our Watermelon Glow Niacinamide Sunscreen. Show your morning routine, application, and tag @glowrecipe. Must hit 500+ views within 48hrs.",
    tags: ["TikTok", "Beauty", "Quick Win"],
    requiredTier: "scout",
    requiredVerification: 2,
    status: "open",
    spotsLeft: 12,
    totalSpots: 20,
    deadline: "Feb 15, 2026",
  },
  {
    id: "2",
    title: "Event Staff - LA Jewelry Pop-Up",
    brand: "Mejuri",
    type: "physical",
    pay: "$35/hr",
    payAmount: 35,
    description:
      "Staff needed for exclusive Mejuri jewelry pop-up at The Grove, LA. Duties include greeting guests, managing try-ons, and light inventory. Must be well-presented and energetic. 6-hour shift.",
    location: "The Grove, Los Angeles",
    date: "Feb 22, 2026",
    tags: ["In-Person", "Fashion", "Premium"],
    requiredTier: "partner",
    requiredVerification: 3,
    status: "open",
    spotsLeft: 3,
    totalSpots: 8,
    deadline: "Feb 18, 2026",
  },
  {
    id: "3",
    title: "Review K-Beauty haul on TikTok",
    brand: "COSRX",
    type: "digital",
    pay: "$30",
    payAmount: 30,
    description:
      "Unbox and review the COSRX Snail Mucin trial kit on TikTok. Show before/after skin texture. Mention the product name and use #COSRXPartner.",
    tags: ["TikTok", "K-Beauty", "Skincare"],
    requiredTier: "scout",
    requiredVerification: 2,
    status: "open",
    spotsLeft: 25,
    totalSpots: 50,
    deadline: "Feb 20, 2026",
  },
  {
    id: "4",
    title: "Model for campus fashion shoot",
    brand: "Princess Polly",
    type: "physical",
    pay: "$45/hr",
    payAmount: 45,
    description:
      "Seeking campus ambassadors for a lifestyle photoshoot on UCLA campus. You'll model 3-4 outfits for social media content. 4-hour shoot, snacks provided.",
    location: "UCLA Campus",
    date: "Mar 1, 2026",
    tags: ["In-Person", "Fashion", "Modeling"],
    requiredTier: "partner",
    requiredVerification: 3,
    status: "applied",
    spotsLeft: 2,
    totalSpots: 6,
    deadline: "Feb 25, 2026",
  },
  {
    id: "5",
    title: "Promote energy drink on IG Stories",
    brand: "Celsius",
    type: "digital",
    pay: "$25",
    payAmount: 25,
    description:
      "Post 3 IG Stories featuring Celsius during your study session, gym, or on-the-go. Must show the product clearly and tag @celsius. Stories must stay up for 24hrs.",
    tags: ["Instagram", "Fitness", "Easy"],
    requiredTier: "scout",
    requiredVerification: 2,
    status: "completed",
    spotsLeft: 0,
    totalSpots: 100,
    deadline: "Feb 10, 2026",
  },
  {
    id: "6",
    title: "VIP Event Host - Art Gallery Opening",
    brand: "Hennessy",
    type: "physical",
    pay: "$50/hr",
    payAmount: 50,
    description:
      "Premium hosting opportunity at an exclusive art gallery opening. Greet VIP guests, manage check-ins, and assist with event flow. Formal dress code required.",
    location: "DTLA Arts District",
    date: "Mar 8, 2026",
    tags: ["In-Person", "Premium", "VIP"],
    requiredTier: "city-manager",
    requiredVerification: 3,
    status: "open",
    spotsLeft: 2,
    totalSpots: 4,
    deadline: "Mar 3, 2026",
  },
];

export const mockPerks: PerkItem[] = [
  {
    id: "p1",
    name: "K-Beauty Hydration Box",
    brand: "COSRX",
    originalPrice: 68,
    salePrice: 29,
    discount: "57% OFF",
    stock: 12,
    totalStock: 50,
    category: "Beauty",
    requiredTier: "scout",
    tasksToUnlock: 0,
    isDrop: false,
    isSoldOut: false,
    isGiftable: true,
  },
  {
    id: "p2",
    name: "Matcha Latte Mix (30-Pack)",
    brand: "Jade Leaf",
    originalPrice: 45,
    salePrice: 18,
    discount: "60% OFF",
    stock: 8,
    totalStock: 30,
    category: "Food",
    requiredTier: "scout",
    tasksToUnlock: 0,
    isDrop: false,
    isSoldOut: false,
    isGiftable: true,
  },
  {
    id: "p3",
    name: "Le Labo Santal 33 Mini",
    brand: "Le Labo",
    originalPrice: 95,
    salePrice: 12,
    discount: "87% OFF",
    stock: 0,
    totalStock: 15,
    category: "Beauty",
    requiredTier: "partner",
    tasksToUnlock: 5,
    isDrop: false,
    isSoldOut: false,
    isGiftable: false,
  },
  {
    id: "p4",
    name: "3CE Velvet Lip Tint Set",
    brand: "3CE",
    originalPrice: 72,
    salePrice: 18,
    discount: "75% OFF",
    stock: 0,
    totalStock: 20,
    category: "Beauty",
    requiredTier: "partner",
    tasksToUnlock: 3,
    isDrop: false,
    isSoldOut: false,
    isGiftable: false,
  },
  {
    id: "p5",
    name: "Viral Cloud Lip Oil Set",
    brand: "Rare Beauty",
    originalPrice: 54,
    salePrice: 22,
    discount: "59% OFF",
    stock: 5,
    totalStock: 25,
    category: "Beauty",
    requiredTier: "partner",
    tasksToUnlock: 0,
    isDrop: false,
    isSoldOut: false,
    isGiftable: true,
  },
  {
    id: "p6",
    name: "Premium Protein Bar Bundle",
    brand: "RXBAR",
    originalPrice: 36,
    salePrice: 15,
    discount: "58% OFF",
    stock: 20,
    totalStock: 100,
    category: "Food",
    requiredTier: "scout",
    tasksToUnlock: 0,
    isDrop: false,
    isSoldOut: false,
    isGiftable: true,
  },
  {
    id: "p7",
    name: "Exclusive Streetwear Hoodie",
    brand: "Axelerate x CLOAK",
    originalPrice: 120,
    salePrice: 45,
    discount: "63% OFF",
    stock: 0,
    totalStock: 10,
    category: "Apparel",
    requiredTier: "city-manager",
    tasksToUnlock: 0,
    isDrop: true,
    isSoldOut: true,
    isGiftable: false,
  },
  {
    id: "p8",
    name: "Limited Collab Tote Bag",
    brand: "Axelerate x Baggu",
    originalPrice: 68,
    salePrice: 25,
    discount: "63% OFF",
    stock: 5,
    totalStock: 20,
    category: "Apparel",
    requiredTier: "partner",
    tasksToUnlock: 0,
    isDrop: true,
    isSoldOut: false,
    isGiftable: false,
  },
];

export const mockDropEvent: DropEvent = {
  id: "drop-1",
  title: "Friday Night Drop",
  description: "Exclusive streetwear + beauty items. Limited quantity.",
  dropTime: "2026-02-13T17:00:00-08:00",
  items: ["p7", "p8"],
};

export const mockTransactions = [
  { id: "t1", label: "Glow Recipe Reel", amount: 50, date: "Feb 3", status: "paid" as const },
  { id: "t2", label: "Celsius IG Stories", amount: 25, date: "Feb 1", status: "paid" as const },
  { id: "t3", label: "Mejuri Pop-Up Shift", amount: 210, date: "Jan 28", status: "pending" as const },
  { id: "t4", label: "COSRX TikTok Review", amount: 30, date: "Jan 25", status: "paid" as const },
  { id: "t5", label: "Princess Polly Shoot", amount: 180, date: "Jan 20", status: "pending" as const },
];

// V2.1 Mock Data

export const mockUGCSubmissions: UGCSubmission[] = [
  {
    id: "ugc-1",
    userId: "jordan",
    contentUrl: "https://tiktok.com/@jordanc/video/123456",
    platform: "tiktok",
    gigId: "1",
    gigTitle: "Post a reel about SPF sunscreen",
    brand: "Glow Recipe",
    status: "approved",
    rewardType: "cashback",
    rewardAmount: 25,
    checklist: { faceShown: true, productVisible: true, audioMention: true },
    submittedAt: "Feb 4, 2026",
    reviewedAt: "Feb 5, 2026",
  },
  {
    id: "ugc-2",
    userId: "jordan",
    contentUrl: "https://instagram.com/reel/xyz789",
    platform: "instagram",
    gigId: "5",
    gigTitle: "Promote energy drink on IG Stories",
    brand: "Celsius",
    status: "pending",
    rewardType: "points",
    rewardAmount: 250,
    checklist: { faceShown: true, productVisible: true, audioMention: false },
    submittedAt: "Feb 8, 2026",
  },
  {
    id: "ugc-3",
    userId: "jordan",
    contentUrl: "https://tiktok.com/@jordanc/video/987654",
    platform: "tiktok",
    gigId: "3",
    gigTitle: "Review K-Beauty haul on TikTok",
    brand: "COSRX",
    status: "rejected",
    rewardType: "points",
    rewardAmount: 0,
    rejectionReason: "no-face",
    checklist: { faceShown: false, productVisible: true, audioMention: true },
    submittedAt: "Feb 2, 2026",
    reviewedAt: "Feb 3, 2026",
  },
];

export const mockAdminQueue: UGCSubmission[] = [
  {
    id: "ugc-a1",
    userId: "sarah_k",
    contentUrl: "https://tiktok.com/@sarah_k/video/111222",
    platform: "tiktok",
    gigId: "1",
    gigTitle: "Post a reel about SPF sunscreen",
    brand: "Glow Recipe",
    status: "pending",
    rewardType: "points",
    rewardAmount: 150,
    checklist: { faceShown: true, productVisible: true, audioMention: true },
    submittedAt: "Feb 8, 2026",
  },
  {
    id: "ugc-a2",
    userId: "mike_d",
    contentUrl: "https://instagram.com/reel/aaa888",
    platform: "instagram",
    gigId: "3",
    gigTitle: "Review K-Beauty haul on TikTok",
    brand: "COSRX",
    status: "pending",
    rewardType: "points",
    rewardAmount: 100,
    checklist: { faceShown: false, productVisible: true, audioMention: false },
    submittedAt: "Feb 7, 2026",
  },
  {
    id: "ugc-a3",
    userId: "alyssa_m",
    contentUrl: "https://tiktok.com/@alyssa_m/video/333444",
    platform: "tiktok",
    gigId: "5",
    gigTitle: "Promote energy drink on IG Stories",
    brand: "Celsius",
    status: "pending",
    rewardType: "cashback",
    rewardAmount: 25,
    checklist: { faceShown: true, productVisible: true, audioMention: true },
    submittedAt: "Feb 9, 2026",
  },
];

export const mockReferrals: Referral[] = [
  {
    id: "ref-1",
    referrerId: "jordan",
    buyerId: "emma_w",
    buyerName: "Emma W.",
    orderId: "ord-101",
    orderAmount: 25,
    commissionRate: 0.1,
    commissionAmount: 2.5,
    status: "approved",
    createdAt: "Feb 5, 2026",
  },
  {
    id: "ref-2",
    referrerId: "jordan",
    buyerId: "liam_t",
    buyerName: "Liam T.",
    orderId: "ord-102",
    orderAmount: 25,
    commissionRate: 0.1,
    commissionAmount: 2.5,
    status: "approved",
    createdAt: "Feb 6, 2026",
  },
  {
    id: "ref-3",
    referrerId: "jordan",
    buyerId: "jordan",
    buyerName: "Jordan C. (self)",
    orderId: "ord-103",
    orderAmount: 25,
    commissionRate: 0.1,
    commissionAmount: 0,
    status: "blocked",
    blockReason: "address-match",
    createdAt: "Feb 7, 2026",
  },
  {
    id: "ref-4",
    referrerId: "jordan",
    buyerId: "noah_p",
    buyerName: "Noah P.",
    orderId: "ord-104",
    orderAmount: 68,
    commissionRate: 0.1,
    commissionAmount: 0,
    status: "blocked",
    blockReason: "not-new-user",
    createdAt: "Feb 8, 2026",
  },
];

export const mockShifts: Shift[] = [
  {
    id: "shift-1",
    title: "Jewelry Pop-Up Staff",
    brand: "Mejuri",
    location: "The Grove, LA",
    date: "Sat, Feb 22",
    startTime: "2:00 PM",
    endTime: "6:00 PM",
    hourlyRate: 35,
    spotsLeft: 2,
    totalSpots: 4,
    status: "open",
  },
  {
    id: "shift-2",
    title: "Art Gallery Host",
    brand: "Hennessy",
    location: "DTLA Arts District",
    date: "Sat, Mar 8",
    startTime: "7:00 PM",
    endTime: "11:00 PM",
    hourlyRate: 50,
    spotsLeft: 1,
    totalSpots: 3,
    status: "open",
  },
  {
    id: "shift-3",
    title: "Beauty Counter Staff",
    brand: "Rare Beauty",
    location: "Santa Monica Place",
    date: "Sun, Mar 15",
    startTime: "11:00 AM",
    endTime: "5:00 PM",
    hourlyRate: 30,
    spotsLeft: 3,
    totalSpots: 6,
    status: "open",
  },
  {
    id: "shift-4",
    title: "Campus Tasting Event",
    brand: "Pop & Bottle",
    location: "UCLA Bruin Walk",
    date: "Thu, Feb 20",
    startTime: "10:00 AM",
    endTime: "2:00 PM",
    hourlyRate: 28,
    spotsLeft: 0,
    totalSpots: 4,
    status: "booked",
  },
];

export const mockManagerTasks: ManagerTask[] = [
  {
    id: "mt-1",
    title: "Recruit 10 New Ambassadors",
    description: "Onboard new verified student ambassadors to the Axelerate platform at UCLA.",
    kpiTarget: "Ambassadors Recruited",
    kpiCurrent: 7,
    kpiGoal: 10,
    stipend: 200,
    deadline: "Feb 28, 2026",
    status: "active",
  },
  {
    id: "mt-2",
    title: "Host Campus Activation Event",
    description: "Organize a branded pop-up or tabling event to drive sign-ups and kit sales.",
    kpiTarget: "Event Attendees",
    kpiCurrent: 0,
    kpiGoal: 50,
    stipend: 350,
    deadline: "Mar 15, 2026",
    status: "active",
  },
  {
    id: "mt-3",
    title: "Generate 25 UGC Posts",
    description: "Coordinate with ambassadors to produce 25 qualifying UGC posts across TikTok and IG.",
    kpiTarget: "UGC Posts",
    kpiCurrent: 25,
    kpiGoal: 25,
    stipend: 150,
    deadline: "Feb 15, 2026",
    status: "completed",
  },
];
