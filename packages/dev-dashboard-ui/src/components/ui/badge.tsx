import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-success/30 bg-success-subtle text-success-foreground",
        warning: "border-warning/30 bg-warning-subtle text-warning-foreground",
        working: "border-primary/20 bg-primary/10 text-primary",
      },
      format: {
        default: "",
        status: "gap-1.5 capitalize",
        log: "font-mono uppercase",
        count:
          "h-6 w-24 shrink-0 justify-center whitespace-nowrap tabular-nums",
      },
    },
    defaultVariants: {
      variant: "default",
      format: "default",
    },
  }
);

interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, format, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, format }), className)}
      {...props}
    />
  );
}

export { Badge };
