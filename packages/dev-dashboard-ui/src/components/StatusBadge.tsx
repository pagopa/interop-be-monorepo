import { LoaderCircle } from "lucide-react";

import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export function StatusBadge({
  state,
  pending = false,
  id,
}: {
  state: string;
  pending?: boolean;
  id?: string;
}) {
  const variant = pending
    ? "working"
    : state === "running" || state === "passed"
      ? "success"
      : state === "failed"
        ? "destructive"
        : state === "starting" || state === "building"
          ? "working"
          : "outline";
  return (
    <Badge
      id={id}
      role={pending ? "status" : undefined}
      variant={variant}
      format="status"
      className="whitespace-nowrap"
    >
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            variant === "success" && "bg-success"
          )}
          aria-hidden="true"
        />
      )}
      {state}
    </Badge>
  );
}
