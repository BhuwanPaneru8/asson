import { Skeleton } from "./misc";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="container-page pb-8 pt-6" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-5 h-10 w-64" />
      <div className="mt-8 flex gap-10">
        <div className="hidden w-60 shrink-0 space-y-3 lg:block">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        <div className="flex-1"><ProductGridSkeleton /></div>
      </div>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="container-page pt-4 md:pt-6" aria-busy="true" aria-label="Loading product">
      <div className="grid gap-8 md:grid-cols-12 lg:gap-12">
        <div className="grid gap-2 md:col-span-7 md:grid-cols-2"><Skeleton className="aspect-[3/4]" /><Skeleton className="hidden aspect-[3/4] md:block" /></div>
        <div className="space-y-4 md:col-span-5">
          <Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-4/5" /><Skeleton className="h-7 w-32" />
          <div className="grid grid-cols-5 gap-2 pt-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page min-h-[100svh] space-y-4 py-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
