import type { Availability, Priority } from "@/lib/types";

export const inr = (n?: number) => (n === undefined ? "Price not available" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export const AVAILABILITY: Record<Availability, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
  available: { label: "In stock", color: "success" },
  low_stock: { label: "Few left", color: "warning" },
  unavailable: { label: "Out of stock", color: "danger" },
  unknown: { label: "Availability not confirmed", color: "default" },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  must_have: "Must-have",
  recommended: "Recommended",
  optional: "Optional",
};

export const DIETARY_LABEL: Record<string, string> = {
  veg: "Vegetarian",
  vegan: "Vegan",
  egg: "Egg OK",
  no_onion_garlic: "No onion/garlic",
  sugar_free: "Sugar-free",
  gluten_free: "Gluten-free",
};

export const CATEGORY_LABEL: Record<string, string> = {
  snacks: "Snacks",
  beverages: "Drinks",
  breakfast: "Breakfast",
  healthy_snacks: "Healthy snacks",
  party_supplies: "Party supplies",
  staples: "Staples",
  fruits_veg: "Fruits & veg",
  cleaning: "Cleaning",
  pet: "Pet",
  baby: "Baby",
  gifting: "Gifting",
  emergency: "Emergency",
};
