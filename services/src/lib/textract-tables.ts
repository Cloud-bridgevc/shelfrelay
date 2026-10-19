import type { Block } from "@aws-sdk/client-textract";

/**
 * Convert Textract TABLES analysis blocks into row arrays, one per table,
 * so they can be fed to the same extractCatalogue() used for CSV files.
 * Multi-page tables that repeat the header row are merged.
 */
export function tablesFromBlocks(blocks: Block[]): { page: number; rows: string[][] }[] {
  const byId = new Map(blocks.map((b) => [b.Id!, b]));
  const text = (cell: Block): string =>
    (cell.Relationships ?? [])
      .filter((r) => r.Type === "CHILD")
      .flatMap((r) => r.Ids ?? [])
      .map((id) => byId.get(id))
      .filter((b): b is Block => !!b && (b.BlockType === "WORD" || b.BlockType === "SELECTION_ELEMENT"))
      .map((b) => (b.BlockType === "WORD" ? b.Text ?? "" : b.SelectionStatus === "SELECTED" ? "X" : ""))
      .join(" ")
      .trim();

  const tables: { page: number; rows: string[][] }[] = [];
  for (const table of blocks.filter((b) => b.BlockType === "TABLE")) {
    const cells = (table.Relationships ?? [])
      .filter((r) => r.Type === "CHILD")
      .flatMap((r) => r.Ids ?? [])
      .map((id) => byId.get(id))
      .filter((b): b is Block => !!b && b.BlockType === "CELL");
    const rows: string[][] = [];
    for (const c of cells) {
      const r = (c.RowIndex ?? 1) - 1;
      const col = (c.ColumnIndex ?? 1) - 1;
      rows[r] ??= [];
      rows[r][col] = text(c);
    }
    tables.push({ page: table.Page ?? 1, rows: rows.map((r) => Array.from(r ?? [], (v) => v ?? "")) });
  }

  // Merge continuation tables whose header row matches the previous table's header.
  const merged: typeof tables = [];
  for (const t of tables) {
    const prev = merged[merged.length - 1];
    if (prev && t.rows[0] && prev.rows[0] && t.rows[0].join("|").toLowerCase() === prev.rows[0].join("|").toLowerCase()) {
      prev.rows.push(...t.rows.slice(1));
    } else {
      merged.push({ page: t.page, rows: [...t.rows] });
    }
  }
  return merged;
}

/** Serialize rows to CSV for extractCatalogue(). */
export function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
