import type { ComponentProps, CSSProperties } from "react";

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

const toasterStyle = {
  "--normal-bg": "hsl(var(--card))",
  "--normal-text": "hsl(var(--foreground))",
  "--normal-border": "hsl(var(--border))",
  "--toast-close-button-start": "auto",
  "--toast-close-button-end": "16px",
  "--toast-close-button-transform": "translateY(16px)",
  fontFamily: "inherit",
} satisfies CSSProperties & Record<`--${string}`, string>;

// shadcn Sonner adapter, using this standalone dashboard's light theme tokens.
export function Toaster({ style, ...props }: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheck size={16} aria-hidden="true" />,
        info: <Info size={16} aria-hidden="true" />,
        warning: <TriangleAlert size={16} aria-hidden="true" />,
        error: <OctagonX size={16} aria-hidden="true" />,
        loading: (
          <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
        ),
      }}
      style={{ ...toasterStyle, ...style }}
      toastOptions={{
        closeButtonAriaLabel: "Close notification",
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:pr-12",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
