import { authorizationManagementApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  ApiError,
  ClientId,
  clientKindTokenStates,
  EServiceId,
  PurposeId,
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
    alg: z.string(), // TODO Enum, which values?
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

export const Key = z
  .object({
    GSIPK_clientId: ClientId,
    consumerId: TenantId,
    kidWithPurposeId: z.string(), // TODO which field of the table is mapped to this?
    publicKey: z.string().min(1),
    algorithm: z.literal("RS256"), // no field to map from the table. Is it extracted from publicKey field?
  })
  .strict();
export type Key = z.infer<typeof Key>;

export const ConsumerKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.consumer),
  GSIPK_purposeId: PurposeId, // TODO is this naming ok?
  purposeState: authorizationManagementApi.ClientComponentState,
  agreementId: AgreementId,
  agreementState: authorizationManagementApi.ClientComponentState,
  eServiceId: EServiceId, // no field to map. Extract from GSIPK_eserviceId_descriptorId?
  descriptorState: authorizationManagementApi.ClientComponentState,
}).strict();
export type ConsumerKey = z.infer<typeof ConsumerKey>;

export const ApiKey = Key.extend({
  clientKind: z.literal(clientKindTokenStates.api),
}).strict();
export type ApiKey = z.infer<typeof ApiKey>;

export type ValidationResult =
  | { errors: undefined; data: ClientAssertion }
  | { errors: Array<ApiError<ErrorCodes>>; data: undefined };

export type FlexibleValidationResult<T> =
  | { errors: undefined; data: T }
  | { errors: Array<ApiError<ErrorCodes>>; data: undefined };

// alternatively
export type ValidationResult2 = {
  errors: Array<ApiError<ErrorCodes>>;
  data?: ClientAssertion;
};
