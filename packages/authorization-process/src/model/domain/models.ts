import { z } from "zod";
import * as api from "../generated/api.js";

export type ApiClient = z.infer<typeof api.schemas.Client>;
export type ApiKey = z.infer<typeof api.schemas.Key>;
export type ApiClientWithKeys = z.infer<typeof api.schemas.ClientWithKeys>;
export type ApiClientKind = z.infer<typeof api.schemas.ClientKind>;
export type ApiKeyUse = z.infer<typeof api.schemas.KeyUse>;
