import { z } from "zod";
import * as api from "./generated/api.js";

export type ApiClientComponentState = z.infer<
  typeof api.schemas.ClientComponentState
>;

export const ApiClientComponent = api.schemas.ClientComponentState;

export type ApiKeyUse = z.infer<typeof api.schemas.KeyUse>;

export const ApiKeyUse = api.schemas.KeyUse;
