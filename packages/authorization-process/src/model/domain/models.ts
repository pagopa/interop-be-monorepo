import { z } from "zod";
import * as api from "../generated/api.js";

export type ApiClient = z.infer<typeof api.schemas.Client>;
export type ApiKey = z.infer<typeof api.schemas.Key>;
export type ApiClientKind = z.infer<typeof api.schemas.ClientKind>;
export type ApiKeyUse = z.infer<typeof api.schemas.KeyUse>;
export type ApiClientSeed = z.infer<typeof api.schemas.ClientSeed>;
export type ApiKeysSeed = z.infer<typeof api.schemas.KeysSeed>;
export type ApiKeySeed = z.infer<typeof api.schemas.KeySeed>;
export type ApiPurposeAdditionSeed = z.infer<
  typeof api.schemas.PurposeAdditionDetails
>;
export type ApiJWKKey = z.infer<typeof api.schemas.JWKKey>;
export const ApiJWKKey = api.schemas.JWKKey;
