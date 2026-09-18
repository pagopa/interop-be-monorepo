import { z } from "zod";

export const OpenApiLocation = z.object({
    operationId: z.string(),
    path: z.string(),
    fileName: z.string(),
  });

export type OpenApiLocation = z.infer<typeof OpenApiLocation>;

export type OpenApiOperation = {
  operationId?: string;
};

export type OpenApiDocument = {
  paths?: Record<string, Record<string, OpenApiOperation>>;
};
