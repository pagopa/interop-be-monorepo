// Adapted from the official empty registry for Tailwind 3.
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Empty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg p-6 text-center md:p-10",
        className
      )}
      {...props}
    />
  );
}
export function EmptyHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-prose flex-col items-center gap-2", className)}
      {...props}
    />
  );
}
export function EmptyDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
