import { z } from "zod";
import { schemas } from "../generated/api.js";
import { schemas as authSchemas } from "../generated/authorization-process/api.js";

export type ApiPurposeAdditionDetailsSeed = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type ApiKeysSeed = z.infer<typeof schemas.KeysSeed>;
export type ApiClient = z.infer<typeof schemas.Client>;
export type ApiCompactOrganization = z.infer<
  typeof schemas.CompactOrganization
>;
export type ApiClientPurpose = z.infer<typeof schemas.ClientPurpose>;

export type ProcessApiClientKind = z.infer<typeof authSchemas.ClientKind>;
export type ProcessApiKeySeed = z.infer<typeof authSchemas.KeysSeed>;
export type ProcessApiKeyUse = z.infer<typeof authSchemas.KeyUse>;
export type ProcessApiClient = z.infer<typeof authSchemas.Client>;
export type ProcessApiClientPurpose = z.infer<typeof authSchemas.Purpose>;
