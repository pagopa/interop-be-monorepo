// Adapted from the official textarea registry for React 18 and Tailwind 3.
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const textareaVariants = cva(
  "flex min-h-20 w-full resize-y rounded-md border border-input px-3 py-2 shadow-none transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-card text-sm",
        code: "bg-muted font-mono text-xs",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> &
    VariantProps<typeof textareaVariants>
>(({ className, variant, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(textareaVariants({ variant }), className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";
