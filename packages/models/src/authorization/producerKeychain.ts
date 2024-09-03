import z from "zod";
import {
  EServiceId,
  ProducerKeychainId,
  TenantId,
  UserId,
} from "../brandedIds.js";
import { Key } from "./key.js";

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
