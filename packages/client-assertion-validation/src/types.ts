import {
  ApiError,
  ClientId,
  DescriptorId,
  ItemState,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
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

const ComponentState = z.object({
  state: ItemState,
});

export type ComponentState = z.infer<typeof ComponentState>;

const AgreementComponentState = ComponentState;
export type AgreementComponentState = z.infer<typeof AgreementComponentState>;

const EServiceComponentState = ComponentState.extend({
  descriptorId: DescriptorId,
  audience: z.array(z.string()),
  voucherLifespan: z.number(),
});

export type EServiceComponentState = z.infer<typeof EServiceComponentState>;

const PurposeComponentState = ComponentState.extend({
  versionId: PurposeVersionId,
});

export type PurposeComponentState = z.infer<typeof PurposeComponentState>;

export const Base64Encoded = z.string().base64().min(1);

export const Key = z
  .object({
    clientId: ClientId,
    consumerId: TenantId,
    kid: z.string(),
    publicKey: Base64Encoded,
    algorithm: z.string(),
  })
  .strict();
export type Key = z.infer<typeof Key>;

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
