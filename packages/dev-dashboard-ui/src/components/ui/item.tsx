import type { HTMLAttributes } from "react";

// Adapted from the official item registry for standalone Radix and Tailwind 3.
import { Slot } from "@radix-ui/react-slot";

import { cn } from "../../lib/utils";

export function ItemGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="item-group"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}
export function Item({
  asChild,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      data-slot="item"
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-md p-4 text-sm",
        className
      )}
      {...props}
    />
  );
}
export function ItemContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-2", className)}
      {...props}
    />
  );
}
export function ItemTitle({
  asChild,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      data-slot="item-title"
      className={cn(
        "flex items-center gap-2 text-base font-semibold leading-snug",
        className
      )}
      {...props}
    />
  );
}
export function ItemDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="item-description"
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      {...props}
    />
  );
}
export function ItemActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
