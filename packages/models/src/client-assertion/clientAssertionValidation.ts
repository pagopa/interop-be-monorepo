import { z } from "zod";
import { ClientId, InteractionId, PurposeId } from "../brandedIds.js";
import { InteractionState } from "../token-generation-readmodel/interactions-entry.js";

export const ClientAssertionDigest = z
  .object({
    alg: z.string(),
    value: z.string(),
  })
  .strict();
export type ClientAssertionDigest = z.infer<typeof ClientAssertionDigest>;

export const ClientAssertionHeader = z.object({
  kid: z.string(),
  alg: z.string(),
  typ: z.string().optional(),
});
export type ClientAssertionHeader = z.infer<typeof ClientAssertionHeader>;

export const ClientAssertionHeaderStrict = ClientAssertionHeader.strict();
export type ClientAssertionHeaderStrict = z.infer<
  typeof ClientAssertionHeaderStrict
>;

export const ClientAssertionPayload = z.object({
  sub: ClientId,
  jti: z.string(),
  iat: z.number(),
  iss: z.string(),
  aud: z.array(z.string()).or(z.string()),
  exp: z.number(),
  digest: ClientAssertionDigest.nullish(),
  purposeId: PurposeId.optional(),
});
export type ClientAssertionPayload = z.infer<typeof ClientAssertionPayload>;

export const ClientAssertionPayloadStrict = ClientAssertionPayload.strict();
export type ClientAssertionPayloadStrict = z.infer<
  typeof ClientAssertionPayloadStrict
>;

export const ClientAssertion = z
  .object({
    header: ClientAssertionHeader,
    payload: ClientAssertionPayload,
  })
  .strict();
export type ClientAssertion = z.infer<typeof ClientAssertion>;

export const AsyncClientAssertionPayload = ClientAssertionPayload.extend({
  scope: InteractionState,
  interactionId: InteractionId.optional(),
  urlCallback: z.string().optional(),
  entityNumber: z.number().positive().optional(),
});
export type AsyncClientAssertionPayload = z.infer<
  typeof AsyncClientAssertionPayload
>;

export const AsyncClientAssertionPayloadStrict =
  AsyncClientAssertionPayload.strict();
export type AsyncClientAssertionPayloadStrict = z.infer<
  typeof AsyncClientAssertionPayloadStrict
>;

export const AsyncClientAssertion = z
  .object({
    header: ClientAssertionHeader,
    payload: AsyncClientAssertionPayload,
  })
  .strict();
export type AsyncClientAssertion = z.infer<typeof AsyncClientAssertion>;
