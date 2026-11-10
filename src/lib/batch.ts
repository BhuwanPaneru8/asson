/**
 * Postgres accepts at most 32,767 bind values in one statement, and Prisma turns `{ in: ids }` into one value
 * per id. At national scale (tens of thousands of sizes) an unbounded id list crashes the query, so long
 * lists go through here in chunks. Sequential on purpose: chunks share the caller's connection/transaction.
 */
export const IN_CHUNK = 5_000;

export async function inChunks<T, R>(items: T[], run: (chunk: T[]) => Promise<R[]>, size = IN_CHUNK): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await run(items.slice(i, i + size))));
  return out;
}
