"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  findMatches,
  scorePair,
  DEFAULT_TARGETS,
  type CatalogueItem,
  type ExtractIssue,
  type MatchCandidate,
  type ProductGroup,
  type StockTargets,
  type Supplier,
} from "@/lib/engine";

/**
 * Client-side workspace for the demo. In production this state lives in
 * PostgreSQL behind the API (see db/schema.sql); here it is held in memory
 * and mirrored to localStorage so the demo survives reloads.
 */

export type OrderStatus = "draft" | "ready" | "sent" | "acknowledged" | "partially_received" | "received" | "cancelled";

export interface OrderLine {
  itemId: string;
  cases: number;
  /** Case price copied from the catalogue at the time the line was added. */
  casePrice: number;
  groupId?: string;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  lines: OrderLine[];
  status: OrderStatus;
  createdAt: string;
  history: OrderEvent[];
  /** Reference the supplier gave on acknowledgement. User-entered only. */
  supplierRef?: string;
  /** Delivery date as confirmed by the supplier. User-entered only — never estimated. */
  confirmedDeliveryDate?: string;
  notes?: string;
}

export interface CatalogueRecord {
  id: string;
  supplierId: string;
  file: string;
  importedAt: string;
  method: "csv" | "textract";
  itemCount: number;
  issues: ExtractIssue[];
  demo?: boolean;
}

export interface StockEntry {
  itemId: string;
  onHand: number;
  onOrder: number;
  dailySales: number[];
  countedOn: string;
}

export interface WorkspaceState {
  version: 1;
  suppliers: Supplier[];
  items: CatalogueItem[];
  catalogues: CatalogueRecord[];
  matches: MatchCandidate[];
  /** Required base quantity (ml/g/each) per product group for the comparison basket. */
  basket: Record<string, number>;
  stock: StockEntry[];
  targets: StockTargets;
  /** Supplier chosen per stock item for replenishment (itemId → itemId to order). */
  replenishSource: Record<string, string>;
  orders: PurchaseOrder[];
}

const KEY = "shelfrelay.workspace.v1";

interface Ctx {
  state: WorkspaceState;
  hydrated: boolean;
  groups: ProductGroup[];
  /** Group ids whose match is proposed but not yet confirmed by a user. */
  unconfirmed: Set<string>;
  supplier: (id: string) => Supplier | undefined;
  item: (id: string) => CatalogueItem | undefined;
  groupOfItem: (itemId: string) => ProductGroup | undefined;
  update: (fn: (s: WorkspaceState) => WorkspaceState) => void;
  setMatchStatus: (id: string, status: MatchCandidate["status"]) => void;
  removeFromMatch: (id: string, itemId: string) => void;
  renameMatch: (id: string, label: string) => void;
  importCatalogue: (rec: Omit<CatalogueRecord, "id" | "importedAt">, items: CatalogueItem[]) => void;
  updateSupplier: (id: string, patch: Omit<Partial<Supplier>, "terms"> & { terms?: Partial<Supplier["terms"]> }) => void;
  addSupplier: (s: Supplier) => void;
  setBasket: (groupId: string, base: number) => void;
  addToOrder: (supplierId: string, line: OrderLine) => void;
  setOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  patchOrder: (orderId: string, patch: Partial<PurchaseOrder>) => void;
  reset: () => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function rematch(items: CatalogueItem[], previous: MatchCandidate[]): MatchCandidate[] {
  const key = (ids: string[]) => [...ids].sort().join("|");
  const prev = new Map(previous.map((m) => [key(m.itemIds), m]));
  // Keep user-decided groups (confirmed, rejected or edited) as they are.
  const kept = previous.filter((m) => m.status === "confirmed" || m.status === "rejected");
  const taken = new Set(kept.filter((m) => m.status === "confirmed").flatMap((m) => m.itemIds));
  const rejected = new Set(kept.filter((m) => m.status === "rejected").map((m) => key(m.itemIds)));
  const fresh = findMatches(items.filter((i) => !taken.has(i.id)))
    .filter((m) => !rejected.has(key(m.itemIds)))
    .map((m) => {
      const p = prev.get(key(m.itemIds));
      return p ? { ...m, id: p.id, status: p.status, label: p.label } : m;
    });
  return [...kept, ...fresh];
}

export function WorkspaceProvider({ initial, children }: { initial: WorkspaceState; children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as WorkspaceState;
        if (saved.version === 1) setState(saved);
      }
    } catch {
      /* storage unavailable: run in memory */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [state, hydrated]);

