import type { Problem } from "pagopa-interop-models";

import { z } from "zod";

export const MethodUrl = z.string().regex(/^(GET|POST|PUT|DELETE) \/[\w/-:]+$/);

export type MethodUrl = z.infer<typeof MethodUrl>;

export const ProcessName = z
  .string()
  .regex(/^[\w-]+Process$/)
  .min(1)
  .transform((val) => val.trim());

export type ProcessName = z.infer<typeof ProcessName>;

export const ErrorMessage = z.object({
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

export type ErrorMessage = z.infer<typeof ErrorMessage>;

export const MessageObject = z.object({
  key: z.string(),
  messages: ErrorMessage,
});

export type MessageObject = z.infer<typeof MessageObject>;

export type EndpointErrorCopy = Record<string, MessageObject>;

export type ErrorCopy = Record<MethodUrl, EndpointErrorCopy>;

export type UserFacingProblem = Problem & {
  userMessages?: ErrorMessage;
};
