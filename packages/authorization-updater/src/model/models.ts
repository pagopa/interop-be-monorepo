import { z } from "zod";
import * as api from "./generated/api.js";

export type ApiClientComponentState = z.infer<
  typeof api.schemas.ClientComponentState
>;

export const ApiClientComponent = api.schemas.ClientComponentState;

export const ApiKeyUse = api.schemas.KeyUse;
export type ApiKeyUse = z.infer<typeof ApiKeyUse>;

export const ApiClientKind = api.schemas.ClientKind;
export type ApiClientKind = z.infer<typeof ApiClientKind>;
