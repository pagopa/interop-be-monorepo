import { z } from "zod";
import { ClientId, ProducerKeychainId, UserId } from "../brandedIds.js";

export const keyUse = {
  sig: "Sig",
  enc: "Enc",
} as const;
export const KeyUse = z.enum([
  Object.values(keyUse)[0],
  ...Object.values(keyUse).slice(1),
]);
export type KeyUse = z.infer<typeof KeyUse>;

export const Key = z.object({
  userId: UserId,
  kid: z.string(),
  name: z.string(),
  encodedPem: z.string(),
  algorithm: z.string(),
  use: KeyUse,
  createdAt: z.coerce.date(),
});

export type Key = z.infer<typeof Key>;

const JWKKey = z.object({
  alg: z.string(),
  e: z.string(),
  kid: z.string(),
  kty: z.string(),
  n: z.string(),
  use: z.string(),
});

type JWKKey = z.infer<typeof JWKKey>;

export const ClientJWKKey = JWKKey.extend({
  clientId: ClientId,
});

export type ClientJWKKey = z.infer<typeof ClientJWKKey>;

export const ProducerJWKKey = JWKKey.extend({
  producerKeychainId: ProducerKeychainId,
});

export type ProducerJWKKey = z.infer<typeof ProducerJWKKey>;
