import { ZodiosInstance } from "@zodios/core";
import { api, createApiClient } from "../model/generated/api.js";

export type CatalogProcessClient = ZodiosInstance<typeof api.api>;

export const catalogProcessClientBuilder = (
  url: string
): CatalogProcessClient => createApiClient(url);
