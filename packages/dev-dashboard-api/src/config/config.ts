import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { PresetId } from "../model/domain/models.js";
import { DASHBOARD_PATHS, MAX_PORT } from "./constants.js";

const defaultBackendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

export const DashboardApiConfig = z
  .object({
    INTEROP_BE_ROOT: z.string().default(defaultBackendRoot),
    INTEROP_FE_ROOT: z.string().optional(),
    DASHBOARD_PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(8076),
    DASHBOARD_AUTOSTART: z.string().optional(),
    DASHBOARD_AUTOSTART_PRESET: PresetId.optional()
      .or(z.literal(""))
      .transform((id) => id || undefined),
  })
  .transform((env) => {
    const beRoot = resolve(env.INTEROP_BE_ROOT);

    return {
      beRoot,
      feRoot: env.INTEROP_FE_ROOT ? resolve(env.INTEROP_FE_ROOT) : undefined,
      port: env.DASHBOARD_PORT,
      autostart: env.DASHBOARD_AUTOSTART !== "false",
      autostartPreset: env.DASHBOARD_AUTOSTART_PRESET,
      personalPath: join(beRoot, DASHBOARD_PATHS.personalPresets),
      bootstrapLogPath: join(beRoot, DASHBOARD_PATHS.bootstrapLog),
      uiRoot: join(beRoot, DASHBOARD_PATHS.uiDist),
    };
  });

type DashboardApiConfig = z.infer<typeof DashboardApiConfig>;

export const config: DashboardApiConfig = DashboardApiConfig.parse(process.env);
