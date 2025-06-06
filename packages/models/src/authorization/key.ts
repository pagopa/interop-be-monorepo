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

export const JWKKeyRS256 = z.object({
  alg: z.string(),
  e: z.string(),
  kid: z.string(),
  kty: z.string(),
  n: z.string(),
  use: z.string(),
});
export type JWKKeyRS256 = z.infer<typeof JWKKeyRS256>;

export const JWKKeyES256 = z.object({
  alg: z.string(),
  crv: z.string(),
  kid: z.string(),
  kty: z.string(),
  use: z.string(),
  x: z.string(),
  y: z.string(),
});
export type JWKKeyES256 = z.infer<typeof JWKKeyES256>;

export const ClientJWKKey = JWKKeyRS256.extend({
  clientId: ClientId,
});
export type ClientJWKKey = z.infer<typeof ClientJWKKey>;

export const ProducerJWKKey = JWKKeyRS256.extend({
  producerKeychainId: ProducerKeychainId,
});
export type ProducerJWKKey = z.infer<typeof ProducerJWKKey>;
