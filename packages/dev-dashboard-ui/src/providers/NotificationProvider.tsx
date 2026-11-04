import type { ReactNode } from "react";

import { Toaster } from "../components/ui/sonner";

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" closeButton />
    </>
  );
}
