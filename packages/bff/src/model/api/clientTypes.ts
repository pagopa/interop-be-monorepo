import { z } from "zod";
import { schemas as authSchemas } from "../generated/authorization-process/api.js";
import { schemas as authUpdaterSchemas } from "../generated/authorization-updater/api.js";

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
