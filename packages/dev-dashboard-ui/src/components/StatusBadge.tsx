import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export function StatusBadge({ state }: { state: string }) {
  const variant =
    state === "running" || state === "passed"
      ? "success"
      : state === "failed"
        ? "destructive"
        : state === "starting" || state === "building"
          ? "working"
          : "outline";
  return (
    <Badge variant={variant} format="status">
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          variant === "success" && "bg-success"
        )}
        aria-hidden="true"
      />
      {state}
    </Badge>
  );
}
