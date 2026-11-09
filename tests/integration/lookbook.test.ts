import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deleteLook, saveLook } from "@/actions/admin/lookbook";
import { getLookbook, getLookbookEntry, getLookbookForProduct } from "@/lib/looks";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeProduct, makeUser, resetDb } from "../support/db";

async function create(input: Parameters<typeof saveLook>[0]) {
  try {
    const r = await saveLook(input);
    return r.ok ? { id: r.id } : { error: r.error, fieldErrors: r.fieldErrors };
  } catch (e) {
    if (e instanceof RedirectError) return { id: e.url.split("/").pop()! };
    throw e;
  }
}
const look = (items: string[], extra: Partial<Parameters<typeof saveLook>[0]> = {}) => ({ title: "Weekend in Pokhara", subtitle: "Linen by the lake", story: "Easy.", heroImage: "", published: true, position: 0, items: items.map((productId) => ({ productId })), ...extra });

describe("lookbook", () => {
  beforeEach(async () => {
    await resetDb();
    actAs(await makeUser("ADMIN"));
  });

  it("publishes shoppable looks only: two pieces on sale, unique address, audited", async () => {
    const a = await makeProduct({ name: "Linen Shirt", price: 2500 });
    const b = await makeProduct({ name: "Chinos", price: 3000 });
    const draft = await makeProduct({ name: "Prototype" });
    await db.product.update({ where: { id: draft.id }, data: { status: "DRAFT" } });
    expect(await create(look([a.id, draft.id]))).toMatchObject({ error: expect.stringMatching(/at least two pieces that are on sale/) });
    expect(await create(look([a.id, b.id], { heroImage: "http://insecure.example/x.jpg" }))).toMatchObject({ error: expect.stringMatching(/https/) });
    const ok = await create(look([a.id, b.id, a.id], { items: [{ productId: a.id, note: "Sleeves rolled" }, { productId: b.id }, { productId: a.id }] }));
    expect(ok.id).toBeTruthy();
    expect(await db.lookItem.count({ where: { lookId: ok.id } })).toBe(2); // duplicates dropped
    expect(await create(look([a.id, b.id]))).toMatchObject({ fieldErrors: { slug: "Already used" } });
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "look.create" } })).summary).toMatch(/“Weekend in Pokhara” published \(2 pieces\)/);
    // managers can't edit the lookbook (catalogue editing is the owner's)
    actAs(await makeUser("MANAGER"));
    await expect(saveLook(look([a.id, b.id], { title: "Other" }))).rejects.toThrow();
  });

  it("shoppers see published looks only, without pieces that went off sale; hero falls back to the first piece", async () => {
    const a = await makeProduct({ name: "Linen Shirt", price: 2500 });
    const b = await makeProduct({ name: "Chinos", price: 3000 });
    const c = await makeProduct({ name: "Belt", price: 900 });
    await db.productImage.create({ data: { productId: a.id, url: "/media/aaa.webp", alt: "Linen shirt", position: 0 } });
    const pub = await create(look([a.id, b.id, c.id], { items: [{ productId: a.id, note: "Sleeves rolled" }, { productId: b.id }, { productId: c.id }] }));
    await create(look([a.id, b.id], { title: "Draft look", published: false }));
    await db.product.update({ where: { id: c.id }, data: { status: "ARCHIVED" } });

    const list = await getLookbook();
    expect(list).toEqual([{ slug: "weekend-in-pokhara", title: "Weekend in Pokhara", subtitle: "Linen by the lake", hero: "/media/aaa.webp", pieces: 2, total: 550_000, inStock: true }]);
    const entry = (await getLookbookEntry("weekend-in-pokhara"))!;
    expect(entry.pieces.map((p) => [p.name, p.note])).toEqual([["Linen Shirt", "Sleeves rolled"], ["Chinos", null]]);
    expect(await getLookbookEntry("draft-look")).toBeNull();
    expect((await getLookbookForProduct(a.id)).map((l) => l.title)).toEqual(["Weekend in Pokhara"]);

    // a look whose pieces have all gone off sale disappears rather than showing an empty page
    await db.product.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { status: "ARCHIVED" } });
    expect(await getLookbook()).toEqual([]);
    expect(await getLookbookEntry("weekend-in-pokhara")).toBeNull();

    await expect(deleteLook(pub.id!)).rejects.toThrow(RedirectError);
    expect(await db.look.count({ where: { id: pub.id } })).toBe(0);
    expect(await db.product.count({ where: { id: { in: [a.id, b.id, c.id] } } })).toBe(3); // products untouched
  });
});
