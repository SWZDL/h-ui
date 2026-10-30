import { Spinner } from "@/components/ui/spinner";

/**
 * Placeholder shown while a route chunk is being fetched. It matches the
 * content column of the shell so the layout does not jump when the page
 * arrives.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>Loading…</span>
      </div>
    </div>
  );
}
