import { z } from "zod";
import { ClientId, PurposeId, TenantId, UserId } from "../brandedIds.js";
import { Key } from "./key.js";

export const clientKind = {
  consumer: "Consumer",
  api: "Api",
} as const;
export const ClientKind = z.enum([
  Object.values(clientKind)[0],
  ...Object.values(clientKind).slice(1),
]);
export type ClientKind = z.infer<typeof ClientKind>;

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

export const ClientSQL = z.object({
  id: ClientId,
  version: z.number(),
  consumer_id: TenantId,
  name: z.string(),
  description: z.string().optional(),
  kind: ClientKind,
  created_at: z.coerce.date(),
});

export type ClientSQL = z.infer<typeof ClientSQL>;

export const ClientUserSQL = z.object({
  client_version: z.number(),
  client_id: ClientId,
  user_id: UserId,
});

export type ClientUserSQL = z.infer<typeof ClientUserSQL>;

export const ClientPurposeSQL = z.object({
  client_version: z.number(),
  client_id: ClientId,
  purpose_id: PurposeId,
});

export type ClientPurposeSQL = z.infer<typeof ClientPurposeSQL>;

export const ClientKeySQL = z.object({
  client_version: z.number(),
  client_id: ClientId,
  user_id: UserId,
  kid: z.string(),
  name: z.string(),
  encoded_pem: z.string(),
  algorithm: z.string(),
  use: z.string(),
  created_at: z.coerce.date(),
});

export type ClientKeySQL = z.infer<typeof ClientKeySQL>;
