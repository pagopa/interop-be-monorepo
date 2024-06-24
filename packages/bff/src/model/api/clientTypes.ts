import { z } from "zod";
import { schemas } from "../generated/api.js";
import { schemas as authSchemas } from "../generated/authorization-process/api.js";
import { schemas as authUpdaterSchemas } from "../generated/authorization-updater/api.js";

export type ApiPurposeAdditionDetailsSeed = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type BffApiKeysSeed = z.infer<typeof schemas.KeysSeed>;
export type BffApiClient = z.infer<typeof schemas.Client>;
export type BffApiCompactOrganization = z.infer<
  typeof schemas.CompactOrganization
>;
export type BffApiClientPurpose = z.infer<typeof schemas.ClientPurpose>;
export type BffApiClientPurposeAdditionDetails = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;

export type AuthProcessApiClientKind = z.infer<typeof authSchemas.ClientKind>;
export type AuthProcessApiKeySeed = z.infer<typeof authSchemas.KeysSeed>;
export type AuthProcessApiKeyUse = z.infer<typeof authSchemas.KeyUse>;

export type AuthUpdaterApiClient = z.infer<typeof authUpdaterSchemas.Client>;
export type AuthUpdaterApiPurpose = z.infer<typeof authUpdaterSchemas.Purpose>;
