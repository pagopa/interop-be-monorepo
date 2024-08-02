import z from "zod";
import {
  EServiceId,
  ProducerKeychainId,
  TenantId,
  UserId,
} from "../brandedIds.js";
import { JWKKey, Key } from "./key.js";

export const ProducerKey = Key.extend({
  producerKeychainId: ProducerKeychainId,
});
export type ProducerKey = z.infer<typeof ProducerKey>;

export const ProducerKeychain = z.object({
  id: ProducerKeychainId,
  producerId: TenantId,
  name: z.string(),
  createdAt: z.coerce.date(),
  eservices: z.array(EServiceId),
  description: z.string(),
  users: z.array(UserId),
  keys: z.array(ProducerKey),
});
export type ProducerKeychain = z.infer<typeof ProducerKeychain>;

export const ProducerJWKKey = JWKKey.extend({
  producerKeychainId: ProducerKeychainId,
});

export type ProducerJWKKey = z.infer<typeof ProducerJWKKey>;
