import type {
  LogEntry,
  LogsResponse,
} from "pagopa-interop-dev-dashboard-contracts";

import { randomUUID } from "node:crypto";

import type { LogQuery } from "../model/domain/models.js";

import { LOG_LIMITS, LOG_SOURCE_PREFIXES } from "../config/constants.js";

type StoredLogEntry = { sequence: number; entry: LogEntry };

type LogBufferState = {
  generation: string;
  next: number;
  entries: StoredLogEntry[];
};

type LogService = {
  sources(): string[];
  reset(source: string): void;
  append(source: string, raw: string): void;
  read(query: LogQuery): LogsResponse;
};

type LogCandidate = StoredLogEntry & { generation: string };

type BufferRead = {
  source: string;
  buffer: LogBufferState;
  reset: boolean;
  candidates: LogCandidate[];
};

const ansiColor = new RegExp(
  String.raw`${String.fromCodePoint(27)}\[[0-9;]*m`,
  "g"
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const newBuffer = (): LogBufferState => ({
  generation: randomUUID(),
  next: 1,
  entries: [],
});

function structuredLog(raw: string): Record<string, unknown> {
  const brace = raw.indexOf("{");
  try {
    const value: unknown = JSON.parse(raw.slice(Math.max(0, brace)));
    return isRecord(value) ? value : {};
  } catch {
    // Plain text is a supported log format.
    return {};
  }
}

function logLevel(
  raw: string,
  structured: Record<string, unknown>
): LogEntry["level"] {
  const level =
    (typeof structured.level === "string"
      ? structured.level.toLowerCase()
      : /\b(debug|info|warn(?:ing)?|error|fatal)\b/i
          .exec(raw)?.[1]
          ?.toLowerCase()) ?? "unknown";
  switch (level) {
    case "fatal":
      return "error";
    case "warning":
      return "warn";
    case "info":
    case "debug":
    case "warn":
    case "error":
      return level;
    default:
      return "unknown";
  }
}

function logEntry(source: string, raw: string, id: string): LogEntry {
  const structured = structuredLog(raw);
  const cid =
    structured.correlationId ??
    structured.correlation_id ??
    structured.cid ??
    /(?:correlationId|correlation_id|cid)[=:" ]+([\w-]+)/i.exec(raw)?.[1];
  const timestamp =
    typeof structured.timestamp === "string"
      ? structured.timestamp
      : (/^\d{4}-\d\d-\d\dT\S+/.exec(raw)?.[0] ?? new Date().toISOString());
  return {
    id,
    source,
    service: source.startsWith(LOG_SOURCE_PREFIXES.infrastructure)
      ? source.slice(LOG_SOURCE_PREFIXES.infrastructure.length)
      : source,
    timestamp,
    level: logLevel(raw, structured),
    message:
      typeof structured.message === "string"
        ? structured.message
        : raw.replace(ansiColor, ""),
    ...(typeof cid === "string" ? { cid } : {}),
  };
}

function sourceSelection(query: LogQuery): Set<string> | undefined {
  if (query.sources) return new Set(query.sources);
  if (query.source) return new Set([query.source]);
  return undefined;
}

function cursorPosition(
  buffer: LogBufferState,
  cursor: string | undefined
): { after: number; reset: boolean } {
  if (cursor === undefined) return { after: 0, reset: false };
  const [generation, serializedSequence] = cursor.split(":");
  const sequence = Number(serializedSequence);
  const floor = buffer.entries[0]?.sequence ?? buffer.next;
  const reset =
    generation !== buffer.generation ||
    !Number.isSafeInteger(sequence) ||
    sequence < floor - 1 ||
    sequence >= buffer.next;
  return { after: reset ? 0 : sequence, reset };
}

function entryMatcher(query: LogQuery): (entry: LogEntry) => boolean {
  const search = query.search?.toLowerCase();
  return (entry) =>
    (!query.level || entry.level === query.level) &&
    (!query.service || entry.service === query.service) &&
    (!search ||
      entry.message.toLowerCase().includes(search) ||
      Boolean(entry.cid?.toLowerCase().includes(search))) &&
    (!query.cid || entry.cid === query.cid);
}

function readBuffer(
  source: string,
  buffer: LogBufferState,
  cursor: string | undefined,
  matchesEntry: (entry: LogEntry) => boolean
): BufferRead {
  const { after, reset } = cursorPosition(buffer, cursor);
  const candidates = buffer.entries
    .filter((item) => item.sequence > after && matchesEntry(item.entry))
    .map((item) => ({ ...item, generation: buffer.generation }));
  return { source, buffer, reset, candidates };
}

const latestCursor = (buffer: LogBufferState): string =>
  `${buffer.generation}:${buffer.next - 1}`;

export function logServiceBuilder(
  capacity: number = LOG_LIMITS.bufferCapacity
): LogService {
  const buffers = new Map<string, LogBufferState>();
  let order = 0;

  function sources(): string[] {
    return [...buffers.keys()];
  }

  function reset(source: string): void {
    buffers.set(source, newBuffer());
  }

  function append(source: string, raw: string): void {
    if (!raw.trim()) return;
    let buffer = buffers.get(source);
    if (!buffer) {
      buffer = newBuffer();
      buffers.set(source, buffer);
    }
    const entry = logEntry(source, raw, String(++order));
    buffer.entries.push({ sequence: buffer.next++, entry });
    if (buffer.entries.length > capacity)
      buffer.entries.splice(0, buffer.entries.length - capacity);
  }

  function read(query: LogQuery): LogsResponse {
    const selectedSources = sourceSelection(query);
    const includesSource = (source: string) =>
      !selectedSources || selectedSources.has(source);
    const cursors = Object.fromEntries(
      Object.entries(query.cursors ?? {}).filter(([source]) =>
        includesSource(source)
      )
    );
    const matchesEntry = entryMatcher(query);
    const reads = [...buffers]
      .filter(([source]) => includesSource(source))
      .map(([source, buffer]) =>
        readBuffer(source, buffer, query.cursors?.[source], matchesEntry)
      );
    const candidates = reads.flatMap(({ candidates }) => candidates);
    candidates.sort((a, b) => Number(a.entry.id) - Number(b.entry.id));
    const initial = !query.cursors || Object.keys(query.cursors).length === 0;
    const limit = Math.min(
      LOG_LIMITS.maxPageSize,
      Math.max(1, query.limit ?? LOG_LIMITS.defaultPageSize)
    );
    const selected = initial
      ? candidates.slice(-limit)
      : candidates.slice(0, limit);
    reads.forEach(({ source, buffer, candidates }) => {
      if (!candidates.length) cursors[source] = latestCursor(buffer);
    });
    if (initial) {
      reads.forEach(({ source, buffer }) => {
        cursors[source] = latestCursor(buffer);
      });
    } else {
      selected.forEach((item) => {
        cursors[item.entry.source] = `${item.generation}:${item.sequence}`;
      });
    }
    return {
      entries: selected.map((item) => item.entry),
      cursors,
      resetSources: reads
        .filter(({ reset }) => reset)
        .map(({ source }) => source),
    };
  }

  return {
    sources,
    reset,
    append,
    read,
  };
}
