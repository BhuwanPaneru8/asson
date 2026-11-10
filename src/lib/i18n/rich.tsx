import { Fragment, type ReactNode } from "react";

/** Fills {placeholders} with elements: rich(t("co.haveAccount"), { link: <Link …/> }). Works on server and client. */
export function rich(text: string, parts: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/g).map((chunk, i) => {
    const m = /^\{(\w+)\}$/.exec(chunk);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : chunk}</Fragment>;
  });
}