  const update = useCallback((fn: (s: WorkspaceState) => WorkspaceState) => setState((s) => fn(s)), []);

  const value = useMemo<Ctx>(() => {
    const supplierMap = new Map(state.suppliers.map((s) => [s.id, s]));
    const itemMap = new Map(state.items.map((i) => [i.id, i]));
    const active = state.matches.filter((m) => m.status === "confirmed" || m.status === "proposed");
    const groups: ProductGroup[] = active.map((m) => ({ id: m.id, label: m.label, itemIds: m.itemIds, baseUnit: m.baseUnit }));
    const unconfirmed = new Set(active.filter((m) => m.status === "proposed").map((m) => m.id));
    const itemGroup = new Map<string, ProductGroup>();
    for (const g of groups) for (const id of g.itemIds) itemGroup.set(id, g);

    const now = () => new Date().toISOString();

    return {
      state,
      hydrated,
      groups,
      unconfirmed,
      supplier: (id) => supplierMap.get(id),
      item: (id) => itemMap.get(id),
      groupOfItem: (id) => itemGroup.get(id),
      update,
      setMatchStatus: (id, status) =>
        update((s) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? { ...m, status } : m)) })),
      removeFromMatch: (id, itemId) =>
        update((s) => ({
          ...s,
          matches: s.matches.map((m) => {
            if (m.id !== id) return m;
            const itemIds = m.itemIds.filter((x) => x !== itemId);
            if (itemIds.length < 2) return { ...m, itemIds, status: "rejected" as const };
            // Re-score the remaining items so reasons and warnings reflect the new group.
            const its = itemIds.map((x) => itemMap.get(x)!).filter(Boolean);
            const pairs = its.flatMap((a, i) => its.slice(i + 1).map((b) => scorePair(a, b)));
            return {
              ...m,
              itemIds,
              score: Math.min(...pairs.map((p) => p.score)),
              reasons: [...new Set(pairs.flatMap((p) => p.reasons))],
              warnings: [...new Set(pairs.flatMap((p) => p.warnings))],
            };
          }),
        })),
      renameMatch: (id, label) => update((s) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? { ...m, label } : m)) })),
      importCatalogue: (rec, items) =>
        update((s) => {
          const others = s.items.filter((i) => !(i.supplierId === rec.supplierId && i.source.file === rec.file));
          const all = [...others, ...items];
          return {
            ...s,
            items: all,
            catalogues: [
              ...s.catalogues.filter((c) => !(c.supplierId === rec.supplierId && c.file === rec.file)),
              { ...rec, id: `cat-${Date.now()}`, importedAt: now() },
            ],
            matches: rematch(all, s.matches),
          };
        }),
      updateSupplier: (id, patch) =>
        update((s) => ({
          ...s,
          suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...patch, terms: { ...x.terms, ...(patch.terms ?? {}) } } : x)),
        })),
      addSupplier: (sup) => update((s) => ({ ...s, suppliers: [...s.suppliers, sup] })),
      setBasket: (groupId, base) => update((s) => ({ ...s, basket: { ...s.basket, [groupId]: Math.max(0, base) } })),
      addToOrder: (supplierId, line) =>
        update((s) => {
          const draft = s.orders.find((o) => o.supplierId === supplierId && o.status === "draft");
          if (draft) {
            const existing = draft.lines.find((l) => l.itemId === line.itemId);
            const lines = existing
              ? draft.lines.map((l) => (l.itemId === line.itemId ? { ...l, cases: l.cases + line.cases } : l))
              : [...draft.lines, line];
            return { ...s, orders: s.orders.map((o) => (o.id === draft.id ? { ...o, lines } : o)) };
          }
          const n = s.orders.length + 1;
          const order: PurchaseOrder = {
            id: `PO-${new Date().getFullYear()}-${String(1000 + n)}`,
            supplierId,
            lines: [line],
            status: "draft",
            createdAt: now(),
            history: [{ status: "draft", at: now() }],
          };
          return { ...s, orders: [order, ...s.orders] };
        }),
      setOrderStatus: (orderId, status, note) =>
        update((s) => ({
          ...s,
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status, history: [...o.history, { status, at: now(), note }] } : o)),
        })),
      patchOrder: (orderId, patch) => update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)) })),
      reset: () => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        setState(initialRef.current);
      },
    };
  }, [state, hydrated, update]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export { DEFAULT_TARGETS };
