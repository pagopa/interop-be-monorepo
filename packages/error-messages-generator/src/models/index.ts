import { z } from "zod";

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

export const BffService = z.object({
  name: z.string(),
  method: z.string(),
  file: z.string(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
  processes: z.array(
    z.object({
      process: z.string(),
      method: z.string(),
    }),
  ),
});

export type BffService = z.infer<typeof BffService>;

export const BffEndpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  openApi: z.object({
    operationId: z.string(),
    path: z.string(),
    fileName: z.string(),
  }),
  service: BffService,
});

export type BffEndpoint = z.infer<typeof BffEndpoint>;

export const Endpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  openApi: z.object({
    operationId: z.string(),
    path: z.string(),
    fileName: z.string(),
  }),
  service: Service,
  mapper: ErrorMapper,
  roles: z.array(z.string()),
  bffEndpoints: z.array(BffEndpoint),
});

export type Endpoint = z.infer<typeof Endpoint>;

export type OpenApiOperation = {
  operationId?: string;
};

export type OpenApiDocument = {
  paths?: Record<string, Record<string, OpenApiOperation>>;
};
