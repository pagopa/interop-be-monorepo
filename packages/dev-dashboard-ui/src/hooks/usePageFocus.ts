import { useEffect, useRef } from "react";

export function usePageFocus(pathname: string) {
  const content = useRef<HTMLElement>(null);
  const previous = useRef(pathname);
  // Route changes move keyboard focus into the new page without scrolling the shell.
  useEffect(() => {
    if (previous.current !== pathname && content.current) {
      content.current.focus({ preventScroll: true });
      content.current.scrollTop = 0;
      content.current.scrollLeft = 0;
    }
    previous.current = pathname;
  }, [pathname]);
  return content;
}
