// Adapted from the official input-group registry for React 18 and Tailwind 3.
import { forwardRef, type HTMLAttributes, type ComponentProps } from "react";

import { cn } from "../../lib/utils";
import { Input } from "./input";

export function InputGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "flex h-10 min-w-0 items-center rounded-md border border-input bg-card transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20",
        className
      )}
      {...props}
    />
  );
}
export function InputGroupAddon({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "order-first flex shrink-0 items-center pl-3 text-muted-foreground [&>svg]:size-4",
        className
      )}
      {...props}
    />
  );
}
export const InputGroupInput = forwardRef<
  HTMLInputElement,
  ComponentProps<typeof Input>
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "min-w-0 flex-1 border-0 bg-transparent shadow-none focus:ring-0",
      className
    )}
    {...props}
  />
));
InputGroupInput.displayName = "InputGroupInput";
