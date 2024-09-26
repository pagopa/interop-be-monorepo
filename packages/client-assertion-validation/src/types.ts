import {
  AgreementId,
  ApiError,
  ClientId,
  clientKindTokenStates,
  EServiceId,
  ItemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { z } from "zod";
import { ErrorCodes } from "./errors.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "./utils.js";

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
  })
  .strict();
export type ClientAssertionHeader = z.infer<typeof ClientAssertionHeader>;

export const ClientAssertionPayload = z
  .object({
    sub: z.string(),
    jti: z.string(),
    iat: z.number(),
    iss: z.string(),
    aud: z.array(z.string()),
    exp: z.number(),
    digest: ClientAssertionDigest,
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

declare const brand: unique symbol;

export type Brand<T, TBrand> = T & { [brand]: TBrand };

export type ValidatedAlg = Brand<string, "alg">;
export type ValidatedKid = Brand<string, "kid">;
export type ValidatedSub = Brand<string, "sub">;
export type ValidatedJti = Brand<string, "jti">;
export type ValidatedIat = Brand<number, "iat">;
export type ValidatedIss = Brand<string, "iss">;
export type ValidatedAud = Brand<string[], "aud">;
export type ValidatedExp = Brand<number, "exp">;
export type ValidatedPurposeId = Brand<PurposeId, "purposeId">;
export type ValidatedDigestValue = Brand<string, "value">;
export type ValidatedDigest = Brand<
  {
    alg: ValidatedAlg;
    value: ValidatedDigestValue;
  },
  "digest"
>;

export type ValidatedClientAssertion = {
  header: {
    alg: ValidatedAlg;
    kid: ValidatedKid;
  };
  payload: {
    sub: ValidatedSub;
    jti: ValidatedJti;
    iat: ValidatedIat;
    iss: ValidatedIss;
    aud: ValidatedAud;
    exp: ValidatedExp;
    digest: ValidatedDigest;
    purposeId: ValidatedPurposeId | undefined;
  };
};

export const Key = z
  .object({
    clientId: ClientId,
    consumerId: TenantId,
    kid: z.string(),
    purposeId: PurposeId,
    publicKey: z.string().min(1),
    algorithm: z.literal("RS256"),
  })
  .strict();
export type Key = z.infer<typeof Key>;

export const ConsumerKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.consumer),
  purposeId: PurposeId,
  purposeState: ItemState,
  agreementId: AgreementId,
  agreementState: ItemState,
  eServiceId: EServiceId,
  descriptorState: ItemState,
}).strict();
export type ConsumerKey = z.infer<typeof ConsumerKey>;

export const ApiKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.api),
}).strict();
export type ApiKey = z.infer<typeof ApiKey>;

export type ValidationResult<T> = SuccessfulValidation<T> | FailedValidation;

export type SuccessfulValidation<T> = { hasSucceeded: true; data: T };
export type FailedValidation = {
  hasSucceeded: false;
  errors: Array<ApiError<ErrorCodes>>;
};

export const ClientAssertionValidationRequest = z.object({
  client_id: z.optional(z.string().uuid()),
  client_assertion: z.string(),
  client_assertion_type: z.literal(EXPECTED_CLIENT_ASSERTION_TYPE),
  grant_type: z.literal(EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE),
});

export type ClientAssertionValidationRequest = z.infer<
  typeof ClientAssertionValidationRequest
>;
