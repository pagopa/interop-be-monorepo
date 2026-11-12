import type { LogEntry } from "pagopa-interop-dev-dashboard-contracts";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { cn } from "../lib/utils";
import { Toolbar } from "./common/Toolbar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function logTime(timestamp: string | undefined, includeDate = false) {
  if (!timestamp) return "";
  const time = new Date(timestamp);
  if (!Number.isFinite(time.getTime())) return timestamp;
  return includeDate
    ? time.toLocaleString(undefined, { hour12: false })
    : time.toLocaleTimeString(undefined, { hour12: false });
}

type LogGroup = {
  startIndex: number;
  source: string;
  service: string;
  timestamp?: string;
  lastTimestamp?: string;
};

function consecutiveGroups(entries: LogEntry[]) {
  let group: LogGroup | undefined;
  return entries.map((entry, index) => {
    const service = entry.service || entry.source;
    if (!group || group.source !== entry.source || group.service !== service)
      group = { startIndex: index, source: entry.source, service };
    if (entry.timestamp) {
      const timestamp = Date.parse(entry.timestamp);
      if (
        !group.timestamp ||
        (Number.isFinite(timestamp) &&
          (!Number.isFinite(Date.parse(group.timestamp)) ||
            timestamp < Date.parse(group.timestamp)))
      )
        group.timestamp = entry.timestamp;
      if (
        !group.lastTimestamp ||
        (Number.isFinite(timestamp) &&
          (!Number.isFinite(Date.parse(group.lastTimestamp)) ||
            timestamp > Date.parse(group.lastTimestamp)))
      )
        group.lastTimestamp = entry.timestamp;
    }
    return group;
  });
}

function LogContext({
  source,
  service,
  timestamp,
  lastTimestamp,
}: Pick<LogGroup, "source" | "service" | "timestamp" | "lastTimestamp">) {
  const hasRange = lastTimestamp && lastTimestamp !== timestamp;
  const includeDate = Boolean(
    hasRange &&
    timestamp &&
    new Date(timestamp).toDateString() !==
      new Date(lastTimestamp).toDateString()
  );
  const firstTime = logTime(timestamp, includeDate);
  const lastTime = logTime(lastTimestamp, includeDate);
  const showRange = hasRange && firstTime !== lastTime;
  return (
    <>
      <span className="font-mono text-muted-foreground">
        <time
          dateTime={timestamp}
          title={
            hasRange && !showRange
              ? `${timestamp} – ${lastTimestamp}`
              : timestamp
          }
        >
          {firstTime}
        </time>
        {showRange && (
          <>
            {" – "}
            <time dateTime={lastTimestamp} title={lastTimestamp}>
              {lastTime}
            </time>
          </>
        )}
      </span>
      <code className="break-all text-primary-hover">{service || source}</code>
      <span className="break-all text-muted-foreground">{source}</span>
    </>
  );
}

