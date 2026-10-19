/**
 * Core domain types for ShelfRelay.
 *
 * Every value that reaches a user carries a provenance so the UI can always
 * distinguish what a supplier actually stated from what ShelfRelay derived.
 */

export type Provenance =
  /** Read directly from a supplier catalogue or price list. */
  | "imported"
  /** Entered or confirmed by a ShelfRelay user. */
  | "user"
  /** Deterministically calculated by ShelfRelay from imported/user values. */
  | "calculated"
  /** A forward-looking estimate (e.g. demand projections). */
  | "estimate"
  /** Produced or proposed by a model (Bedrock) or the matching heuristic; needs review. */
  | "ai";

export interface SourceRef {
  file: string;
  /** 1-based data row in the source file, or page number for documents. */
  row?: number;
  page?: number;
  /** How the value got out of the file. */
  method: "csv" | "textract" | "manual";
}

export type BaseUnit = "ml" | "g" | "each" | "sheet";

export interface PackSize {
  /** Raw text as written in the catalogue, e.g. "6 x 4 x 330ml". */
  raw: string;
  /** Number of sellable units inside one orderable case. */
  unitsPerCase: number;
  /** Size of a single sellable unit in base units (ml, g, each). */
  unitSize: number;
  baseUnit: BaseUnit;
}

export interface PriceTier {
  /** Minimum number of cases on one line for this case price to apply. */
  minCases: number;
  casePrice: number;
}

export interface CatalogueItem {
  id: string;
  supplierId: string;
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  /** null when the pack size could not be parsed — flagged as missing info. */
  pack: PackSize | null;
  /** Price per case as stated or derived from a stated unit price. null = missing. */
  casePrice: number | null;
  /** How the case price was obtained. */
  casePriceBasis: "stated_case" | "derived_from_unit" | "missing";
  tiers: PriceTier[];
  /** Free-text availability as stated by the supplier. Never inferred. */
  statedAvailability?: string;
  source: SourceRef;
  /** Raw source fields, kept for audit. */
  raw: Record<string, string>;
}

export interface VolumeDiscount {
  /** Order subtotal (pre-delivery) at which the discount applies. */
  minSubtotal: number;
  percent: number;
}

export interface SupplierTerms {
  /** Flat delivery charge per order. null = not stated by the supplier. */
  deliveryFee: number | null;
  /** Subtotal at or above which delivery is free. null = no free-delivery threshold stated. */
  freeDeliveryThreshold: number | null;
  /** Minimum order value. 0 = supplier states none; null = not stated. */
  minimumOrderValue: number | null;
  volumeDiscounts: VolumeDiscount[];
  /** Lead time exactly as stated by the supplier, e.g. "Next business day". */
  statedLeadTime: string | null;
  /** Lead time in days configured by the user for planning; never inferred from text. */
  planningLeadTimeDays: number | null;
  paymentTerms: string | null;
  source: SourceRef | null;
}

export interface Supplier {
  id: string;
  name: string;
  kind: "wholesaler" | "distributor" | "cash_and_carry" | "direct";
  region?: string;
  contactEmail?: string;
  terms: SupplierTerms;
  /** Marks fixture data so it is never mistaken for a real supplier. */
  fictional?: boolean;
}

export type MatchStatus = "proposed" | "needs_review" | "confirmed" | "rejected";

export interface MatchCandidate {
  id: string;
  itemIds: string[];
  /** 0..1 similarity score from the heuristic matcher. */
  score: number;
  status: MatchStatus;
  reasons: string[];
  warnings: string[];
  /** Label for the product group once confirmed. */
  label: string;
  baseUnit: BaseUnit | null;
}

/** A confirmed product group that is comparable across suppliers. */
export interface ProductGroup {
  id: string;
  label: string;
  itemIds: string[];
  baseUnit: BaseUnit | null;
}

export interface Valued<T> {
  value: T;
  provenance: Provenance;
  note?: string;
}
