import type { Category } from "@/types/finance";

const rules: Array<[RegExp, Category]> = [
  [/chipotle|panera|starbucks|cook out|mellow|restaurant|cafe|coffee/i, "Dining"],
  [/kroger|food lion|trader joe|whole foods|grocery/i, "Groceries"],
  [/shell|exxon|bp|transit|uber|lyft|gas/i, "Transportation"],
  [/netflix|spotify|hulu|subscription/i, "Subscriptions"],
  [/amazon|target|walmart|store/i, "Shopping"],
  [/bookstore|textbook|lab|tuition|university/i, "Education"],
  [/cinemark|movie|concert|activity|game/i, "Entertainment"],
  [/rent|apartment|housing/i, "Housing"]
];

export function categorizeMerchant(merchant: string): Category {
  return rules.find(([pattern]) => pattern.test(merchant))?.[1] ?? "Other";
}
