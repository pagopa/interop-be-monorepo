import type { ReactNode, RefObject } from "react";

export function AppShell({
  header,
  navigation,
  children,
  contentRef,
}: {
  header: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
  contentRef: RefObject<HTMLElement>;
}) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3"
        onClick={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
      >
        Skip to dashboard
      </a>
      {header}
      <div className="grid min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[208px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <aside className="min-h-0 overflow-auto border-b bg-card px-4 py-2 lg:border-b-0 lg:border-r lg:px-3 lg:py-7">
          {navigation}
        </aside>
        <main
          id="main"
          ref={contentRef}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-col gap-6 overflow-x-auto overflow-y-scroll overscroll-contain [scrollbar-gutter:stable] px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-7"
        >
          {children}
        </main>
      </div>
    </>
  );
}
