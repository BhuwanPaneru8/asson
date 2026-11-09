"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Check, AlertCircle } from "lucide-react";
import { uploadPhoto } from "@/lib/image-resize";

type Job = { id: number; name: string; state: "waiting" | "uploading" | "done" | "error"; message?: string };

/**
 * Drag-and-drop (or tap to choose) photo upload. Photos are resized in the browser and uploaded one
 * at a time, in the order chosen, so the first photo picked becomes the next image in the list.
 */
export function PhotoUploader({ onUploaded, slotsLeft, disabled }: { onUploaded: (url: string) => void; slotsLeft: number; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const busy = jobs.some((j) => j.state === "waiting" || j.state === "uploading");
  const seq = useRef(0);

  const patch = (id: number, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    const take = files.slice(0, Math.max(0, slotsLeft));
    const skipped = files.length - take.length;
    const queued = take.map((f) => ({ id: ++seq.current, name: f.name, state: "waiting" as const }));
    setJobs((js) => [...js.filter((j) => j.state !== "done"), ...queued, ...(skipped ? [{ id: ++seq.current, name: `${skipped} more`, state: "error" as const, message: "A product can have up to 20 photos" }] : [])]);
    for (const [i, file] of take.entries()) {
      const id = queued[i].id;
      patch(id, { state: "uploading" });
      try {
        const r = await uploadPhoto(file);
        onUploaded(r.url);
        const shape = r.height / r.width;
        patch(id, { state: "done", message: r.reused ? "Already uploaded — reused" : Math.abs(shape - 4 / 3) > 0.12 ? "Uploaded. Tip: 3:4 portrait photos look best" : undefined });
      } catch (e) {
        patch(id, { state: "error", message: e instanceof Error ? e.message : "Upload failed" });
      }
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) void addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-7 text-center transition-colors ${over ? "border-ink bg-cloud" : "border-line"} ${disabled ? "opacity-60" : ""}`}
      >
        <ImagePlus className="h-6 w-6 text-muted" aria-hidden />
        <p className="text-[14px]">
          Drag photos here or{" "}
          <button type="button" disabled={disabled || slotsLeft <= 0} onClick={() => inputRef.current?.click()} className="font-medium underline">choose from your device</button>
        </p>
        <p className="text-[12.5px] text-muted">JPEG, PNG or WebP · portrait 3:4 · at least 1600px wide is best · resized automatically</p>
        <input
          ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      {jobs.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[13px]" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-start gap-2">
              {j.state === "uploading" || j.state === "waiting" ? <Loader2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${j.state === "uploading" ? "animate-spin" : "opacity-40"}`} aria-hidden />
                : j.state === "done" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />}
              <span className="min-w-0 break-all">
                {j.name}
                <span className={j.state === "error" ? "text-danger" : "text-muted"}> — {j.state === "waiting" ? "waiting" : j.state === "uploading" ? "resizing and uploading…" : j.message ?? "uploaded"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="mt-2 text-[12.5px] text-muted">Keep this page open until uploads finish, then save the product.</p>}
    </div>
  );
}
