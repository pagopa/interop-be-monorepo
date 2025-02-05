import z from "zod";
import {
  EServiceId,
  ProducerKeychainId,
  TenantId,
  UserId,
} from "../brandedIds.js";
import { Key, KeyUse } from "./key.js";

export const ProducerKeychain = z.object({
  id: ProducerKeychainId,
  producerId: TenantId,
  name: z.string(),
  createdAt: z.coerce.date(),
  eservices: z.array(EServiceId),
  description: z.string(),
  users: z.array(UserId),
  keys: z.array(Key),
});
export type ProducerKeychain = z.infer<typeof ProducerKeychain>;

export const ProducerKeychainSQL = z.object({
  id: ProducerKeychainId,
  version: z.number(),
  producer_id: TenantId,
  name: z.string(),
  created_at: z.coerce.date(),
  description: z.string(),
});
export type ProducerKeychainSQL = z.infer<typeof ProducerKeychainSQL>;

export const ProducerKeychainUserSQL = z.object({
  producer_keychain_version: z.number(),
  producer_keychain_id: ProducerKeychainId,
  user_id: UserId,
});

export type ProducerKeychainUserSQL = z.infer<typeof ProducerKeychainUserSQL>;

export const ProducerKeychainEServiceSQL = z.object({
  producer_keychain_version: z.number(),
  producer_keychain_id: ProducerKeychainId,
  eservice_id: EServiceId,
});

export type ProducerKeychainEServiceSQL = z.infer<
  typeof ProducerKeychainEServiceSQL
>;

export const ProducerKeychainKeySQL = z.object({
  producer_keychain_version: z.number(),
  producer_keychain_id: ProducerKeychainId,
  user_id: UserId,
  kid: z.string(),
  name: z.string(),
  encoded_pem: z.string(),
  algorithm: z.string(),
  use: KeyUse,
  created_at: z.coerce.date(),
});

export type ProducerKeychainKeySQL = z.infer<typeof ProducerKeychainKeySQL>;
