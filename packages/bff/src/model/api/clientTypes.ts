import { z } from "zod";
import { schemas as authSchemas } from "../generated/authorization-process/api.js";
import { schemas as authUpdaterSchemas } from "../generated/authorization-updater/api.js";

export type BffApiPurposeAdditionDetailsSeed = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type ApiKeysSeed = z.infer<typeof schemas.KeysSeed>;
export type ApiClient = z.infer<typeof schemas.Client>;
export type ApiCompactOrganization = z.infer<
  typeof schemas.CompactOrganization
>;
export type ApiClientPurpose = z.infer<typeof schemas.ClientPurpose>;
export type ApiClientPurposeAdditionDetailsSeed = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type BffApiClientKind = z.infer<typeof schemas.ClientKind>;
export type BffApiCompactClient = z.infer<typeof schemas.CompactClient>;
export type BffApiCompactUser = z.infer<typeof schemas.CompactUser>;
export type BffApiPublicKey = z.infer<typeof schemas.PublicKey>;

export type AuthProcessApiClientKind = z.infer<typeof authSchemas.ClientKind>;
export type AuthProcessApiKeySeed = z.infer<typeof authSchemas.KeysSeed>;
export type AuthProcessApiKeyUse = z.infer<typeof authSchemas.KeyUse>;
export type AuthProcessApiClientSeed = z.infer<typeof authSchemas.ClientSeed>;
export type AuthProcessApiClientsWithKeys = z.infer<
  typeof authSchemas.ClientsWithKeys
>;
export type AuthProcessApiClientWithKeys = z.infer<
  typeof authSchemas.ClientWithKeys
>;
export type AuthProcessApiKey = z.infer<typeof authSchemas.Key>;

export type AuthUpdaterApiClient = z.infer<typeof authUpdaterSchemas.Client>;
export type AuthUpdaterApiPurpose = z.infer<typeof authUpdaterSchemas.Purpose>;
