import { z } from "zod";
import * as api from "../generated/api.js";

export type ApiClient = z.infer<typeof api.schemas.Client>;
export type ApiKey = z.infer<typeof api.schemas.Key>;
export type ApiClientKind = z.infer<typeof api.schemas.ClientKind>;
export type ApiKeyUse = z.infer<typeof api.schemas.KeyUse>;
export type ApiClientSeed = z.infer<typeof api.schemas.ClientSeed>;
export type ApiPurposeAdditionSeed = z.infer<
  typeof api.schemas.PurposeAdditionDetails
>;
