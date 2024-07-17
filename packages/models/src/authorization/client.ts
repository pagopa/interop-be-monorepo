import { z } from "zod";
import { ClientId, PurposeId, TenantId, UserId } from "../brandedIds.js";

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
  clientId: ClientId,
  userId: UserId,
  kid: z.string(),
  name: z.string(),
  encodedPem: z.string(),
  algorithm: z.string(),
  use: KeyUse,
  createdAt: z.coerce.date(),
});

export type Key = z.infer<typeof Key>;

export const clientKind = {
  consumer: "Consumer",
  api: "Api",
} as const;
export const ClientKind = z.enum([
  Object.values(clientKind)[0],
  ...Object.values(clientKind).slice(1),
]);
export type ClientKind = z.infer<typeof ClientKind>;

export const JWKKeyInReadModel = z.object({
  alg: z.string(),
  clientId: z.string(),
  e: z.string(),
  kid: z.string(),
  kty: z.string(),
  n: z.string(),
  use: z.string(),
});

export type JWKKeyInReadModel = z.infer<typeof JWKKeyInReadModel>;

export const Client = z.object({
  id: ClientId,
  consumerId: TenantId,
  name: z.string(),
  purposes: z.array(PurposeId),
  description: z.string().optional(),
  users: z.array(UserId),
  kind: ClientKind,
  createdAt: z.coerce.date(),
  keys: z.array(Key),
});

export type Client = z.infer<typeof Client>;
