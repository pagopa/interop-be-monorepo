// Adapted from the official native-select registry for React 18 and Tailwind 3.
import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  type SelectHTMLAttributes,
  type ComponentProps,
} from "react";

import { cn } from "../../lib/utils";

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div data-slot="native-select-wrapper" className="relative min-w-0">
    <select
      ref={ref}
      data-slot="native-select"
      className={cn(
        "h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 pr-9 text-sm shadow-none transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      data-slot="native-select-icon"
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
));
NativeSelect.displayName = "NativeSelect";
export function NativeSelectOption(props: ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}
export function NativeSelectOptGroup(props: ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}
