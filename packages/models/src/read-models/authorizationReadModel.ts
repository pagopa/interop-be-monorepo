import { z } from "zod";
import { Client } from "../authorization/client.js";
import { ClientKey } from "../authorization/client.js";
import {
  ProducerKeychain,
  ProducerKey,
} from "../authorization/producerKeychain.js";

export const ClientKeyReadModel = ClientKey.extend({
  createdAt: z.string().datetime(),
});

export type ClientKeyReadModel = z.infer<typeof ClientKeyReadModel>;

export const ProducerKeyReadModel = ProducerKey.extend({
  createdAt: z.string().datetime(),
});

export type ProducerKeyReadModel = z.infer<
  typeof ProducerKeyReadModel
>;

export const ClientReadModel = Client.extend({
  createdAt: z.string().datetime(),
  keys: z.array(ClientKeyReadModel),
});

export type ClientReadModel = z.infer<typeof ClientReadModel>;

export const ProducerKeychainReadModel = ProducerKeychain.extend({
  createdAt: z.string().datetime(),
  keys: z.array(ProducerKeyReadModel),
});

export type ProducerKeychainReadModel = z.infer<
  typeof ProducerKeychainReadModel
>;
