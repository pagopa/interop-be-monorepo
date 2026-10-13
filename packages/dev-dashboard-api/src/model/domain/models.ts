import type { LogEntry } from "pagopa-interop-dev-dashboard-contracts";

import { z } from "zod";

import { LOG_LEVELS, LOG_LIMITS } from "../../config/constants.js";

export type Command = {
  source: string;
  executable: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  privateOutput?: boolean;
};

export type Child = { pid: number; stop: () => Promise<void> };

export interface Driver {
  run(command: Command, log: (line: string) => void): Promise<string>;
  start(
    command: Command,
    log: (line: string) => void,
    exit: (error: string) => void
  ): Promise<Child>;
}

export type LogQuery = {
  source?: string;
  sources?: string[];
  service?: string;
  level?: LogEntry["level"];
  search?: string;
  cid?: string;
  cursors?: Record<string, string>;
  limit?: number;
};

export const LogRequestQuery = z
  .object({
    source: z.string().max(LOG_LIMITS.sourceLength).optional(),
    service: z.string().max(LOG_LIMITS.sourceLength).optional(),
    level: z.enum(LOG_LEVELS).optional(),
    search: z.string().max(LOG_LIMITS.searchLength).optional(),
    cid: z.string().max(LOG_LIMITS.correlationIdLength).optional(),
    cursors: z.string().max(LOG_LIMITS.cursorsLength).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LOG_LIMITS.maxPageSize)
      .optional(),
  })
  .strict();

export const LogCursors = z.record(z.string().max(LOG_LIMITS.cursorLength));

export const PresetId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(100);

export const PackageManifest = z.object({
  name: z.string(),
  scripts: z.object({ start: z.string().optional() }).optional(),
});

export const LocalDataset = z.object({
  tenants: z.array(
    z.object({ key: z.string(), selfcareId: z.string(), name: z.string() })
  ),
  users: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      surname: z.string(),
      email: z.string(),
      memberships: z.array(
        z.object({ tenantSelfcareId: z.string(), roles: z.array(z.string()) })
      ),
    })
  ),
});

export const LocalSeedState = z.object({
  tenants: z.record(z.object({ id: z.string() })),
});

export type LocalSeedState = z.infer<typeof LocalSeedState>;

export const Container = z.object({
  ID: z.string().optional(),
  Service: z.string(),
  State: z.string(),
  Status: z.string().optional(),
  ExitCode: z.number().optional(),
});

export type Container = z.infer<typeof Container>;

export const InspectedContainerState = z.object({
  ID: z.string(),
  OOMKilled: z.boolean().optional(),
  Error: z.string().optional(),
});

export type InspectedContainerState = z.infer<typeof InspectedContainerState>;
