import { NavLink, useLocation } from "react-router-dom";

import { navigation } from "../../router/navigation";
import { Button } from "../ui/button";

export function AppNavigation() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Runtime tools"
      className="flex flex-wrap gap-1 lg:flex-col"
    >
      {navigation.map(({ path, label, icon: Icon }) => (
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
