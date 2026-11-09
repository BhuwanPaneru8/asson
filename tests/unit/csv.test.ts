import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("CSV", () => {
  it("parses quotes, escaped quotes, commas and line breaks inside cells, CRLF and Excel's BOM", () => {
    const text = '﻿name,description,price\r\n"Oxford, white","Soft ""button-down""\ncollar",2499\r\nLinen,,1999\r\n,,\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "description", "price"],
      ["Oxford, white", 'Soft "button-down"\ncollar', "2499"],
      ["Linen", "", "1999"],
    ]);
  });

  it("handles a last line without a newline and lone CR line endings (old Mac Excel)", () => {
    expect(parseCsv("a,b\rc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("round-trips through toCsv, and never lets Excel run a cell as a formula", () => {
    const rows = [["name", "note", "n"], ["Kurta, cotton", 'say "hi"', 12], ["=HYPERLINK(\"x\")", "+1 call", -5], ["multi\nline", "", null]];
    const csv = toCsv(rows);
    expect(csv.startsWith("﻿")).toBe(true);
    const back = parseCsv(csv);
    expect(back[1]).toEqual(["Kurta, cotton", 'say "hi"', "12"]);
    expect(back[2]).toEqual(["'=HYPERLINK(\"x\")", "'+1 call", "-5"]);
    expect(back[3]).toEqual(["multi\nline", "", ""]);
  });
});
