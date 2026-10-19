import type { CatalogueItem, MatchCandidate } from "./types";
import { formatUnitSize } from "./units";

/**
 * Heuristic cross-supplier product matcher.
 *
 * It proposes groups of potentially equivalent items (at most one per
 * supplier). High-confidence groups are "proposed"; anything with differing
 * variants, brands or pack formats is "needs_review". Nothing is treated as
 * equivalent until a user confirms it. In the cloud deployment, needs_review
 * groups are additionally sent to Bedrock for a second opinion (see
 * services/match-assist), which is shown as an AI suggestion.
 */

const STOPWORDS = new Set([
  "the", "and", "of", "with", "in", "for", "a", "x", "case", "pack", "pk", "tray", "outer", "each", "ea",
  "can", "cans", "bottle", "bottles", "tin", "tins", "jar", "jars", "bag", "bags", "box", "multipack",
]);

const SYNONYMS: Record<string, string> = {
  carbonated: "sparkling",
  fizzy: "sparkling",
  tomatoes: "tomato",
  tomatos: "tomato",
  chopped: "chopped",
  diced: "chopped",
  crisps: "chips",
  roll: "rolls",
  towel: "towels",
  liquid: "liquid",
  washing: "wash",
  beans: "bean",
  ev: "extra-virgin",
  evoo: "extra-virgin",
  "extra-virgin": "extra-virgin",
  rolled: "rolled",
  oj: "orange",
  soda: "soda",
  drink: "drink",
};

/** Tokens that change what a product is; a mismatch always needs review. */
const VARIANTS = [
  "diet", "zero", "light", "lite", "organic", "decaf", "barista", "unsweetened", "sweetened", "wholemeal",
  "wholewheat", "gluten-free", "salted", "unsalted", "crunchy", "still", "sparkling", "lemon", "lime",
  "extra-virgin", "refined", "sea-salt", "vinegar", "cheese", "brown", "white", "honey", "chocolate",
];

/** Descriptive words that often appear on one side only without changing the product. */
const WEAK_WORDS = new Set(["original", "classic", "pure", "smooth", "premium", "rigate", "spring", "kitchen"]);

export function tokenize(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/extra[\s-]virgin/g, "extra-virgin")
    .replace(/gluten[\s-]free/g, "gluten-free")
    .replace(/sea[\s-]salt/g, "sea-salt")
    .replace(/washing[\s-]up liquid/g, "dish soap")
    .replace(/whole[\s-]beans?/g, "beans")
    .replace(/\d+(?:\.\d+)?\s*(ml|cl|l|ltr|kg|g|gm|ply)\b/g, " ")
    .replace(/\d+\s*x\s*/g, " ")
    .replace(/[^a-z\-\s]/g, " ");
  return cleaned
    .split(/\s+/)
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Blend of Dice and overlap coefficients: tolerant of extra words on one side. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const dice = (2 * inter) / (a.size + b.size);
  const overlap = inter / Math.min(a.size, b.size);
  return 0.5 * dice + 0.5 * overlap;
}

export interface PairScore {
  a: string;
  b: string;
  score: number;
  /** Score before the variant penalty; used to surface near-misses for review. */
  rawScore: number;
  reasons: string[];
  warnings: string[];
}

export function scorePair(a: CatalogueItem, b: CatalogueItem): PairScore {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const brandA = a.brand?.toLowerCase().trim();
  const brandB = b.brand?.toLowerCase().trim();
  // Brand words are scored separately, so strip both brands from both names
  // (a catalogue without a brand column usually repeats it in the description).
  const brandTokens = new Set([...(brandA ? tokenize(brandA) : []), ...(brandB ? tokenize(brandB) : [])]);
  const ta = new Set(tokenize(a.name).filter((t) => !brandTokens.has(t)));
  const tb = new Set(tokenize(b.name).filter((t) => !brandTokens.has(t)));
  const strong = (s: Set<string>) => new Set([...s].filter((t) => !WEAK_WORDS.has(t)));
  const nameSim = similarity(strong(ta), strong(tb));
  if (nameSim >= 0.5) reasons.push(`Descriptions share ${Math.round(nameSim * 100)}% of key terms`);

  let sizeSim = 0;
  if (a.pack && b.pack) {
    if (a.pack.baseUnit !== b.pack.baseUnit) {
      warnings.push("Different units of measure; not directly comparable");
    } else if (Math.abs(a.pack.unitSize - b.pack.unitSize) < 0.001) {
      sizeSim = 1;
      reasons.push(`Same unit size (${a.pack.baseUnit === "each" ? "per unit" : formatUnitSize(a.pack)})`);
      if (a.pack.unitsPerCase !== b.pack.unitsPerCase) {
        reasons.push(`Case sizes differ (${a.pack.unitsPerCase} vs ${b.pack.unitsPerCase}); compared per unit`);
      }
    } else {
      sizeSim = 0.45;
      warnings.push(
        `Different unit sizes (${formatUnitSize(a.pack)} vs ${formatUnitSize(b.pack)}); compared per ${a.pack.baseUnit === "ml" ? "litre" : a.pack.baseUnit === "g" ? "kg" : "unit"}`,
      );
    }
  } else {
    warnings.push("Pack size missing for at least one item");
  }

  let brandSim = 0.5;
  if (brandA && brandB) {
    brandSim = brandA === brandB ? 1 : 0;
    if (brandSim === 1) reasons.push(`Same brand (${a.brand})`);
    else warnings.push(`Different brands (${a.brand} vs ${b.brand}); confirm they are acceptable substitutes`);
  }

  let catSim = 0.5;
  if (a.category && b.category) catSim = a.category.toLowerCase() === b.category.toLowerCase() ? 1 : 0;

  const va = VARIANTS.filter((v) => ta.has(v));
  const vb = VARIANTS.filter((v) => tb.has(v));
  const variantDiff = [...va.filter((v) => !vb.includes(v)), ...vb.filter((v) => !va.includes(v))];
  let penalty = 0;
  if (variantDiff.length) {
    penalty = 0.15;
    warnings.push(`Variant wording differs (${variantDiff.join(", ")})`);
  }

  const weakDiff = [...ta, ...tb].filter((t) => WEAK_WORDS.has(t) && !(ta.has(t) && tb.has(t)));
  if (weakDiff.length) reasons.push(`Minor wording differences ignored (${[...new Set(weakDiff)].join(", ")})`);

  const raw = Math.max(0, Math.min(1, 0.55 * nameSim + 0.25 * sizeSim + 0.12 * brandSim + 0.08 * catSim));
  const score = Math.max(0, raw - penalty);
  return { a: a.id, b: b.id, score: Math.round(score * 1000) / 1000, rawScore: Math.round(raw * 1000) / 1000, reasons, warnings };
}

