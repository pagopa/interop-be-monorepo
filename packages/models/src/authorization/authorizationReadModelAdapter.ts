import {
  ClientReadModel,
  KeyReadModel,
} from "../read-models/authorizationReadModel.js";
import { Client } from "./client.js";
import { Key } from "./key.js";

export const toReadModelKey = (key: Key): KeyReadModel => ({
  ...key,
  createdAt: key.createdAt.toISOString(),
});

export const toReadModelClient = (client: Client): ClientReadModel => ({
  ...client,
  createdAt: client.createdAt.toISOString(),
  keys: client.keys.map(toReadModelKey),
});
