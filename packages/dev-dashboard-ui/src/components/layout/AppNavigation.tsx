import { NavLink, useLocation } from "react-router-dom";

import { useDashboardContext } from "../../providers/DashboardProvider";
import { navigation } from "../../router/navigation";
import { paths } from "../../router/paths";
import { Button } from "../ui/button";

export function AppNavigation() {
  const { pathname } = useLocation();
  const { status } = useDashboardContext();
  return (
    <nav
      aria-label="Runtime tools"
      className="flex flex-wrap gap-1 lg:flex-col"
    >
      {navigation
        .filter(({ path }) => path !== paths.status || status?.frontend)
        .map(({ path, label, icon: Icon }) => (
          <Button
            key={path}
            asChild
            variant={pathname === path ? "default" : "ghost"}
            className="justify-start"
            size="default"
            weight="normal"
          >
            <NavLink to={path}>
              <Icon data-icon="inline-start" />
              {label}
            </NavLink>
          </Button>
        ))}
    </nav>
  );
}
