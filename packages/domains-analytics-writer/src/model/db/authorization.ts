import {
  clientInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  clientKeyInReadmodelClient,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
} from "pagopa-interop-readmodel-models";
import { ClientSchema } from "../authorization/client.js";
import { ClientPurposeSchema } from "../authorization/clientPurpose.js";
import { ClientUserSchema } from "../authorization/clientUser.js";
import { ClientKeySchema } from "../authorization/clientKey.js";
import { ProducerKeychainSchema } from "../authorization/producerKeychain.js";
import { ProducerKeychainEServiceSchema } from "../authorization/producerKeychainEService.js";
import { ProducerKeychainKeySchema } from "../authorization/producerKeychainKey.js";
import { ProducerKeychainUserSchema } from "../authorization/producerKeychainUser.js";

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

export const ClientDbTablePartialTableConfig = {
  key_relationship_migrated: ClientKeySchema,
} as const;
export type ClientDbTablePartialTableConfig =
  typeof ClientDbTablePartialTableConfig;

export const ClientDbTablePartialTableReadModel = {
  key_relationship_migrated: clientKeyInReadmodelClient,
} as const;

export type ClientDbTablePartialTableReadModel =
  typeof ClientDbTablePartialTableReadModel;

export type ClientDbTablePartialTable =
  keyof typeof ClientDbTablePartialTableReadModel;
export const ClientDbTablePartialTable = Object.fromEntries(
  Object.keys(ClientDbTablePartialTableConfig).map((k) => [k, k])
) as { [K in ClientDbTablePartialTable]: K };

export type ClientDbTableReadModel = typeof ClientDbTableReadModel;

export type ClientDbTable = keyof typeof ClientDbTableConfig;

export const ClientDbTable = Object.fromEntries(
  Object.keys(ClientDbTableConfig).map((k) => [k, k])
) as { [K in ClientDbTable]: K };

export const ProducerKeychainDbTableConfig = {
  producer_keychain: ProducerKeychainSchema,
  producer_keychain_user: ProducerKeychainUserSchema,
  producer_keychain_eservice: ProducerKeychainEServiceSchema,
  producer_keychain_key: ProducerKeychainKeySchema,
} as const;
export type ProducerKeychainDbTableConfig =
  typeof ProducerKeychainDbTableConfig;

export const ProducerKeychainDbTableReadModel = {
  producer_keychain: producerKeychainInReadmodelProducerKeychain,
  producer_keychain_user: producerKeychainUserInReadmodelProducerKeychain,
  producer_keychain_eservice:
    producerKeychainEserviceInReadmodelProducerKeychain,
  producer_keychain_key: producerKeychainKeyInReadmodelProducerKeychain,
} as const;
export type ProducerKeychainDbTableReadModel =
  typeof ProducerKeychainDbTableReadModel;

export type ProducerKeychainDbTable =
  keyof typeof ProducerKeychainDbTableConfig;

export const ProducerKeychainDbTable = Object.fromEntries(
  Object.keys(ProducerKeychainDbTableConfig).map((k) => [k, k])
) as { [K in ProducerKeychainDbTable]: K };
