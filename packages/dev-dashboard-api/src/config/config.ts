import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { PresetId } from "../model/domain/models.js";
import { DASHBOARD_PATHS, MAX_PORT } from "./constants.js";

const defaultBackendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

const frontendUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "http:" &&
        ["frontend", "localhost", "127.0.0.1", "[::1]"].includes(
          url.hostname
        ) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Frontend observation requires a local HTTP origin")
  .transform((value) => new URL(value).origin);

export const DashboardApiConfig = z
  .object({
    INTEROP_BE_ROOT: z.string().default(defaultBackendRoot),
    DASHBOARD_PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(8076),
    DASHBOARD_AUTOSTART: z.string().optional(),
    DASHBOARD_FRONTEND_URL: frontendUrl.optional(),
    DASHBOARD_AUTOSTART_PRESET: PresetId.optional()
      .or(z.literal(""))
      .transform((id) => id || undefined),
  })
  .transform((env) => {
    const beRoot = resolve(env.INTEROP_BE_ROOT);

    return {
      beRoot,
      port: env.DASHBOARD_PORT,
      autostart: env.DASHBOARD_AUTOSTART !== "false",
      autostartPreset: env.DASHBOARD_AUTOSTART_PRESET,
      frontendUrl: env.DASHBOARD_FRONTEND_URL,
      personalPath: join(beRoot, DASHBOARD_PATHS.personalPresets),
      bootstrapLogPath: join(beRoot, DASHBOARD_PATHS.bootstrapLog),
      uiRoot: join(beRoot, DASHBOARD_PATHS.uiDist),
    };
  });

type DashboardApiConfig = z.infer<typeof DashboardApiConfig>;

export const config: DashboardApiConfig = DashboardApiConfig.parse(process.env);
