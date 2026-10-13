import type { LogEntry } from "pagopa-interop-dev-dashboard-contracts";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy } from "lucide-react";
import { useCallback, useRef } from "react";

import { Toolbar } from "./common/Toolbar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function logTime(timestamp: string | undefined) {
  if (!timestamp) return "";
  const time = new Date(timestamp);
  if (!Number.isFinite(time.getTime())) return timestamp;
  return time.toLocaleTimeString(undefined, { hour12: false });
}

export function VirtualizedLogs({
  entries,
  onCopyLine,
  onCopyCid,
  copyDisabled = false,
}: {
  entries: LogEntry[];
  onCopyLine: (message: string) => Promise<void>;
  onCopyCid: (cid: string) => Promise<void>;
  copyDisabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const getKey = useCallback(
    (index: number) => `${entries[index]?.source}:${entries[index]?.id}`,
    [entries]
  );
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: getKey,
    estimateSize: () => 96,
    overscan: 6,
    initialRect: { width: 800, height: 440 },
    useFlushSync: false,
  });
  return (
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
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index];
          if (!entry) return null;
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              role="listitem"
              data-index={item.index}
              className="group/log-row absolute left-0 top-0 w-full border-b px-4 py-3"
              style={{ transform: `translateY(${item.start}px)` }}
            >
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
                    <time
                      dateTime={entry.timestamp}
                      className="font-mono text-muted-foreground"
                    >
                      {logTime(entry.timestamp)}
                    </time>
                    <code className="break-all text-primary-hover">
                      {entry.service || entry.source}
                    </code>
                    <span className="break-all text-muted-foreground">
                      {entry.source}
                    </span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
