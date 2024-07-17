import { z } from "zod";
import { Client } from "../authorization/client.js";
import { Key } from "../authorization/client.js";

export const KeyReadModel = Key.extend({
  createdAt: z.string().datetime(),
});

export type KeyReadModel = z.infer<typeof KeyReadModel>;

export const ClientReadModel = Client.extend({
  createdAt: z.string().datetime(),
  keys: z.array(KeyReadModel),
});

export type ClientReadModel = z.infer<typeof ClientReadModel>;
