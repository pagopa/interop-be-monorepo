import type { LogEntry } from "pagopa-interop-dev-dashboard-contracts";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualizedLogs } from "../../src/components/VirtualizedLogs";

function entry(id: string, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    source: "agreement",
    service: "Agreement service",
    level: "unknown",
    timestamp: "2026-10-21T10:00:00Z",
    message: `Frame ${id}`,
    ...overrides,
  };
}

function observeResizes() {
  const notifications: Array<() => void> = [];
  // Deliver browser measurements when retained rows gain or lose a header.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private elements = new Set<HTMLElement>();
      constructor(
        callback: (
          entries: Array<{
            target: HTMLElement;
            borderBoxSize: Array<{ blockSize: number; inlineSize: number }>;
          }>
        ) => void
      ) {
        notifications.push(() =>
          callback(
            Array.from(this.elements, (target) => ({
              target,
              borderBoxSize: [
                { blockSize: target.offsetHeight, inlineSize: 800 },
              ],
            }))
          )
        );
      }
      observe(element: HTMLElement) {
        this.elements.add(element);
      }
      unobserve(element: HTMLElement) {
        this.elements.delete(element);
      }
      disconnect() {
        this.elements.clear();
      }
    }
  );
  return () => act(() => notifications.forEach((notify) => notify()));
}

