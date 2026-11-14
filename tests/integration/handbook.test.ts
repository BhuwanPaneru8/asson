import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { markRead, myPath, searchPages, submitQuiz, teamProgress } from "@/lib/handbook";
import { saveSop, signOff } from "@/lib/training";
import { pageBySlug, PATHS } from "@/handbook";
import { makeLocation, makeUser, resetDb } from "../support/db";

type U = Awaited<ReturnType<typeof makeUser>>;
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("handbook: reading paths, questions and team onboarding", () => {
  let owner: U, ram: U, hari: U, manager: U;
  beforeEach(async () => {
    await resetDb();
    const ktm = await makeLocation({ code: "KTM", name: "Kathmandu shop" });
    const pkr = await makeLocation({ code: "PKR", name: "Pokhara shop" });
    owner = await makeUser("ADMIN", { name: "Owner" });
    ram = await makeUser("CASHIER", { name: "Ram", locations: [ktm.id] });
    hari = await makeUser("CASHIER", { name: "Hari", locations: [pkr.id] });
    manager = await makeUser("MANAGER", { name: "Sita", locations: [ktm.id] });
  });

  it("gives a cashier the cashier path, and a page counts once read (and its questions passed)", async () => {
    const path = await myPath(ram);
    expect(path.job).toBe("cashier");
    expect(path.items.map((i) => i.slug)).toEqual(PATHS.find((p) => p.job === "cashier")!.read);
    expect(path.done).toBe(0);

    await tx((t) => markRead(t, ram, "using-the-handbook")); // no questions: done once read
    await tx((t) => markRead(t, ram, "welcome")); // has questions: read, not done
    let states = new Map((await myPath(ram)).items.map((i) => [i.slug, i.state]));
    expect(states.get("using-the-handbook")).toBe("done");
    expect(states.get("welcome")).toBe("read");

    const quiz = pageBySlug("welcome")!.quiz!;
    const wrong = await tx((t) => submitQuiz(t, ram, "welcome", quiz.map((q) => (q.answer + 1) % q.options.length)));
    expect(wrong).toMatchObject({ score: 0, passed: false });
    expect(wrong.results.every((r) => !r.right && r.why)).toBe(true);
    const right = await tx((t) => submitQuiz(t, ram, "welcome", quiz.map((q) => q.answer)));
    expect(right).toMatchObject({ score: 100, passed: true });
    // a worse try later never lowers the best score
    await tx((t) => submitQuiz(t, ram, "welcome", quiz.map((q) => (q.answer + 1) % q.options.length)));
    states = new Map((await myPath(ram)).items.map((i) => [i.slug, i.state]));
    expect(states.get("welcome")).toBe("done");
    expect((await myPath(ram)).done).toBe(2);
  });

  it("asks for a page again when it changes in a way people must re-read", async () => {
    await tx((t) => markRead(t, ram, "using-the-handbook"));
    const page = pageBySlug("using-the-handbook")!;
    page.version += 1; // as if the page had been rewritten
    try {
      expect((await myPath(ram)).items.find((i) => i.slug === page.slug)!.state).toBe("changed");
      await tx((t) => markRead(t, ram, page.slug));
      expect((await myPath(ram)).items.find((i) => i.slug === page.slug)!.state).toBe("done");
    } finally { page.version -= 1; }
  });

  it("keeps strategy pages to the owner, and refuses half-answered questions", async () => {
    await expect(tx((t) => markRead(t, ram, "worldclass-review"))).rejects.toThrow(/isn't available/);
    await expect(tx((t) => markRead(t, ram, "no-such-page"))).rejects.toThrow(/isn't available/);
    await expect(tx((t) => markRead(t, owner, "worldclass-review"))).resolves.toBeTruthy();
    await expect(tx((t) => submitQuiz(t, ram, "welcome", [1]))).rejects.toThrow(/every question/);
    expect(searchPages(ram, "world-class review").some((p) => p.slug === "worldclass-review")).toBe(false);
    expect(searchPages(owner, "world-class review")[0]?.slug).toBe("worldclass-review");
    expect(searchPages(ram, "refund").length).toBeGreaterThan(3);
  });

  it("shows a manager their own locations' onboarding: path and procedures signed", async () => {
    const sop = await tx((t) => saveSop(t, owner, { title: "Selling at the till", area: "SALES", roles: ["CASHIER"], body: "## Steps\n1. Scan everything you sell", major: false }));
    await tx((t) => signOff(t, ram, sop.id));
    for (const slug of PATHS.find((p) => p.job === "cashier")!.read) {
      await tx((t) => markRead(t, ram, slug));
      const q = pageBySlug(slug)!.quiz;
      if (q) await tx((t) => submitQuiz(t, ram, slug, q.map((x) => x.answer)));
    }
    const ktmScope = { all: false as const, storeIds: (await db.store.findMany({ where: { code: "KTM" } })).map((s) => s.id) };
    const rows = await teamProgress(ktmScope);
    expect(rows.map((r) => r.name).sort()).toEqual(["Ram", "Sita"]); // not Hari in Pokhara
    const r = rows.find((x) => x.name === "Ram")!;
    expect(r).toMatchObject({ job: "cashier", signed: 1, sopsDue: 1, complete: true, avgScore: 100, stuck: false });
    expect(r.read).toBe(r.of);
    expect(rows.find((x) => x.name === "Sita")).toMatchObject({ read: 0, complete: false, stuck: true });
    expect((await teamProgress({ all: true })).length).toBe(4);
    void hari; void manager;
  });
});