export function VirtualizedLogs({
  entries,
  groupByPackage = false,
  onCopyLine,
  onCopyCid,
  copyDisabled = false,
}: {
  entries: LogEntry[];
  groupByPackage?: boolean;
  onCopyLine: (message: string) => Promise<void>;
  onCopyCid: (cid: string) => Promise<void>;
  copyDisabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => consecutiveGroups(entries), [entries]);
  const previousHeaderRoles = useRef(new Map<string, boolean>());
  const getKey = useCallback(
    (index: number) => `${entries[index]?.source}:${entries[index]?.id}`,
    [entries]
  );
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: getKey,
    estimateSize: (index) =>
      groupByPackage ? (groups[index]?.startIndex === index ? 56 : 20) : 96,
    overscan: 6,
    initialRect: { width: 800, height: 440 },
    useFlushSync: false,
  });
  useLayoutEffect(() => {
    // A presentation change invalidates cached heights, including offscreen rows.
    // Refresh mounted rows synchronously to avoid gaps between entries.
    virtualizer.measure();
    for (const row of scrollRef.current?.querySelectorAll<HTMLElement>(
      "[data-index]"
    ) ?? [])
      virtualizer.resizeItem(Number(row.dataset.index), row.offsetHeight);
  }, [groupByPackage, virtualizer]);
  useLayoutEffect(() => {
    const headerRoles = new Map<string, boolean>();
    entries.forEach((entry, index) => {
      const key = `${entry.source}:${entry.id}`;
      const isHeader = groups[index]?.startIndex === index;
      headerRoles.set(key, isHeader);
      const wasHeader = previousHeaderRoles.current.get(key);
      if (groupByPackage && wasHeader !== undefined && wasHeader !== isHeader) {
        // Offscreen retained rows cannot emit a resize when their header changes.
        const row = scrollRef.current?.querySelector<HTMLElement>(
          `[data-index="${index}"]`
        );
        virtualizer.resizeItem(
          index,
          row?.offsetHeight ?? (isHeader ? 56 : 20)
        );
      }
    });
    previousHeaderRoles.current = headerRoles;
  }, [entries, groups, groupByPackage, virtualizer]);
  const virtualItems = virtualizer.getVirtualItems();
  const firstVisible = virtualItems.find(
    (item) => item.end > (virtualizer.scrollOffset ?? 0)
  );
  const currentGroup =
    groupByPackage && firstVisible ? groups[firstVisible.index] : undefined;
  const pinnedGroup =
    currentGroup &&
    firstVisible &&
    (firstVisible.index > currentGroup.startIndex ||
      (virtualizer.scrollOffset ?? 0) > firstVisible.start)
      ? currentGroup
      : undefined;
  return (
    <div className="relative h-full min-h-0">
      <div
        ref={scrollRef}
        role="list"
        aria-label="Aggregate log entries"
        tabIndex={0}
        className="h-full min-h-0 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ contain: "strict" }}
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => {
            const entry = entries[item.index];
            if (!entry) return null;
            const group = groups[item.index];
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                role="listitem"
                data-index={item.index}
                className={cn(
                  "absolute left-0 top-0 w-full px-4",
                  !groupByPackage && "group/log-row border-b py-3"
                )}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {groupByPackage && group?.startIndex === item.index && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 pt-3 text-xs">
                    <LogContext {...group} />
                  </div>
                )}
                {groupByPackage ? (
                  <code className="block whitespace-pre-wrap break-words font-mono text-xs leading-5 [overflow-wrap:anywhere]">
                    {entry.message}
                  </code>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {entry.level !== "unknown" && (
                          <Badge
                            format="log"
                            variant={
                              entry.level === "error"
                                ? "destructive"
                                : entry.level === "warn"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {entry.level}
                          </Badge>
                        )}
                        <LogContext
                          source={entry.source}
                          service={entry.service || entry.source}
                          timestamp={entry.timestamp}
                        />
                      </div>
                      <code className="block whitespace-pre-wrap break-words font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                        {entry.message}
                      </code>
                      {entry.cid && (
                        <Toolbar className="mt-1 gap-1">
                          <code className="break-all text-xs text-muted-foreground">
                            CID {entry.cid}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy correlation ID ${entry.cid}`}
                            title="Copy correlation ID"
                            disabled={copyDisabled}
                            onClick={() => void onCopyCid(entry.cid ?? "")}
                          >
                            <Copy aria-hidden="true" />
                          </Button>
                        </Toolbar>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 opacity-0 transition-opacity duration-150 ease-out group-hover/log-row:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
                      aria-label="Copy log line"
                      title="Copy log line"
                      disabled={copyDisabled}
                      onClick={() => void onCopyLine(entry.message)}
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {pinnedGroup && (
        <div
          role="group"
          aria-label="Current log group"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card px-4 py-2 text-xs shadow-sm"
        >
          <LogContext {...pinnedGroup} />
        </div>
      )}
    </div>
  );
}