describe("virtualized log presentation", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "listitem")
          return this.querySelector("time") ? 96 : 40;
        return 240;
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  });

  it("groups only consecutive matching source and displayed service while retaining line order, severity, CID and copy focus", async () => {
    const entries = [
      entry("6", { timestamp: "2026-10-21T10:00:03Z", level: "error" }),
      entry("5", { timestamp: "2026-10-21T10:00:01Z", cid: "cid-5" }),
      entry("4", { timestamp: "2026-10-21T10:00:02Z", level: "warn" }),
      entry("3", { source: "consumer", service: "Consumer service" }),
      entry("2"),
      entry("1", { service: "Another service" }),
      entry("0", { source: "consumer", service: "Another service" }),
    ];
    const onCopyLine = vi.fn().mockResolvedValue(undefined);
    const onCopyCid = vi.fn().mockResolvedValue(undefined);
    const props = { entries, onCopyLine, onCopyCid };
    const { rerender } = render(<VirtualizedLogs {...props} />);
    const list = screen.getByRole("list", { name: "Aggregate log entries" });
    expect(within(list).getAllByText("Agreement service")).toHaveLength(4);
    const copy = within(screen.getAllByRole("listitem")[1]).getByRole(
      "button",
      { name: "Copy log line" }
    );
    copy.focus();
    rerender(<VirtualizedLogs {...props} groupByPackage />);
    const rows = within(list).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByText(/^Frame /).textContent)
    ).toEqual(entries.map((item) => item.message));
    expect(within(list).getAllByText("Agreement service")).toHaveLength(2);
    expect(within(rows[1]).queryByText("agreement")).not.toBeInTheDocument();
    expect(within(rows[2]).queryByText("agreement")).not.toBeInTheDocument();
    expect(within(rows[3]).getByText("Consumer service")).toBeVisible();
    expect(within(rows[4]).getByText("Agreement service")).toBeVisible();
    expect(within(rows[5]).getByText("Another service")).toBeVisible();
    expect(within(rows[6]).getByText("Another service")).toBeVisible();
    expect(within(rows[6]).getByText("consumer")).toBeVisible();
    expect(
      Array.from(rows[0].querySelectorAll("time")).map((time) => time.dateTime)
    ).toEqual(["2026-10-21T10:00:01Z", "2026-10-21T10:00:03Z"]);
    expect(within(rows[0]).getByText("error")).toBeVisible();
    expect(within(rows[2]).getByText("warn")).toBeVisible();
    expect(within(list).queryByText("unknown")).not.toBeInTheDocument();
    expect(copy).toHaveFocus();
    const user = userEvent.setup();
    await user.keyboard("{Enter}");
    expect(onCopyLine).toHaveBeenCalledExactlyOnceWith("Frame 5");
    await user.click(
      within(rows[1]).getByRole("button", { name: "Copy correlation ID cid-5" })
    );
    expect(onCopyCid).toHaveBeenCalledExactlyOnceWith("cid-5");
    rerender(<VirtualizedLogs {...props} groupByPackage copyDisabled />);
    for (const button of within(list).getAllByRole("button"))
      expect(button).toBeDisabled();
  });

  it("shows a shared second once while retaining the precise group time range", () => {
    const timestamp = "2026-10-21T10:00:00.100Z";
    const lastTimestamp = "2026-10-21T10:00:00.900Z";
    render(
      <VirtualizedLogs
        entries={[
          entry("2", { timestamp: lastTimestamp }),
          entry("1", { timestamp }),
        ]}
        groupByPackage
        onCopyLine={vi.fn().mockResolvedValue(undefined)}
        onCopyCid={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const header = screen.getAllByRole("listitem")[0];
    expect(header.querySelectorAll("time")).toHaveLength(1);
    expect(
      within(header).getByTitle(`${timestamp} – ${lastTimestamp}`)
    ).toHaveAttribute("dateTime", timestamp);
  });

  it("virtualizes a 500-line group per entry, keeps its context while scrolling, and remeasures sizes when toggled", async () => {
    const entries = Array.from({ length: 500 }, (_, index) =>
      entry(String(500 - index))
    );
    const props = {
      entries,
      onCopyLine: vi.fn().mockResolvedValue(undefined),
      onCopyCid: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(<VirtualizedLogs {...props} />);
    const list = screen.getByRole("list", { name: "Aggregate log entries" });
    const initialHeight = list.firstElementChild?.getAttribute("style");
    rerender(<VirtualizedLogs {...props} groupByPackage />);
    expect(within(list).getAllByRole("listitem").length).toBeLessThan(30);
    const second = list.querySelector('[data-index="1"]');
    const third = list.querySelector('[data-index="2"]');
    expect(second).toHaveStyle({ transform: "translateY(96px)" });
    expect(third).toHaveStyle({ transform: "translateY(136px)" });
    expect(list.firstElementChild?.getAttribute("style")).not.toBe(
      initialHeight
    );
    list.scrollTop = 8000;
    fireEvent.scroll(list);
    await waitFor(() =>
      expect(list.querySelector('[data-index="0"]')).not.toBeInTheDocument()
    );
    expect(within(list).getAllByRole("listitem").length).toBeLessThan(30);
    const context = screen.getByRole("group", { name: "Current log group" });
    expect(within(context).getByText("Agreement service")).toBeVisible();
    expect(within(context).getByText("agreement")).toBeVisible();
    rerender(<VirtualizedLogs {...props} />);
    expect(
      screen.queryByRole("group", { name: "Current log group" })
    ).not.toBeInTheDocument();
    const rows = within(list).getAllByRole("listitem");
    expect(rows.length).toBeLessThan(30);
    expect(rows.every((row) => row.querySelector("time"))).toBe(true);
  });

  it("keeps the group context visible after scrolling inside its tall first entry", async () => {
    const notifyResize = observeResizes();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "listitem")
          return this.dataset.index === "0" ? 900 : 40;
        return 240;
      }
    );
    render(
      <VirtualizedLogs
        entries={[
          entry("2", { message: "A long stack trace\n".repeat(40) }),
          entry("1"),
        ]}
        groupByPackage
        onCopyLine={vi.fn().mockResolvedValue(undefined)}
        onCopyCid={vi.fn().mockResolvedValue(undefined)}
      />
    );
    notifyResize();
    const list = screen.getByRole("list", { name: "Aggregate log entries" });
    expect(list.querySelector('[data-index="0"]')).toHaveProperty(
      "offsetHeight",
      900
    );
    expect(list.querySelector('[data-index="1"]')).toHaveStyle({
      transform: "translateY(900px)",
    });
    expect(
      screen.queryByRole("group", { name: "Current log group" })
    ).not.toBeInTheDocument();
    list.scrollTop = 400;
    fireEvent.scroll(list);
    const context = await screen.findByRole("group", {
      name: "Current log group",
    });
    expect(within(context).getByText("Agreement service")).toBeVisible();
    expect(within(context).getByText("agreement")).toBeVisible();
    expect(list.querySelector('[data-index="1"]')).toHaveStyle({
      transform: "translateY(900px)",
    });
  });

  it("updates grouped stream ranges, boundaries, order and measured positions while already scrolled", async () => {
    const notifyResize = observeResizes();
    function timedEntry(id: number, source = "agreement") {
      return entry(String(id), {
        source,
        service:
          source === "agreement" ? "Agreement service" : "Consumer service",
        timestamp: `2026-10-21T10:00:${String(id).padStart(2, "0")}Z`,
      });
    }
    const entries = Array.from({ length: 20 }, (_, index) =>
      timedEntry(20 - index)
    );
    const props = {
      groupByPackage: true,
      onCopyLine: vi.fn().mockResolvedValue(undefined),
      onCopyCid: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(
      <VirtualizedLogs {...props} entries={entries} />
    );
    notifyResize();
    const list = screen.getByRole("list", { name: "Aggregate log entries" });
    list.scrollTop = 320;
    fireEvent.scroll(list);
    const context = await screen.findByRole("group", {
      name: "Current log group",
    });
    expect(within(context).getByText("agreement")).toBeVisible();
    expect(
      Array.from(context.querySelectorAll("time"), (time) => time.dateTime)
    ).toEqual(["2026-10-21T10:00:01Z", "2026-10-21T10:00:20Z"]);
    const extended = [timedEntry(21), ...entries];
    rerender(<VirtualizedLogs {...props} entries={extended} />);
    notifyResize();
    expect(
      Array.from(context.querySelectorAll("time"), (time) => time.dateTime)
    ).toEqual(["2026-10-21T10:00:01Z", "2026-10-21T10:00:21Z"]);
    expect(list.querySelector('[data-index="1"]')).toHaveStyle({
      transform: "translateY(96px)",
    });
    expect(list.querySelector('[data-index="2"]')).toHaveStyle({
      transform: "translateY(136px)",
    });
    expect(list.querySelector('[data-index="1"] time')).not.toBeInTheDocument();
    const interleaved = [
      ...Array.from({ length: 8 }, (_, index) =>
        timedEntry(29 - index, "consumer")
      ),
      ...extended,
    ];
    rerender(<VirtualizedLogs {...props} entries={interleaved} />);
    notifyResize();
    expect(within(context).getByText("consumer")).toBeVisible();
    expect(
      Array.from(context.querySelectorAll("time"), (time) => time.dateTime)
    ).toEqual(["2026-10-21T10:00:22Z", "2026-10-21T10:00:29Z"]);
    const rows = within(list).getAllByRole("listitem");
    const firstIndex = Number(rows[0].dataset.index);
    expect(
      rows.map((row) => within(row).getByText(/^Frame /).textContent)
    ).toEqual(
      interleaved
        .slice(firstIndex, firstIndex + rows.length)
        .map((item) => item.message)
    );
    expect(rows.length).toBeLessThan(interleaved.length);
    const boundary = list.querySelector<HTMLElement>('[data-index="8"]');
    expect(boundary).toHaveStyle({ transform: "translateY(376px)" });
    if (!boundary) throw new Error("Group boundary missing");
    expect(within(boundary).getByText("Agreement service")).toBeVisible();
    expect(
      Array.from(boundary.querySelectorAll("time"), (time) => time.dateTime)
    ).toEqual(["2026-10-21T10:00:01Z", "2026-10-21T10:00:21Z"]);
    expect(list.querySelector('[data-index="9"]')).toHaveStyle({
      transform: "translateY(472px)",
    });
    expect(list.querySelector('[data-index="9"] time')).not.toBeInTheDocument();
  });

  it("discards an offscreen header height when a new entry extends its run without discarding unchanged measurements", async () => {
    const notifyResize = observeResizes();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "listitem")
          return this.querySelector("time") ? 120 : 40;
        return 240;
      }
    );
    const entries = Array.from({ length: 20 }, (_, index) =>
      entry(String(20 - index))
    );
    const props = {
      groupByPackage: true,
      onCopyLine: vi.fn().mockResolvedValue(undefined),
      onCopyCid: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(
      <VirtualizedLogs {...props} entries={entries} />
    );
    notifyResize();
    const list = screen.getByRole("list", { name: "Aggregate log entries" });
    list.scrollTop = 600;
    fireEvent.scroll(list);
    await waitFor(() =>
      expect(list.querySelector('[data-index="0"]')).not.toBeInTheDocument()
    );
    notifyResize();
    const spacer = list.firstElementChild;
    if (!(spacer instanceof HTMLElement)) throw new Error("Log spacer missing");
    const initialHeight = Number.parseFloat(spacer.style.height);
    expect(initialHeight).toBe(880);
    const extended = [entry("21"), ...entries];
    rerender(<VirtualizedLogs {...props} entries={extended} />);
    notifyResize();
    expect(list.querySelector('[data-index="1"]')).not.toBeInTheDocument();
    // The former header is unmounted: use the continuation estimate until it is measured again.
    expect(spacer).toHaveStyle({ height: `${initialHeight + 24}px` });
    rerender(<VirtualizedLogs {...props} entries={[...extended]} />);
    notifyResize();
    expect(spacer).toHaveStyle({ height: `${initialHeight + 24}px` });
    list.scrollTop = 0;
    fireEvent.scroll(list);
    expect(list.querySelector('[data-index="1"]')).toHaveStyle({
      transform: "translateY(96px)",
    });
    expect(list.querySelector('[data-index="2"]')).toHaveStyle({
      transform: "translateY(144px)",
    });
    notifyResize();
    expect(spacer).toHaveStyle({ height: `${initialHeight + 40}px` });
    expect(list.querySelector('[data-index="2"]')).toHaveStyle({
      transform: "translateY(160px)",
    });
  });
});
