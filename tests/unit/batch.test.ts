import { describe, expect, it } from "vitest";
import { inChunks } from "@/lib/batch";

describe("inChunks (Postgres allows 32,767 values per query)", () => {
  it("splits long id lists, keeps order, and runs nothing for an empty list", async () => {
    const seen: number[] = [];
    const ids = Array.from({ length: 12_001 }, (_, i) => i);
    const out = await inChunks(ids, async (chunk) => { seen.push(chunk.length); return chunk.map((x) => x * 2); });
    expect(seen).toEqual([5000, 5000, 2001]);
    expect(out).toHaveLength(12_001);
    expect(out[12_000]).toBe(24_000);
    let calls = 0;
    expect(await inChunks([], async () => { calls++; return []; })).toEqual([]);
    expect(calls).toBe(0);
  });
});
