import { createContext, useContext, type ReactNode } from "react";

import { useDashboard } from "../hooks/useDashboard";

const DashboardContext = createContext<
  ReturnType<typeof useDashboard> | undefined
>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const dashboard = useDashboard();
  return (
    <DashboardContext.Provider value={dashboard}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const dashboard = useContext(DashboardContext);
  if (!dashboard) throw new Error("DashboardProvider is required");
  return dashboard;
}
