import { PageSkeleton } from "@/components/ui/skeletons";

// A loading boundary also keeps link prefetching cheap: dynamic routes are prefetched only down to here.
export default function Loading() {
  return <PageSkeleton />;
}
