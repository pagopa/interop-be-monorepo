import type { Supervisor } from "../services/supervisorService.js";

import {
  LOG_SOURCE_GROUPS,
  LOG_SOURCE_PREFIXES,
  LOG_SOURCES,
} from "../config/constants.js";
import { invalidLogCursors, unknownLogPreset } from "../model/domain/errors.js";
import {
  LogCursors,
  LogRequestQuery,
  type LogQuery,
} from "../model/domain/models.js";

export function parseLogQuery(
  input: unknown,
  supervisor: Supervisor
): LogQuery {
  try {
    const data = LogRequestQuery.parse(input);
    let cursors = data.cursors
      ? LogCursors.parse(JSON.parse(data.cursors))
      : undefined;
    const sources = resolveSources(data.source, supervisor);

    if (
      cursors &&
      sources &&
      (data.source === LOG_SOURCE_GROUPS.packages ||
        data.source === LOG_SOURCE_GROUPS.infrastructure)
    ) {
      // Foreign cursors must not turn a fresh aggregate request into a delta,
      // which would select the oldest matching lines instead of the latest.
      const members = new Set(sources);

      cursors = Object.fromEntries(
        Object.entries(cursors).filter(([source]) => members.has(source))
      );
    }

    return {
      ...data,
      source: sources ? undefined : data.source,
      sources,
      cursors,
    };
  } catch (error) {
    throw error instanceof SyntaxError ? invalidLogCursors() : error;
  }
}

function resolveSources(
  source: string | undefined,
  supervisor: Supervisor
): string[] | undefined {
  switch (source) {
    case undefined:
      return undefined;
    case LOG_SOURCE_GROUPS.packages:
      return supervisor.status().packages.map((item) => item.name);
    case LOG_SOURCE_GROUPS.infrastructure:
      // Buffers survive stopped or removed containers.
      return supervisor.logs
        .sources()
        .filter((item) => item.startsWith(LOG_SOURCE_PREFIXES.infrastructure));
    case LOG_SOURCE_GROUPS.seed:
      return [...supervisor.status().seedPackages, LOG_SOURCES.orchestration];
    default:
      return source?.startsWith(LOG_SOURCE_PREFIXES.preset)
        ? presetSources(
            source.slice(LOG_SOURCE_PREFIXES.preset.length),
            supervisor
          )
        : undefined;
  }
}

function presetSources(id: string, supervisor: Supervisor): string[] {
  const preset = supervisor.status().presets.find((item) => item.id === id);
  if (!preset) throw unknownLogPreset(id);
  return preset.packages.map((member) => member.name);
}
