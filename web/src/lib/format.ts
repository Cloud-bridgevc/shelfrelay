export const CURRENCY = "USD";

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });
const moneyFine = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const money = (n: number | null | undefined) => (n == null ? "—" : moneyFmt.format(n));
export const moneyFine3 = (n: number | null | undefined) => (n == null ? "—" : moneyFine.format(n));
export const num = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/** Display a base-unit quantity in human units. */
export function qty(base: number, unit: "ml" | "g" | "each" | "sheet" | null) {
  if (unit === "ml") return `${num(base / 1000, base % 1000 ? 2 : 0)} L`;
  if (unit === "g") return `${num(base / 1000, base % 1000 ? 2 : 0)} kg`;
  return `${num(base)} units`;
}
