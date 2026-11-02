import { z } from "zod";

const MethodUrl = z.string().regex(/^(GET|POST|PUT|DELETE|PATCH) \/[\w/:-]+$/);

type MethodUrl = z.infer<typeof MethodUrl>;

const ErrorCode = z.string().regex(/^\d{3,4}-\d{3,5}$/);

type ErrorCode = z.infer<typeof ErrorCode>;

export const ProcessName = z.enum([
  "agreement",
  "attributeRegistry",
  "authorization",
  "catalog",
  "delegation",
  "eserviceTemplate",
  "notificationConfig",
  "purpose",
  "purposeTemplate",
  "tenant",
  "bff",
]);

export type ProcessName = z.infer<typeof ProcessName>;

const ErrorCopy = z.object({
  it: z
    .string()
    .min(1)
    .transform((val) => val.trim()),
  en: z
    .string()
    .optional()
    .transform((val) => {
      const trimmed = val?.trim();
      if (trimmed === "") {
        return undefined;
      }
      return trimmed;
    }),
});

type ErrorCopy = z.infer<typeof ErrorCopy>;

const FullError = z.object({
  process: z.string(),
  error: z.string(),
  errorCode: ErrorCode,
  bffEndpoint: MethodUrl,
  copy: ErrorCopy,
});

type FullError = z.infer<typeof FullError>;

export const FullErrors = z.array(FullError);

export type FullErrors = z.infer<typeof FullErrors>;
