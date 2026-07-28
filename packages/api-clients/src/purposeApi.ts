import * as purposeApi from "./generated/purposeApi.js";
import { QueryParametersByAlias } from "./utils.js";
import {
  createZodiosClientEnhancedWithMetadata,
  ZodiosClientWithMetadata,
} from "./zodiosWithMetadata.js";

type Api = typeof purposeApi.purposeApi.api;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type PurposeProcessClientWithMetadata =
  ZodiosClientWithMetadata<PurposeProcessClient>;

export const createPurposeApiClientWithMetadata = (
  ...args: Parameters<typeof purposeApi.createPurposeApiClient>
): PurposeProcessClientWithMetadata =>
  createZodiosClientEnhancedWithMetadata(
    purposeApi.createPurposeApiClient,
    ...args
  );

export type GetPurposesQueryParams = QueryParametersByAlias<Api, "getPurposes">;

export * from "./generated/purposeApi.js";
