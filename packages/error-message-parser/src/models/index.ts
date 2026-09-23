import type { Problem, MakeApiProblemFn } from "pagopa-interop-models";

import { match } from "ts-pattern";
import { z } from "zod";

export const MethodUrl = z.string().regex(/^(GET|POST|PUT|DELETE) \/[\w/-:]+$/);

export type MethodUrl = z.infer<typeof MethodUrl>;

export const ProcessName = z
  .string()
  .regex(/^[\w-\s]+\s*Process$/i)
  .min(1)
  .transform((val) =>
    match(
      val
        .replaceAll(/\s+/g, "")
        .toLowerCase()
        .replaceAll("-", "")
        .replace("process", "")
        .trim()
    )
      .with("agreement", () => "agreementProcess")
      .with("attributeregistry", () => "attributeRegistryProcess")
      .with("authorization", () => "authorizationProcess")
      .with("catalog", () => "catalogProcess")
      .with("delegation", () => "delegationProcess")
      .with("eservicetemplate", () => "eserviceTemplateProcess")
      .with("notificationconfig", () => "notificationConfigProcess")
      .with("purpose", () => "purposeProcess")
      .with("purposetemplate", () => "purposeTemplateProcess")
      .with("tenant", () => "tenantProcess")
      .otherwise((val) => val)
  );

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

export type MakeUserFacingApiProblemFn<T extends string> = (
  error: Parameters<MakeApiProblemFn<T>>[0],
  httpMapper: Parameters<MakeApiProblemFn<T>>[1],
  context: Parameters<MakeApiProblemFn<T>>[2] & {
    endpoint?: string;
  },
  operationalLogMessage?: Parameters<MakeApiProblemFn<T>>[3],
  placeholderMapper?: (problem: UserFacingProblem) => UserFacingProblem
) => UserFacingProblem;
