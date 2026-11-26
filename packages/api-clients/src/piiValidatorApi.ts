import { ZodiosBodyByPath } from "@zodios/core";

import * as piiValidatorApi from "./generated/piiValidatorApi.js";

export type PiiValidatorClient = ReturnType<
  typeof piiValidatorApi.createDetectionApiClient
>;

export type ApiDetectionRequest = ZodiosBodyByPath<
  typeof piiValidatorApi.detectionApi.api,
  "post",
  "/detect"
>;

export * from "./generated/piiValidatorApi.js";
