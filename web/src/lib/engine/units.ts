import type { BaseUnit, PackSize } from "./types";

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(ml|cl|ltr|litres?|liters?|l|kg|gm|grams?|g)(?![a-z])/i;

const UNIT_FACTORS: Record<string, { base: BaseUnit; factor: number }> = {
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  l: { base: "ml", factor: 1000 },
  ltr: { base: "ml", factor: 1000 },
  litre: { base: "ml", factor: 1000 },
  litres: { base: "ml", factor: 1000 },
  liter: { base: "ml", factor: 1000 },
  liters: { base: "ml", factor: 1000 },
  g: { base: "g", factor: 1 },
  gm: { base: "g", factor: 1 },
  gram: { base: "g", factor: 1 },
  grams: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
};

const COUNT_WORDS = "pack|pk|rolls?|each|ea|units?|pcs?|pieces?|ct|count|bottles?|cans?|jars?|bags?|tins?";

/**
 * Parse a catalogue pack description into a structured pack size.
 * Returns null when the text is ambiguous — callers must surface that as
 * missing information rather than guessing.
 *
 * Handles: "12 x 330ml", "24x330 ML", "6 x 4 x 330ml", "330ml x 24",
 * "1 x 5kg", "5kg", "Case of 12 (1L)", "12 rolls", "Pack of 6".
 */
export function parsePackSize(input: string | undefined | null): PackSize | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  let text = raw.toLowerCase().replace(/×/g, "x").replace(/,/g, ".");

  let unitSize = 1;
  let baseUnit: BaseUnit = "each";
  let sizeFound = false;

  const sizeMatch = text.match(SIZE_RE);
  if (sizeMatch) {
    const unit = UNIT_FACTORS[sizeMatch[2].toLowerCase()];
    if (unit) {
      unitSize = round(parseFloat(sizeMatch[1]) * unit.factor);
      baseUnit = unit.base;
      sizeFound = true;
      text = text.replace(sizeMatch[0], " ");
    }
  }

  const multipliers: number[] = [];

  // "6 x 4 x" / "x 24" style multipliers.
  if (/\bx\b|\dx|x\d/.test(text)) {
    for (const part of text.split(/\s*x\s*/)) {
      const m = part.trim().match(/^(\d+)$/) ?? part.trim().match(/^(\d+)\s*(?:\(|$)/);
      if (m) multipliers.push(parseInt(m[1], 10));
    }
  }

  if (multipliers.length === 0) {
    const caseOf = text.match(/(?:case|pack|box|tray|outer)\s*(?:of)?\s*(\d+)/);
    if (caseOf) multipliers.push(parseInt(caseOf[1], 10));
  }

  if (multipliers.length === 0) {
    const counted = text.match(new RegExp(`(\\d+)\\s*(?:${COUNT_WORDS})\\b`));
    if (counted) multipliers.push(parseInt(counted[1], 10));
  }

  if (!sizeFound && multipliers.length === 0) return null;

  const unitsPerCase = multipliers.length ? multipliers.reduce((a, b) => a * b, 1) : 1;
  if (!Number.isFinite(unitsPerCase) || unitsPerCase <= 0 || unitSize <= 0) return null;

  return { raw, unitsPerCase, unitSize, baseUnit };
}

export function baseQuantityPerCase(pack: PackSize): number {
  return pack.unitsPerCase * pack.unitSize;
}

/** Human-friendly normalized unit used for comparison ("per litre", "per kg"). */
export function comparisonUnit(base: BaseUnit): { label: string; factor: number } {
  switch (base) {
    case "ml":
      return { label: "L", factor: 1000 };
    case "g":
      return { label: "kg", factor: 1000 };
    case "sheet":
      return { label: "100 sheets", factor: 100 };
    default:
      return { label: "unit", factor: 1 };
  }
}

export function formatUnitSize(pack: PackSize): string {
  const { unitSize, baseUnit } = pack;
  if (baseUnit === "ml") return unitSize >= 1000 ? `${trim(unitSize / 1000)}L` : `${trim(unitSize)}ml`;
  if (baseUnit === "g") return unitSize >= 1000 ? `${trim(unitSize / 1000)}kg` : `${trim(unitSize)}g`;
  return "unit";
}

export function describePack(pack: PackSize): string {
  if (pack.baseUnit === "each") return `${pack.unitsPerCase} units`;
  return `${pack.unitsPerCase} × ${formatUnitSize(pack)}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
