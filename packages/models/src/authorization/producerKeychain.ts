import z from "zod";
import {
  EServiceId,
  ProducerKeychainId,
  TenantId,
  UserId,
} from "../brandedIds.js";
import { JWKKey, Key } from "./key.js";

export const ProducerKeychainKey = Key.extend({
  producerKeychainId: ProducerKeychainId,
});
export type ProducerKeychainKey = z.infer<typeof ProducerKeychainKey>;

export const ProducerKeychain = z.object({
  id: ProducerKeychainId,
  producerId: TenantId,
  name: z.string(),
  createdAt: z.coerce.date(),
  eservices: z.array(EServiceId),
  description: z.string(),
  users: z.array(UserId),
  keys: z.array(ProducerKeychainKey),
});
export type ProducerKeychain = z.infer<typeof ProducerKeychain>;

export const ProducerKeychainJWKKey = JWKKey.extend({
  producerKeychainId: ProducerKeychainId,
});

export type ProducerKeychainJWKKey = z.infer<typeof ProducerKeychainJWKKey>;
