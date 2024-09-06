import { authorizationManagementApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  ClientId,
  clientKind,
  EServiceId,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { z } from "zod";

export const ClientAssertionHeader = z.object({
  kid: z.string(),
  alg: z.string(), // TODO Enum
});
export type ClientAssertionHeader = z.infer<typeof ClientAssertionHeader>;

export const ClientAssertionPayload = z.object({
  sub: z.string(),
  jti: z.string(),
  iat: z.number(),
  iss: z.string(),
  aud: z.array(z.string()),
  exp: z.number(),
  purposeId: PurposeId.optional(),
});
export type ClientAssertionPayload = z.infer<typeof ClientAssertionPayload>;

export const ClientAssertion = z.object({
  header: ClientAssertionHeader,
  payload: ClientAssertionPayload,
});
export type ClientAssertion = z.infer<typeof ClientAssertion>;

export const Key = z.object({
  GSIPK_clientId: ClientId,
  consumerId: TenantId,
  kidWithPurposeId: z.string(), // TO DO which field of the table is mapper to this?
  publicKey: z.string().min(1),
  algorithm: z.literal("RS256"), // no field to map from the table. Is it included extracted from publicKey field?
});
export type Key = z.infer<typeof Key>;

export const ConsumerKey = Key.extend({
  clientKind: z.literal(clientKind.consumer),
  GSIPK_purposeId: PurposeId, // to do is this naming ok?
  purposeState: authorizationManagementApi.ClientComponentState,
  agreementId: AgreementId,
  agreementState: authorizationManagementApi.ClientComponentState,
  eServiceId: EServiceId, // no field to map. Extract from GSIPK_eserviceId_descriptorId?
  descriptorState: authorizationManagementApi.ClientComponentState,
});
export type ConsumerKey = z.infer<typeof ConsumerKey>;

export const ApiKey = Key.extend({
  clientKind: z.literal(clientKind.api),
});
export type ApiKey = z.infer<typeof ApiKey>;
