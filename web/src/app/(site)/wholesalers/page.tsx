import type { Metadata } from "next";
import { UseCasePage } from "@/components/use-case-page";

export const metadata: Metadata = { title: "For wholesalers & distributors" };

export default function WholesalersPage() {
  return (
    <UseCasePage
      c={{
        eyebrow: "For wholesalers & distributors",
        title: "Be the easiest supplier to compare and order from",
        intro:
          "Independent retailers increasingly compare suppliers on landed cost. ShelfRelay helps consumer-goods wholesalers publish structured catalogues, understand how their terms land, and onboard retail accounts with less back-and-forth.",
        challenges: [
          { title: "Catalogues re-keyed by every customer", body: "Retailers transcribe your PDF price list by hand, introducing errors in pack sizes and prices that lead to disputes." },
          { title: "Terms that get lost", body: "Free-delivery thresholds, tier pricing and minimums often aren't visible at the moment a buyer decides." },
          { title: "Slow account onboarding", body: "New retail accounts need catalogues, terms, contacts and ordering details before the first order lands." },
        ],
        scenarios: [
          {
            title: "Structured catalogue publishing",
            body: "Upload your price list once. ShelfRelay extracts SKUs, pack formats, case and tier prices, and flags anything ambiguous for you to fix before retailers see it.",
            outcome: "Fewer pricing queries and order corrections.",
          },
          {
            title: "Terms that compare well",
            body: "Model how a free-delivery threshold or case-tier price changes your landed cost on typical retailer baskets.",
            outcome: "Price and terms decisions grounded in how buyers compare.",
          },
          {
            title: "Account onboarding",
            body: "Track each new retail account from introduction to first order, with catalogue access and ordering contacts in one place, synced with your CRM.",
            outcome: "A repeatable onboarding path for every new account.",
          },
        ],
        workflow: [
          "Publish your current catalogue and terms sheet.",
          "Resolve extraction warnings: missing pack sizes, ambiguous price columns.",
          "Share access with new retail accounts as they onboard.",
          "Review how your landed cost compares on representative baskets.",
          "Receive purchase orders and update their status for the buyer.",
        ],
      }}
    />
  );
}
