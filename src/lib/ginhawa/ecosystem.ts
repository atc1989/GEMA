const trim = (value: string) => value.replace(/\/$/, "");

export const SHOP_URL = trim(process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph");
export const SHOP_REFERRAL_SLUG = process.env.NEXT_PUBLIC_SHOP_REFERRAL_SLUG ?? "ginhawa";

export function shopEntryUrl() {
  return `${SHOP_URL}/r/${encodeURIComponent(SHOP_REFERRAL_SLUG)}?shop=ginhawa`;
}
