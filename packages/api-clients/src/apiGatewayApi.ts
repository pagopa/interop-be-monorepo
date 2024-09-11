import * as apiGatewayApi from "./generated/apiGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof apiGatewayApi.gatewayApi.api;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  Api,
  "getAgreements"
>;

export * from "./generated/apiGatewayApi.js";
