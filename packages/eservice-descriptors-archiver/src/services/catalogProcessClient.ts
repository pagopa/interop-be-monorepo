import { ZodiosInstance } from "@zodios/core";
import { catalogApi } from "pagopa-interop-api-clients";

export type CatalogProcessClient = ZodiosInstance<
  typeof catalogApi.processApi.api
>;

export const catalogProcessClientBuilder = (
  url: string
): CatalogProcessClient => catalogApi.createProcessApiClient(url);
