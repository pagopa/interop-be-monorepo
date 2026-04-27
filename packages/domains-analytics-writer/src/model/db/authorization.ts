import { clientKeyInReadmodelClient } from "pagopa-interop-readmodel-models";
import {
  ClientSchema,
  ClientPurposeSchema,
  ClientUserSchema,
  ClientKeySchema,
  ProducerKeychainSchema,
  ProducerKeychainEServiceSchema,
  ProducerKeychainKeySchema,
  ProducerKeychainUserSchema,
} from "pagopa-interop-kpi-models";

export const ClientDbTableConfig = {
  client: ClientSchema,
  client_purpose: ClientPurposeSchema,
  client_user: ClientUserSchema,
  client_key: ClientKeySchema,
} as const;
export type ClientDbTableConfig = typeof ClientDbTableConfig;

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

export type ProducerKeychainDbTable =
  keyof typeof ProducerKeychainDbTableConfig;

export const ProducerKeychainDbTable = Object.fromEntries(
  Object.keys(ProducerKeychainDbTableConfig).map((k) => [k, k])
) as { [K in ProducerKeychainDbTable]: K };
