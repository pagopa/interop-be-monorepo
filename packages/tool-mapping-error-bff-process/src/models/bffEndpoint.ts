import { z } from "zod";

import { FrontendServiceFileWithStackCalls } from "./frontend.js";
import { OpenApiLocation } from "./openApi.js";

const BffProcess = z.object({
  process: z.string(),
  method: z.string(),
});

type BffProcess = z.infer<typeof BffProcess>;

const BffService = z.object({
  name: z.string(),
  method: z.string(),
  file: z.string(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
  processes: z.array(BffProcess),
});

type BffService = z.infer<typeof BffService>;

export const BffEndpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  openApi: OpenApiLocation,
  service: BffService,
  frontendServiceFile: FrontendServiceFileWithStackCalls.optional(),
});

export type BffEndpoint = z.infer<typeof BffEndpoint>;