export interface MatchOptions {
  /** Minimum pair score to consider two items as candidates at all. */
  candidateThreshold?: number;
  /** Minimum group score (with no warnings) for "proposed" status. */
  confidentThreshold?: number;
}

export function findMatches(items: CatalogueItem[], opts: MatchOptions = {}): MatchCandidate[] {
  const candidateThreshold = opts.candidateThreshold ?? 0.55;
  const confidentThreshold = opts.confidentThreshold ?? 0.78;

  const pairs: PairScore[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].supplierId === items[j].supplierId) continue;
      const p = scorePair(items[i], items[j]);
      if (p.rawScore >= candidateThreshold) pairs.push(p);
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const byId = new Map(items.map((it) => [it.id, it]));
  const groupOf = new Map<string, number>();
  const groups: { members: string[]; pairs: PairScore[] }[] = [];

  for (const p of pairs) {
    const ga = groupOf.get(p.a);
    const gb = groupOf.get(p.b);
    const suppliersOf = (members: string[]) => new Set(members.map((m) => byId.get(m)!.supplierId));
    if (ga == null && gb == null) {
      groups.push({ members: [p.a, p.b], pairs: [p] });
      groupOf.set(p.a, groups.length - 1);
      groupOf.set(p.b, groups.length - 1);
    } else if (ga != null && gb == null) {
      const g = groups[ga];
      if (!suppliersOf(g.members).has(byId.get(p.b)!.supplierId)) {
        g.members.push(p.b);
        g.pairs.push(p);
        groupOf.set(p.b, ga);
      }
    } else if (gb != null && ga == null) {
      const g = groups[gb];
      if (!suppliersOf(g.members).has(byId.get(p.a)!.supplierId)) {
        g.members.push(p.a);
        g.pairs.push(p);
        groupOf.set(p.a, gb);
      }
    } else if (ga != null && gb != null && ga !== gb) {
      // Only an extra link between existing groups; record it if it is within one group later.
    } else if (ga != null && ga === gb) {
      groups[ga].pairs.push(p);
    }
  }

  return groups.map((g, i) => {
    const score = Math.min(...g.pairs.map((p) => p.score));
    const reasons = unique(g.pairs.flatMap((p) => p.reasons));
    const warnings = unique(g.pairs.flatMap((p) => p.warnings));
    const first = byId.get(g.members[0])!;
    return {
      id: `m${i + 1}-${g.members.map((m) => m.split(":")[1]).join("-")}`.slice(0, 80),
      itemIds: g.members,
      score,
      status: score >= confidentThreshold && warnings.length === 0 ? "proposed" : "needs_review",
      reasons,
      warnings,
      label: groupLabel(g.members.map((m) => byId.get(m)!)),
      baseUnit: first.pack?.baseUnit ?? null,
    } satisfies MatchCandidate;
  });
}

function groupLabel(items: CatalogueItem[]): string {
  const counts = new Map<string, number>();
  for (const it of items) for (const t of new Set(tokenize(it.name))) counts.set(t, (counts.get(t) ?? 0) + 1);
  const shared = tokenize(items[0].name).filter((t) => (counts.get(t) ?? 0) === items.length);
  const label = (shared.length ? shared : tokenize(items[0].name)).join(" ");
  const sizes = new Set(items.map((i) => (i.pack ? `${i.pack.baseUnit}:${i.pack.unitSize}` : "?")));
  const size = sizes.size === 1 && items[0].pack && items[0].pack.baseUnit !== "each" ? ` ${formatUnitSize(items[0].pack)}` : "";
  return label.replace(/\b\w/g, (c) => c.toUpperCase()) + size;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
