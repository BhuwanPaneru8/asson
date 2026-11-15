import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

// Renders a Handbook page body (the small text format described in src/handbook/types.ts). No HTML is ever
// taken from the text, so a page can't inject markup.

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul" | "check"; items: string[] }
  | { kind: "ol"; items: string[]; start: number }
  | { kind: "callout"; text: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseHandbook(body: string): Block[] {
  const out: Block[] = [];
  const lines = body.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const last = out.at(-1);
    if (!line) { out.push({ kind: "p", text: "" }); continue; } // paragraph break marker, dropped below
    if (line.startsWith("### ")) out.push({ kind: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) out.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith(">")) {
      const t = line.replace(/^>\s?/, "");
      if (last?.kind === "callout") last.text.push(t); else out.push({ kind: "callout", text: [t] });
    } else if (line.startsWith("|")) {
      const row = cells(line);
      if (last?.kind === "table") { if (!/^[-:\s|]+$/.test(line)) last.rows.push(row); }
      else out.push({ kind: "table", head: row, rows: [] });
    } else if (/^- \[[ x]\] /i.test(line)) {
      const t = line.replace(/^- \[[ x]\] /i, "");
      if (last?.kind === "check") last.items.push(t); else out.push({ kind: "check", items: [t] });
    } else if (/^[-*] /.test(line)) {
      const t = line.slice(2);
      if (last?.kind === "ul") last.items.push(t); else out.push({ kind: "ul", items: [t] });
    } else if (/^\d+[.)] /.test(line)) {
      const t = line.replace(/^\d+[.)] /, "");
      // a list can be interrupted by sub-points and carry on: keep its numbering ("4." after points starts at 4)
      if (last?.kind === "ol") last.items.push(t); else out.push({ kind: "ol", items: [t], start: parseInt(line, 10) || 1 });
    } else if (last?.kind === "p" && last.text) last.text += ` ${line}`;
    else out.push({ kind: "p", text: line });
  }
  return out.filter((b) => b.kind !== "p" || b.text);
}

/** **bold** and [label](href) inside a line. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
        const m = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (m) {
          const href = m[2];
          const cls = "font-medium text-accent underline underline-offset-2 hover:text-ink";
          return href.startsWith("/") ? <Link key={i} href={href} className={cls}>{m[1]}</Link> : <a key={i} href={href} className={cls} target="_blank" rel="noreferrer">{m[1]}</a>;
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

const TONE: Record<string, string> = {
  rule: "border-danger/50 bg-[#fdf3f1]",
  why: "border-accent/50 bg-accent-soft/50",
  tip: "border-success/50 bg-[#f1f8f3]",
};

export function HandbookText({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
      {parseHandbook(body).map((b, i) => {
        switch (b.kind) {
          case "h2": return <h2 key={i} className="pt-4 text-[19px] font-semibold text-ink"><Inline text={b.text} /></h2>;
          case "h3": return <h3 key={i} className="pt-2 text-[16px] font-semibold text-ink"><Inline text={b.text} /></h3>;
          case "p": return <p key={i}><Inline text={b.text} /></p>;
          case "ul": return <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>;
          case "ol": return <ol key={i} start={b.start} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-ink">{b.items.map((t, j) => <li key={j} className="pl-1"><Inline text={t} /></li>)}</ol>;
          case "check": return (
            <ul key={i} className="space-y-1.5">{b.items.map((t, j) => (
              <li key={j} className="flex gap-2.5"><span aria-hidden className="mt-[5px] inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border border-ink/50" /><span><Inline text={t} /></span></li>
            ))}</ul>
          );
          case "callout": {
            const kind = b.text[0].match(/^\*\*(Rule|Why|Tip):?\*\*/i)?.[1]?.toLowerCase() ?? "";
            return <div key={i} className={cn("space-y-1.5 rounded-md border-l-4 px-4 py-3 text-[14.5px] text-ink", TONE[kind] ?? "border-line bg-cloud/60")}>{b.text.map((t, j) => <p key={j}><Inline text={t} /></p>)}</div>;
          }
          case "table": return (
            <div key={i} className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-cloud/60 text-[12px] uppercase tracking-wide text-muted"><tr>{b.head.map((h, j) => <th key={j} className="px-3 py-2 font-semibold"><Inline text={h} /></th>)}</tr></thead>
                <tbody className="divide-y divide-line bg-white">{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="px-3 py-2 align-top text-ink-soft"><Inline text={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
      })}
    </div>
  );
}
