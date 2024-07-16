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

export const KeyWithClient = z.object({
  JWKKey: z.object({
    kty: z.string(),
    keyOps: z.array(z.string()).optional(),
    use: z.string().optional(),
    alg: z.string().optional(),
    kid: z.string(),
    x5u: z.string().optional(),
    x5t: z.string().optional(),
    x5tS256: z.string().optional(),
    x5c: z.array(z.string()).optional(),
    crv: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
    d: z.string().optional(),
    k: z.string().optional(),
    n: z.string().optional(),
    e: z.string().optional(),
    p: z.string().optional(),
    q: z.string().optional(),
    dp: z.string().optional(),
    dq: z.string().optional(),
    qi: z.string().optional(),
    oth: z
      .array(
        z.object({
          r: z.string(),
          d: z.string(),
          t: z.string(),
        })
      )
      .optional(),
  }),
  client: z.object({
    id: ClientId,
    consumerId: TenantId,
    name: z.string(),
    purposes: z.array(PurposeId),
    description: z.string().optional(),
    users: z.array(UserId),
    kind: ClientKind,
    createdAt: z.coerce.date(),
    keys: z.array(Key),
  }),
});

export type KeyWithClient = z.infer<typeof KeyWithClient>;
