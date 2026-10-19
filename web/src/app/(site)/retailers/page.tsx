import type { Metadata } from "next";
import { UseCasePage } from "@/components/use-case-page";

export const metadata: Metadata = { title: "For independent retailers" };

export default function RetailersPage() {
  return (
    <UseCasePage
      c={{
        eyebrow: "For independent retailers",
        title: "Every supplier, compared on what you actually pay",
        intro:
          "Grocers, convenience stores and specialty shops buy from several wholesalers, each with its own price list format, case sizes and delivery rules. ShelfRelay puts them on one comparable basis.",
        challenges: [
          { title: "Price lists that don't line up", body: "One supplier quotes per case of 24, another per unit in 12s, a third in 6×4 trays. Comparing by eye is slow and error-prone." },
          { title: "Hidden order costs", body: "Delivery fees, free-delivery thresholds and minimum order values change which supplier is really cheapest for a given order." },
          { title: "Reordering by gut feel", body: "Without a quick view of sales rate and cover, it's easy to overstock slow lines and run out of fast ones." },
        ],
        scenarios: [
          {
            title: "Weekly beverage order",
            body: "Upload your three wholesalers' price lists. ShelfRelay matches the same water, juice and soda lines, normalizes to price per litre, and shows whether splitting the order beats one delivery.",
            outcome: "See landed cost per litre and the lowest total that meets each minimum.",
          },
          {
            title: "Pantry range review",
            body: "Compare a 5kg rice sack with 10×1kg bags on cost per kg, with the size difference flagged so you can decide whether it suits your shelf.",
            outcome: "Pack-size trade-offs made explicit, not hidden.",
          },
          {
            title: "Replenishment from POS data",
            body: "Import stock counts and daily sales. Set safety stock and cover days, and get case-rounded order quantities with the working shown.",
            outcome: "Draft purchase orders in minutes, ready to review.",
          },
        ],
        workflow: [
          "Upload new price lists as suppliers send them; changes are re-extracted automatically.",
          "Clear the match review queue: confirm equivalents and reject look-alikes.",
          "Check replenishment suggestions against your stock targets.",
          "Compare suppliers for the suggested basket and pick a plan.",
          "Send purchase orders and record acknowledgements and deliveries as they arrive.",
        ],
      }}
    />
  );
}
