import {
  ClientReadModel,
  KeyReadModel,
} from "../read-models/authorizationReadModel.js";
import { Client, ClientKey } from "./client.js";

export const toReadModelKey = (key: ClientKey): KeyReadModel => ({
  ...key,
  createdAt: key.createdAt.toISOString(),
});

export const toReadModelClient = (client: Client): ClientReadModel => ({
  ...client,
  createdAt: client.createdAt.toISOString(),
  keys: client.keys.map(toReadModelKey),
});
