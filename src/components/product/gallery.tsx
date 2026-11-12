"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, images.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (!images.length) return <div className="aspect-[3/4] bg-cloud" />;

  return (
    <>
      {/* Mobile: swipeable */}
      <div className="relative md:hidden">
        <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
          {images.map((im, i) => (
            <button key={im.url + i} aria-label={`View image ${i + 1} larger`} onClick={() => { setIdx(i); setZoom(true); }} className="relative aspect-[3/4] w-full shrink-0 snap-center bg-cloud">
              <Image src={im.url} alt={im.alt || name} fill loading={i === 0 ? "eager" : undefined} fetchPriority={i === 0 ? "high" : undefined} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-ink" : "w-1.5 bg-ink/30")} />)}
          </div>
        )}
      </div>

      {/* Desktop: editorial grid */}
      <div className="hidden gap-2 md:grid md:grid-cols-2">
        {images.map((im, i) => (
          <button key={im.url + i} aria-label={`View image ${i + 1} larger`} onClick={() => { setIdx(i); setZoom(true); }} className={cn("relative cursor-zoom-in overflow-hidden bg-cloud", i === 0 && images.length % 2 === 1 ? "col-span-2 aspect-[4/5]" : "aspect-[3/4]")}>
            <Image src={im.url} alt={im.alt || name} fill loading={i < 2 ? "eager" : undefined} fetchPriority={i === 0 ? "high" : undefined} sizes="(min-width:1280px) 30vw, 40vw" className="object-cover transition-transform duration-700 hover:scale-[1.02]" />
          </button>
        ))}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-paper animate-fade-in" role="dialog" aria-modal="true" aria-label="Image viewer">
          <button onClick={() => setZoom(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white p-2.5 shadow" aria-label="Close"><X className="h-5 w-5" /></button>
          {images.length > 1 && (
            <>
              <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-4 z-10 rounded-full bg-white p-2.5 shadow" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-4 z-10 rounded-full bg-white p-2.5 shadow" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
          <div className="relative h-full w-full max-w-4xl">
            <Image src={images[idx].url} alt={images[idx].alt || name} fill sizes="100vw" quality={90} className="object-contain" />
          </div>
          <p className="absolute bottom-4 text-[13px] text-muted">{idx + 1} / {images.length}</p>
        </div>
      )}
    </>
  );
}
