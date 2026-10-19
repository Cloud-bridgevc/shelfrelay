import { describe, expect, it } from "vitest";
import type { Block } from "@aws-sdk/client-textract";
import { extractCatalogue } from "../../../web/src/lib/engine";
import { rowsToCsv, tablesFromBlocks } from "./textract-tables";

function table(id: string, page: number, rows: string[][]): Block[] {
  const blocks: Block[] = [];
  const cellIds: string[] = [];
  rows.forEach((r, ri) =>
    r.forEach((text, ci) => {
      const cid = `${id}-c${ri}-${ci}`;
      const wid = `${cid}-w`;
      cellIds.push(cid);
      blocks.push({ Id: wid, BlockType: "WORD", Text: text });
      blocks.push({ Id: cid, BlockType: "CELL", RowIndex: ri + 1, ColumnIndex: ci + 1, Relationships: [{ Type: "CHILD", Ids: text ? [wid] : [] }] });
    }),
  );
  blocks.push({ Id: id, BlockType: "TABLE", Page: page, Relationships: [{ Type: "CHILD", Ids: cellIds }] });
  return blocks;
}

describe("tablesFromBlocks", () => {
  it("rebuilds rows and merges continuation pages with a repeated header", () => {
    const header = ["Code", "Description", "Pack", "Case Price"];
    const blocks = [
      ...table("t1", 1, [header, ["A1", "Sparkling Water 330ml", "24x330ml", "11.40"]]),
      ...table("t2", 2, [header, ["A2", "Penne 500g", "12x500g", ""]]),
    ];
    const tables = tablesFromBlocks(blocks);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);

    const res = extractCatalogue(rowsToCsv(tables[0].rows), { supplierId: "s", file: "list.pdf", method: "textract" });
    expect(res.items[0].casePrice).toBe(11.4);
    expect(res.items[1].casePrice).toBeNull();
    expect(res.items[0].source.method).toBe("textract");
  });
});
