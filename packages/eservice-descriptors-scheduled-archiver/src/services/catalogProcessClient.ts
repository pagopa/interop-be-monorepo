import { ZodiosInstance } from "@zodios/core";
import { catalogApi } from "pagopa-interop-api-clients";

export type CatalogProcessZodiosClient = ZodiosInstance<
  typeof catalogApi.processApi.api
>;

export const catalogProcessClientBuilder = (
  url: string
): CatalogProcessZodiosClient => catalogApi.createProcessApiClient(url);
