export type Plan = {
  id: "free" | "starter" | "pro" | "agency";
  name: string;
  priceMonthly: number;
  prospects: number;
  enrichments: number;
  seats: number;
  api: boolean;
  description: string;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    prospects: 25,
    enrichments: 10,
    seats: 1,
    api: false,
    description: "Kick the tires."
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 29,
    prospects: 250,
    enrichments: 100,
    seats: 1,
    api: false,
    description: "For solo sellers prospecting weekly."
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    prospects: 2000,
    enrichments: 1000,
    seats: 5,
    api: true,
    description: "Small sales teams. API included."
  },
  {
    id: "agency",
    name: "Agency",
    priceMonthly: 299,
    prospects: 10000,
    enrichments: 5000,
    seats: -1,
    api: true,
    description: "Multi-client and high-volume."
  }
];

export type CreditPack = {
  id: "small" | "medium" | "large";
  credits: number;
  price: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", credits: 100, price: 10 },
  { id: "medium", credits: 600, price: 50 },
  { id: "large", credits: 3000, price: 200 }
];
