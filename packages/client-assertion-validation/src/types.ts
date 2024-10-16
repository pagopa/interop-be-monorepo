import {
  AgreementId,
  ApiError,
  ClientId,
  clientKindTokenStates,
  DescriptorId,
  EServiceId,
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
    aud: z.array(z.string()),
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

export const Key = z
  .object({
    clientId: ClientId,
    consumerId: TenantId,
    kid: z.string(),
    publicKey: z.string().min(1),
    algorithm: z.string(),
  })
  .strict();
export type Key = z.infer<typeof Key>;

export const ConsumerKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.consumer),
  purposeId: PurposeId,
  // TODO: can we rename the type to purposeDetails or something similar (avoid misleading "state" term)?
  purposeState: PurposeComponentState,
  agreementId: AgreementId,
  agreementState: AgreementComponentState,
  eServiceId: EServiceId,
  eServiceState: EServiceComponentState,
}).strict();
export type ConsumerKey = z.infer<typeof ConsumerKey>;

export const ApiKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.api),
}).strict();
export type ApiKey = z.infer<typeof ApiKey>;

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
