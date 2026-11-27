import type { ComponentProps, HTMLAttributes } from "react";

// Adapted from the official field registry for React 18 and Tailwind 3.
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { Label } from "./label";

export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...props}
    />
  );
}
export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return (
    <legend
      data-slot="field-legend"
      className={cn("mb-3 text-sm font-semibold", className)}
      {...props}
    />
  );
}
export function FieldGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    />
  );
}
const fieldVariants = cva(
  "flex min-w-0 gap-2 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col",
        horizontal: "flex-row items-center",
        responsive: "flex-col sm:flex-row sm:items-center",
      },
    },
    defaultVariants: { orientation: "vertical" },
  }
);
export function Field({
  className,
  orientation,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}
export function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("leading-snug", className)}
      {...props}
    />
  );
}
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
