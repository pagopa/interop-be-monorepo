import {
  clientInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  clientKeyInReadmodelClient,
} from "pagopa-interop-readmodel-models";
import { ClientSchema } from "../authorization/client.js";
import { ClientPurposeSchema } from "../authorization/clientPurpose.js";
import { ClientUserSchema } from "../authorization/clientUser.js";
import { ClientKeySchema } from "../authorization/clientKey.js";

export const ClientDbTableConfig = {
  client: ClientSchema,
  client_purpose: ClientPurposeSchema,
  client_user: ClientUserSchema,
  client_key: ClientKeySchema,
} as const;
export type ClientDbTableConfig = typeof ClientDbTableConfig;

export const ClientDbTableReadModel = {
  client: clientInReadmodelClient,
  client_purpose: clientPurposeInReadmodelClient,
  client_user: clientUserInReadmodelClient,
  client_key: clientKeyInReadmodelClient,
} as const;
export type ClientDbTableReadModel = typeof ClientDbTableReadModel;

export type ClientDbTable = keyof typeof ClientDbTableConfig;

export const ClientDbTable = Object.fromEntries(
  Object.keys(ClientDbTableConfig).map((k) => [k, k])
) as { [K in ClientDbTable]: K };
