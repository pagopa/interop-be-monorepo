import { z } from "zod";

import { BffEndpoint } from "./bffEndpoint.js";
import { OpenApiLocation } from "./openApi.js";

export const ErrorWithCode = z.object({
  code: z.number().int(),
  message: z.string(),
});

export type ErrorWithCode = z.infer<typeof ErrorWithCode>;

export const ErrorMapper = z.object({
  name: z.string(),
  file: z.string(),
  errors: z.array(ErrorWithCode),
});

export type ErrorMapper = z.infer<typeof ErrorMapper>;

export const Service = z.object({
  name: z.string(),
  method: z.string(),
  file: z.string(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
});

export type Service = z.infer<typeof Service>;

export const Endpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  openApi: OpenApiLocation,
  service: Service,
  mapper: ErrorMapper,
  roles: z.array(z.string()),
  bffEndpoints: z.array(BffEndpoint),
});

export type Endpoint = z.infer<typeof Endpoint>;
