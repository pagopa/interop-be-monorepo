import { ApiError, ClientId, PurposeId } from "pagopa-interop-models";
import { z } from "zod";
import { ErrorCodes } from "./errors.js";

export const ClientAssertionDigest = z
  .object({
    alg: z.string(),
    value: z.string(),
  })
  .strict();
export type ClientAssertionDigest = z.infer<typeof ClientAssertionDigest>;

export const ClientAssertionHeader = z
  .object({
    kid: z.string(),
    alg: z.string(),
    typ: z.string().optional(),
  })
  .strict();
export type ClientAssertionHeader = z.infer<typeof ClientAssertionHeader>;

export const ClientAssertionPayload = z
  .object({
    sub: ClientId,
    jti: z.string(),
    iat: z.number(),
    iss: z.string(),
    aud: z.array(z.string()).or(z.string()),
    exp: z.number(),
    digest: ClientAssertionDigest.optional(),
    purposeId: PurposeId.optional(),
  })
  .strict();
export type ClientAssertionPayload = z.infer<typeof ClientAssertionPayload>;

export const ClientAssertion = z
  .object({
    header: ClientAssertionHeader,
    payload: ClientAssertionPayload,
  })
  .strict();
export type ClientAssertion = z.infer<typeof ClientAssertion>;

export const Base64Encoded = z.string().base64().min(1);

export type ValidationResult<T> =
  | SuccessfulValidation<T>
  | FailedValidation<ErrorCodes>;

export type SuccessfulValidation<T> = { errors: undefined; data: T };
export type FailedValidation<T> = {
  errors: Array<ApiError<T>>;
  data: undefined;
};

export const ClientAssertionValidationRequest = z.object({
  client_id: z.string().optional(),
  client_assertion: z.string(),
  client_assertion_type: z.string(),
  grant_type: z.string(),
});

export type ClientAssertionValidationRequest = z.infer<
  typeof ClientAssertionValidationRequest
>;
