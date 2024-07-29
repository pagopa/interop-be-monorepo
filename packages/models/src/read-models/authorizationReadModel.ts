import { z } from "zod";
import { Client } from "../authorization/client.js";
import { ClientKey } from "../authorization/client.js";
import {
  ProducerKeychain,
  ProducerKeychainKey,
} from "../authorization/producerKeychain.js";

export const ClientKeyReadModel = ClientKey.extend({
  createdAt: z.string().datetime(),
});

export type ClientKeyReadModel = z.infer<typeof ClientKeyReadModel>;

export const ProducerKeychainKeyReadModel = ProducerKeychainKey.extend({
  createdAt: z.string().datetime(),
});

export type ProducerKeychainKeyReadModel = z.infer<
  typeof ProducerKeychainKeyReadModel
>;

export const ClientReadModel = Client.extend({
  createdAt: z.string().datetime(),
  keys: z.array(ClientKeyReadModel),
});

export type ClientReadModel = z.infer<typeof ClientReadModel>;

export const ProducerKeychainReadModel = ProducerKeychain.extend({
  createdAt: z.string().datetime(),
  keys: z.array(ProducerKeychainKeyReadModel),
});

export type ProducerKeychainReadModel = z.infer<
  typeof ProducerKeychainReadModel
>;
