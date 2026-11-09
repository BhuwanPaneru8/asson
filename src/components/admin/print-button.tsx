"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="mt-6 rounded-md bg-black px-4 py-2 text-white print:hidden">Print</button>;
}
